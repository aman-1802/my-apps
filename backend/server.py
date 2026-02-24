from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from google.oauth2 import service_account
from googleapiclient.discovery import build
import asyncio
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Google Sheets Setup
GOOGLE_SHEET_ID = os.environ.get('GOOGLE_SHEET_ID')
GOOGLE_SHEET_NAME = os.environ.get('GOOGLE_SHEET_NAME', 'Expense_Data')
SCOPES = ['https://www.googleapis.com/auth/spreadsheets']

def get_sheets_service():
    """Create Google Sheets service using service account credentials"""
    credentials_info = {
        "type": "service_account",
        "project_id": os.environ.get('GOOGLE_PROJECT_ID'),
        "private_key_id": "17a6deb08c56eccb828a4311a67686c3a8483aed",
        "private_key": os.environ.get('GOOGLE_PRIVATE_KEY', '').replace('\\n', '\n'),
        "client_email": os.environ.get('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
        "client_id": "112627331549523235214",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{os.environ.get('GOOGLE_SERVICE_ACCOUNT_EMAIL', '').replace('@', '%40')}",
        "universe_domain": "googleapis.com"
    }
    
    credentials = service_account.Credentials.from_service_account_info(
        credentials_info, scopes=SCOPES
    )
    service = build('sheets', 'v4', credentials=credentials)
    return service

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Categories
DEFAULT_CATEGORIES = ["Food", "Rent", "Subscriptions", "Dinner", "Blinkit", "Travel", "Utilities", "Shopping", "Other"]

# Define Models
class ExpenseBase(BaseModel):
    date: str
    title: str
    amount: float
    category: str = "Other"
    to_be_paid_by: str = "Me"  # Me, Mom, Dad
    paid_amount: float = 0
    tags: Optional[str] = ""
    is_fixed: bool = False
    remark: Optional[str] = ""

class ExpenseCreate(ExpenseBase):
    pass

class ExpenseUpdate(BaseModel):
    date: Optional[str] = None
    title: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    to_be_paid_by: Optional[str] = None
    paid_amount: Optional[float] = None
    tags: Optional[str] = None
    is_fixed: Optional[bool] = None
    remark: Optional[str] = None

class Expense(ExpenseBase):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    serial_number: int = 0
    remaining_balance: float = 0
    payment_status: str = "Unpaid"  # Paid, Partially Paid, Unpaid
    created_timestamp: str = ""
    snapshot_month: str = ""
    synced_to_sheet: bool = False
    sheet_row_number: Optional[int] = None

class SyncRequest(BaseModel):
    expenses: List[ExpenseCreate]
    local_ids: List[str]

class MonthlySnapshot(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    month: str  # Format: YYYY-MM
    total_expense: float
    total_paid: float
    total_unpaid: float
    category_breakdown: dict
    created_at: str
    is_locked: bool = True

# Helper functions
def calculate_payment_status(amount: float, paid_amount: float) -> str:
    if paid_amount >= amount:
        return "Paid"
    elif paid_amount > 0:
        return "Partially Paid"
    return "Unpaid"

def get_current_month() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m")

async def get_next_serial_number() -> int:
    last_expense = await db.expenses.find_one(
        {}, {"serial_number": 1}, sort=[("serial_number", -1)]
    )
    return (last_expense.get("serial_number", 0) if last_expense else 0) + 1

async def sync_expense_to_sheet(expense: dict) -> Optional[int]:
    """Sync a single expense to Google Sheets"""
    try:
        service = get_sheets_service()
        sheet = service.spreadsheets()
        
        # First, find the next empty row
        def get_next_row():
            result = sheet.values().get(
                spreadsheetId=GOOGLE_SHEET_ID,
                range=f"{GOOGLE_SHEET_NAME}!A:A"
            ).execute()
            values = result.get('values', [])
            return len(values) + 1
        
        next_row = await asyncio.to_thread(get_next_row)
        
        # Prepare row data matching the sheet columns
        row_data = [
            expense.get("serial_number", ""),
            expense.get("date", ""),
            expense.get("title", ""),
            expense.get("amount", 0),
            expense.get("category", ""),
            expense.get("to_be_paid_by", ""),
            expense.get("paid_amount", 0),
            expense.get("remaining_balance", 0),
            expense.get("payment_status", ""),
            expense.get("tags", ""),
            "Fixed" if expense.get("is_fixed") else "Variable",
            expense.get("remark", ""),
            expense.get("created_timestamp", ""),
            expense.get("snapshot_month", ""),
            expense.get("id", "")  # Store expense ID for reference
        ]
        
        # Write to specific row
        def do_write():
            return sheet.values().update(
                spreadsheetId=GOOGLE_SHEET_ID,
                range=f"{GOOGLE_SHEET_NAME}!A{next_row}:O{next_row}",
                valueInputOption="USER_ENTERED",
                body={"values": [row_data]}
            ).execute()
        
        await asyncio.to_thread(do_write)
        return next_row
    except Exception as e:
        logger.error(f"Error syncing to sheet: {e}")
        return None

async def update_sheet_row(row_number: int, expense: dict) -> bool:
    """Update an existing row in Google Sheets"""
    try:
        service = get_sheets_service()
        sheet = service.spreadsheets()
        
        row_data = [
            expense.get("serial_number", ""),
            expense.get("date", ""),
            expense.get("title", ""),
            expense.get("amount", 0),
            expense.get("category", ""),
            expense.get("to_be_paid_by", ""),
            expense.get("paid_amount", 0),
            expense.get("remaining_balance", 0),
            expense.get("payment_status", ""),
            expense.get("tags", ""),
            "Fixed" if expense.get("is_fixed") else "Variable",
            expense.get("remark", ""),
            expense.get("created_timestamp", ""),
            expense.get("snapshot_month", ""),
            expense.get("id", "")
        ]
        
        def do_update():
            return sheet.values().update(
                spreadsheetId=GOOGLE_SHEET_ID,
                range=f"{GOOGLE_SHEET_NAME}!A{row_number}:O{row_number}",
                valueInputOption="USER_ENTERED",
                body={"values": [row_data]}
            ).execute()
        
        await asyncio.to_thread(do_update)
        return True
    except Exception as e:
        logger.error(f"Error updating sheet row: {e}")
        return False

async def delete_sheet_row(row_number: int) -> bool:
    """Delete a row from Google Sheets"""
    try:
        service = get_sheets_service()
        sheet = service.spreadsheets()
        
        # Clear the row content instead of deleting to maintain row numbers
        def do_clear():
            return sheet.values().clear(
                spreadsheetId=GOOGLE_SHEET_ID,
                range=f"{GOOGLE_SHEET_NAME}!A{row_number}:O{row_number}"
            ).execute()
        
        await asyncio.to_thread(do_clear)
        return True
    except Exception as e:
        logger.error(f"Error deleting sheet row: {e}")
        return False

# API Routes

@api_router.get("/")
async def root():
    return {"message": "Expense Tracker API"}

@api_router.get("/categories")
async def get_categories():
    return {"categories": DEFAULT_CATEGORIES}

# Expense CRUD
@api_router.post("/expenses", response_model=Expense)
async def create_expense(expense_data: ExpenseCreate):
    serial_number = await get_next_serial_number()
    now = datetime.now(timezone.utc)
    
    remaining_balance = expense_data.amount - expense_data.paid_amount
    payment_status = calculate_payment_status(expense_data.amount, expense_data.paid_amount)
    
    expense = Expense(
        **expense_data.model_dump(),
        serial_number=serial_number,
        remaining_balance=remaining_balance,
        payment_status=payment_status,
        created_timestamp=now.isoformat(),
        snapshot_month=get_current_month(),
        synced_to_sheet=False
    )
    
    doc = expense.model_dump()
    await db.expenses.insert_one(doc)
    
    # Try to sync to Google Sheets
    row_number = await sync_expense_to_sheet(doc)
    if row_number:
        await db.expenses.update_one(
            {"id": expense.id},
            {"$set": {"synced_to_sheet": True, "sheet_row_number": row_number}}
        )
        expense.synced_to_sheet = True
        expense.sheet_row_number = row_number
    
    return expense

@api_router.get("/expenses", response_model=List[Expense])
async def get_expenses(
    month: Optional[str] = None,
    year: Optional[str] = None,
    category: Optional[str] = None,
    payment_status: Optional[str] = None,
    to_be_paid_by: Optional[str] = None,
    is_fixed: Optional[bool] = None,
    tag: Optional[str] = None
):
    query = {}
    
    if month:
        query["snapshot_month"] = {"$regex": f"-{month.zfill(2)}$"}
    if year:
        query["snapshot_month"] = {"$regex": f"^{year}"}
    if month and year:
        query["snapshot_month"] = f"{year}-{month.zfill(2)}"
    if category:
        query["category"] = category
    if payment_status:
        query["payment_status"] = payment_status
    if to_be_paid_by:
        query["to_be_paid_by"] = to_be_paid_by
    if is_fixed is not None:
        query["is_fixed"] = is_fixed
    if tag:
        query["tags"] = {"$regex": tag, "$options": "i"}
    
    expenses = await db.expenses.find(query, {"_id": 0}).sort("created_timestamp", -1).to_list(10000)
    return expenses

@api_router.get("/expenses/{expense_id}", response_model=Expense)
async def get_expense(expense_id: str):
    expense = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense

@api_router.put("/expenses/{expense_id}", response_model=Expense)
async def update_expense(expense_id: str, expense_data: ExpenseUpdate):
    expense = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    update_dict = {k: v for k, v in expense_data.model_dump().items() if v is not None}
    
    # Recalculate payment status if amount or paid_amount changed
    new_amount = update_dict.get("amount", expense.get("amount"))
    new_paid_amount = update_dict.get("paid_amount", expense.get("paid_amount"))
    
    update_dict["remaining_balance"] = new_amount - new_paid_amount
    update_dict["payment_status"] = calculate_payment_status(new_amount, new_paid_amount)
    update_dict["synced_to_sheet"] = False  # Mark as needing re-sync
    
    await db.expenses.update_one({"id": expense_id}, {"$set": update_dict})
    
    # Re-sync to sheet if already synced
    updated_expense = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    if updated_expense.get("sheet_row_number"):
        success = await update_sheet_row(updated_expense["sheet_row_number"], updated_expense)
        if success:
            await db.expenses.update_one({"id": expense_id}, {"$set": {"synced_to_sheet": True}})
            updated_expense["synced_to_sheet"] = True
    
    return updated_expense

@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str):
    expense = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    # Delete from sheet if synced
    if expense.get("sheet_row_number"):
        await delete_sheet_row(expense["sheet_row_number"])
    
    await db.expenses.delete_one({"id": expense_id})
    return {"message": "Expense deleted successfully"}

@api_router.put("/expenses/{expense_id}/mark-paid")
async def mark_expense_paid(expense_id: str):
    expense = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    update_dict = {
        "paid_amount": expense["amount"],
        "remaining_balance": 0,
        "payment_status": "Paid",
        "synced_to_sheet": False
    }
    
    await db.expenses.update_one({"id": expense_id}, {"$set": update_dict})
    
    updated_expense = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    if updated_expense.get("sheet_row_number"):
        success = await update_sheet_row(updated_expense["sheet_row_number"], updated_expense)
        if success:
            await db.expenses.update_one({"id": expense_id}, {"$set": {"synced_to_sheet": True}})
    
    return {"message": "Expense marked as paid"}

@api_router.put("/expenses/{expense_id}/mark-unpaid")
async def mark_expense_unpaid(expense_id: str):
    expense = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    update_dict = {
        "paid_amount": 0,
        "remaining_balance": expense["amount"],
        "payment_status": "Unpaid",
        "synced_to_sheet": False
    }
    
    await db.expenses.update_one({"id": expense_id}, {"$set": update_dict})
    
    updated_expense = await db.expenses.find_one({"id": expense_id}, {"_id": 0})
    if updated_expense.get("sheet_row_number"):
        success = await update_sheet_row(updated_expense["sheet_row_number"], updated_expense)
        if success:
            await db.expenses.update_one({"id": expense_id}, {"$set": {"synced_to_sheet": True}})
    
    return {"message": "Expense marked as unpaid"}

@api_router.put("/expenses/settle-all/{paid_by}")
async def settle_all_by_person(paid_by: str):
    """Mark all unpaid expenses for a person as paid"""
    result = await db.expenses.update_many(
        {"to_be_paid_by": paid_by, "payment_status": {"$ne": "Paid"}},
        {"$set": {"payment_status": "Paid", "paid_amount": 0, "remaining_balance": 0, "synced_to_sheet": False}}
    )
    
    # Update paid_amount to match amount for each expense
    expenses = await db.expenses.find({"to_be_paid_by": paid_by}, {"_id": 0}).to_list(10000)
    for expense in expenses:
        await db.expenses.update_one(
            {"id": expense["id"]},
            {"$set": {"paid_amount": expense["amount"], "remaining_balance": 0}}
        )
    
    return {"message": f"Settled all for {paid_by}", "updated_count": result.modified_count}

@api_router.delete("/expenses/delete-all/{paid_by}")
async def delete_all_by_person(paid_by: str):
    """Delete all expenses for a person"""
    # Get expenses to delete from sheet
    expenses = await db.expenses.find({"to_be_paid_by": paid_by}, {"_id": 0}).to_list(10000)
    
    for expense in expenses:
        if expense.get("sheet_row_number"):
            await delete_sheet_row(expense["sheet_row_number"])
    
    result = await db.expenses.delete_many({"to_be_paid_by": paid_by})
    
    return {"message": f"Deleted all for {paid_by}", "deleted_count": result.deleted_count}

# Sync endpoints
@api_router.post("/sync/bulk")
async def sync_bulk_expenses(sync_data: SyncRequest):
    """Sync multiple expenses from offline storage"""
    synced_count = 0
    failed_ids = []
    
    for i, expense_data in enumerate(sync_data.expenses):
        try:
            local_id = sync_data.local_ids[i] if i < len(sync_data.local_ids) else None
            
            # Check if already exists (prevent duplicates)
            if local_id:
                existing = await db.expenses.find_one({"id": local_id})
                if existing:
                    continue
            
            serial_number = await get_next_serial_number()
            now = datetime.now(timezone.utc)
            
            remaining_balance = expense_data.amount - expense_data.paid_amount
            payment_status = calculate_payment_status(expense_data.amount, expense_data.paid_amount)
            
            expense = Expense(
                id=local_id or str(uuid.uuid4()),
                **expense_data.model_dump(),
                serial_number=serial_number,
                remaining_balance=remaining_balance,
                payment_status=payment_status,
                created_timestamp=now.isoformat(),
                snapshot_month=get_current_month(),
                synced_to_sheet=False
            )
            
            doc = expense.model_dump()
            await db.expenses.insert_one(doc)
            
            # Sync to sheet
            row_number = await sync_expense_to_sheet(doc)
            if row_number:
                await db.expenses.update_one(
                    {"id": expense.id},
                    {"$set": {"synced_to_sheet": True, "sheet_row_number": row_number}}
                )
            
            synced_count += 1
        except Exception as e:
            logger.error(f"Error syncing expense: {e}")
            if i < len(sync_data.local_ids):
                failed_ids.append(sync_data.local_ids[i])
    
    return {
        "synced_count": synced_count,
        "failed_ids": failed_ids,
        "message": f"Synced {synced_count} expenses"
    }

@api_router.get("/sync/unsynced")
async def get_unsynced_expenses():
    """Get all expenses not yet synced to Google Sheets"""
    expenses = await db.expenses.find(
        {"synced_to_sheet": False}, {"_id": 0}
    ).to_list(1000)
    return {"count": len(expenses), "expenses": expenses}

@api_router.post("/sync/force")
async def force_sync_all():
    """Force sync all unsynced expenses to Google Sheets"""
    unsynced = await db.expenses.find({"synced_to_sheet": False}, {"_id": 0}).to_list(1000)
    synced_count = 0
    
    for expense in unsynced:
        if expense.get("sheet_row_number"):
            success = await update_sheet_row(expense["sheet_row_number"], expense)
        else:
            row_number = await sync_expense_to_sheet(expense)
            success = row_number is not None
            if success:
                await db.expenses.update_one(
                    {"id": expense["id"]},
                    {"$set": {"sheet_row_number": row_number}}
                )
        
        if success:
            await db.expenses.update_one(
                {"id": expense["id"]},
                {"$set": {"synced_to_sheet": True}}
            )
            synced_count += 1
    
    return {"synced_count": synced_count, "total_unsynced": len(unsynced)}

# Analytics endpoints
@api_router.get("/analytics/summary")
async def get_analytics_summary():
    """Get financial overview analytics"""
    now = datetime.now(timezone.utc)
    current_month = now.strftime("%Y-%m")
    current_year = now.strftime("%Y")
    last_month = (now.replace(day=1) - timedelta(days=1)).strftime("%Y-%m") if now.month > 1 else f"{now.year-1}-12"
    
    # All time totals
    all_expenses = await db.expenses.find({}, {"_id": 0}).to_list(10000)
    
    total_expense = sum(e.get("amount", 0) for e in all_expenses)
    total_paid = sum(e.get("paid_amount", 0) for e in all_expenses)
    total_unpaid = sum(e.get("remaining_balance", 0) for e in all_expenses)
    
    # Current month
    current_month_expenses = [e for e in all_expenses if e.get("snapshot_month") == current_month]
    current_month_total = sum(e.get("amount", 0) for e in current_month_expenses)
    
    # Current year
    current_year_expenses = [e for e in all_expenses if e.get("snapshot_month", "").startswith(current_year)]
    current_year_total = sum(e.get("amount", 0) for e in current_year_expenses)
    
    # Last month for trend
    last_month_expenses = [e for e in all_expenses if e.get("snapshot_month") == last_month]
    last_month_total = sum(e.get("amount", 0) for e in last_month_expenses)
    
    # Calculate trend
    trend_percentage = 0
    trend_direction = "neutral"
    if last_month_total > 0:
        trend_percentage = ((current_month_total - last_month_total) / last_month_total) * 100
        trend_direction = "down" if trend_percentage < 0 else "up" if trend_percentage > 0 else "neutral"
    
    # Average daily spend this month
    days_in_month = now.day
    avg_daily_spend = current_month_total / days_in_month if days_in_month > 0 else 0
    
    return {
        "total_expense": total_expense,
        "total_paid": total_paid,
        "total_unpaid": total_unpaid,
        "current_month_expense": current_month_total,
        "current_year_expense": current_year_total,
        "last_month_expense": last_month_total,
        "trend_percentage": round(trend_percentage, 1),
        "trend_direction": trend_direction,
        "avg_daily_spend": round(avg_daily_spend, 2),
        "current_month": current_month,
        "expense_count": len(all_expenses)
    }

@api_router.get("/analytics/settlement")
async def get_settlement_summary():
    """Get settlement summary by who needs to pay"""
    all_expenses = await db.expenses.find({}, {"_id": 0}).to_list(10000)
    
    settlement = {
        "mom_owes": 0,
        "dad_owes": 0,
        "i_owe": 0,
        "others_owe": 0,
        "total_settled": 0
    }
    
    for expense in all_expenses:
        remaining = expense.get("remaining_balance", 0)
        paid_by = expense.get("to_be_paid_by", "Me")
        paid_amount = expense.get("paid_amount", 0)
        
        if paid_by == "Mom":
            settlement["mom_owes"] += remaining
        elif paid_by == "Dad":
            settlement["dad_owes"] += remaining
        elif paid_by == "Others":
            settlement["others_owe"] += remaining
        else:
            settlement["i_owe"] += remaining
        
        settlement["total_settled"] += paid_amount
    
    return settlement

@api_router.get("/analytics/category-breakdown")
async def get_category_breakdown(month: Optional[str] = None, year: Optional[str] = None):
    """Get expense breakdown by category"""
    query = {}
    if month and year:
        query["snapshot_month"] = f"{year}-{month.zfill(2)}"
    elif year:
        query["snapshot_month"] = {"$regex": f"^{year}"}
    
    expenses = await db.expenses.find(query, {"_id": 0}).to_list(10000)
    
    breakdown = {}
    for expense in expenses:
        category = expense.get("category", "Other")
        if category not in breakdown:
            breakdown[category] = {"total": 0, "paid": 0, "unpaid": 0, "count": 0}
        breakdown[category]["total"] += expense.get("amount", 0)
        breakdown[category]["paid"] += expense.get("paid_amount", 0)
        breakdown[category]["unpaid"] += expense.get("remaining_balance", 0)
        breakdown[category]["count"] += 1
    
    return breakdown

@api_router.get("/analytics/monthly-trend")
async def get_monthly_trend(months: int = 12):
    """Get monthly expense trend for the last N months"""
    all_expenses = await db.expenses.find({}, {"_id": 0}).to_list(10000)
    
    # Group by month
    monthly_data = {}
    for expense in all_expenses:
        month = expense.get("snapshot_month", "")
        if month not in monthly_data:
            monthly_data[month] = {"total": 0, "paid": 0, "unpaid": 0}
        monthly_data[month]["total"] += expense.get("amount", 0)
        monthly_data[month]["paid"] += expense.get("paid_amount", 0)
        monthly_data[month]["unpaid"] += expense.get("remaining_balance", 0)
    
    # Sort by month and get last N months
    sorted_months = sorted(monthly_data.keys(), reverse=True)[:months]
    
    return {month: monthly_data[month] for month in sorted(sorted_months)}

@api_router.get("/analytics/fixed-vs-variable")
async def get_fixed_vs_variable(month: Optional[str] = None, year: Optional[str] = None):
    """Get breakdown of fixed vs variable expenses"""
    query = {}
    if month and year:
        query["snapshot_month"] = f"{year}-{month.zfill(2)}"
    elif year:
        query["snapshot_month"] = {"$regex": f"^{year}"}
    
    expenses = await db.expenses.find(query, {"_id": 0}).to_list(10000)
    
    fixed_total = sum(e.get("amount", 0) for e in expenses if e.get("is_fixed"))
    variable_total = sum(e.get("amount", 0) for e in expenses if not e.get("is_fixed"))
    
    return {
        "fixed": {"total": fixed_total, "count": sum(1 for e in expenses if e.get("is_fixed"))},
        "variable": {"total": variable_total, "count": sum(1 for e in expenses if not e.get("is_fixed"))}
    }

# Snapshot endpoints
@api_router.post("/snapshots/create")
async def create_monthly_snapshot(month: str):
    """Create a monthly snapshot (format: YYYY-MM)"""
    # Check if snapshot already exists
    existing = await db.snapshots.find_one({"month": month})
    if existing:
        raise HTTPException(status_code=400, detail="Snapshot already exists for this month")
    
    # Get all expenses for this month
    expenses = await db.expenses.find({"snapshot_month": month}, {"_id": 0}).to_list(10000)
    
    if not expenses:
        raise HTTPException(status_code=400, detail="No expenses found for this month")
    
    total_expense = sum(e.get("amount", 0) for e in expenses)
    total_paid = sum(e.get("paid_amount", 0) for e in expenses)
    total_unpaid = sum(e.get("remaining_balance", 0) for e in expenses)
    
    # Category breakdown
    category_breakdown = {}
    for expense in expenses:
        category = expense.get("category", "Other")
        if category not in category_breakdown:
            category_breakdown[category] = 0
        category_breakdown[category] += expense.get("amount", 0)
    
    snapshot = MonthlySnapshot(
        month=month,
        total_expense=total_expense,
        total_paid=total_paid,
        total_unpaid=total_unpaid,
        category_breakdown=category_breakdown,
        created_at=datetime.now(timezone.utc).isoformat()
    )
    
    await db.snapshots.insert_one(snapshot.model_dump())
    return snapshot

@api_router.get("/snapshots", response_model=List[MonthlySnapshot])
async def get_snapshots():
    """Get all monthly snapshots"""
    snapshots = await db.snapshots.find({}, {"_id": 0}).sort("month", -1).to_list(100)
    return snapshots

@api_router.get("/snapshots/{month}", response_model=MonthlySnapshot)
async def get_snapshot(month: str):
    """Get a specific monthly snapshot"""
    snapshot = await db.snapshots.find_one({"month": month}, {"_id": 0})
    if not snapshot:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return snapshot

# Tags endpoint
@api_router.get("/tags")
async def get_all_tags():
    """Get all unique tags used across expenses"""
    expenses = await db.expenses.find({}, {"tags": 1, "_id": 0}).to_list(10000)
    
    tags_set = set()
    for expense in expenses:
        tags = expense.get("tags", "")
        if tags:
            for tag in tags.split(","):
                tag = tag.strip()
                if tag:
                    tags_set.add(tag)
    
    return {"tags": sorted(list(tags_set))}

# Health check
@api_router.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        # Test MongoDB connection
        await db.command("ping")
        mongo_status = "healthy"
    except Exception:
        mongo_status = "unhealthy"
    
    # Test Google Sheets connection
    try:
        service = get_sheets_service()
        sheet_status = "healthy"
    except Exception:
        sheet_status = "unhealthy"
    
    return {
        "status": "healthy" if mongo_status == "healthy" else "unhealthy",
        "mongodb": mongo_status,
        "google_sheets": sheet_status,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import timedelta for analytics
from datetime import timedelta

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
