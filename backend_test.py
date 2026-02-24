import requests
import sys
from datetime import datetime
import json

class ExpenseTrackerAPITester:
    def __init__(self, base_url="https://expense-tracker-3135.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json() if response.content else {}
                except:
                    response_data = {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    response_data = response.json() if response.content else {}
                    print(f"Response: {response_data}")
                except:
                    response_data = {"error": response.text}

            self.test_results.append({
                "name": name,
                "method": method,
                "endpoint": endpoint,
                "expected_status": expected_status,
                "actual_status": response.status_code,
                "success": success,
                "response": response_data
            })

            return success, response_data

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.test_results.append({
                "name": name,
                "method": method,
                "endpoint": endpoint,
                "expected_status": expected_status,
                "actual_status": "ERROR",
                "success": False,
                "error": str(e)
            })
            return False, {}

    def test_health_check(self):
        """Test health check endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "/health",
            200
        )
        return success, response

    def test_categories(self):
        """Test categories endpoint"""
        success, response = self.run_test(
            "Get Categories",
            "GET",
            "/categories",
            200
        )
        return success, response

    def test_create_expense(self):
        """Create a test expense"""
        expense_data = {
            "date": "2024-01-15",
            "title": "Test Expense",
            "amount": 100.50,
            "category": "Food",
            "to_be_paid_by": "Me",
            "paid_amount": 50.25,
            "tags": "test,api",
            "is_fixed": False,
            "remark": "API test expense"
        }
        
        success, response = self.run_test(
            "Create Expense",
            "POST",
            "/expenses",
            200,
            data=expense_data
        )
        return success, response

    def test_get_expenses(self):
        """Get all expenses"""
        success, response = self.run_test(
            "Get All Expenses",
            "GET",
            "/expenses",
            200
        )
        return success, response

    def test_analytics_summary(self):
        """Test analytics summary endpoint"""
        success, response = self.run_test(
            "Analytics Summary",
            "GET",
            "/analytics/summary",
            200
        )
        return success, response

    def test_settlement_summary(self):
        """Test settlement summary endpoint"""
        success, response = self.run_test(
            "Settlement Summary",
            "GET",
            "/analytics/settlement",
            200
        )
        return success, response

    def test_category_breakdown(self):
        """Test category breakdown endpoint"""
        success, response = self.run_test(
            "Category Breakdown",
            "GET",
            "/analytics/category-breakdown",
            200
        )
        return success, response

    def test_monthly_trend(self):
        """Test monthly trend endpoint"""
        success, response = self.run_test(
            "Monthly Trend",
            "GET",
            "/analytics/monthly-trend",
            200
        )
        return success, response

    def test_fixed_vs_variable(self):
        """Test fixed vs variable endpoint"""
        success, response = self.run_test(
            "Fixed vs Variable",
            "GET",
            "/analytics/fixed-vs-variable",
            200
        )
        return success, response

    def test_tags(self):
        """Test tags endpoint"""
        success, response = self.run_test(
            "Get All Tags",
            "GET",
            "/tags",
            200
        )
        return success, response

    def test_snapshots(self):
        """Test snapshots endpoint"""
        success, response = self.run_test(
            "Get Snapshots",
            "GET",
            "/snapshots",
            200
        )
        return success, response

def main():
    print("🚀 Starting Expense Tracker API Tests...")
    tester = ExpenseTrackerAPITester()
    
    # Test basic endpoints
    print("\n=== BASIC ENDPOINTS ===")
    health_success, health_data = tester.test_health_check()
    categories_success, _ = tester.test_categories()
    
    # Test expense CRUD
    print("\n=== EXPENSE CRUD ===")
    create_success, created_expense = tester.test_create_expense()
    get_success, expenses = tester.test_get_expenses()
    
    # Test analytics endpoints
    print("\n=== ANALYTICS ENDPOINTS ===")
    analytics_success, _ = tester.test_analytics_summary()
    settlement_success, _ = tester.test_settlement_summary()
    category_breakdown_success, _ = tester.test_category_breakdown()
    monthly_trend_success, _ = tester.test_monthly_trend()
    fixed_var_success, _ = tester.test_fixed_vs_variable()
    
    # Test other endpoints
    print("\n=== OTHER ENDPOINTS ===")
    tags_success, _ = tester.test_tags()
    snapshots_success, _ = tester.test_snapshots()
    
    # Test expense operations if creation was successful
    if create_success and created_expense.get('id'):
        expense_id = created_expense['id']
        print(f"\n=== EXPENSE OPERATIONS (ID: {expense_id}) ===")
        
        # Test get single expense
        get_single_success, _ = tester.run_test(
            "Get Single Expense",
            "GET",
            f"/expenses/{expense_id}",
            200
        )
        
        # Test update expense
        update_data = {"title": "Updated Test Expense", "amount": 150.75}
        update_success, _ = tester.run_test(
            "Update Expense",
            "PUT",
            f"/expenses/{expense_id}",
            200,
            data=update_data
        )
        
        # Test mark as paid
        mark_paid_success, _ = tester.run_test(
            "Mark Expense Paid",
            "PUT",
            f"/expenses/{expense_id}/mark-paid",
            200
        )
        
        # Test delete expense
        delete_success, _ = tester.run_test(
            "Delete Expense",
            "DELETE",
            f"/expenses/{expense_id}",
            200
        )
    
    # Print final results
    print(f"\n📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    # Check critical issues
    critical_issues = []
    if not health_success:
        critical_issues.append("Health check failed")
    if not analytics_success:
        critical_issues.append("Analytics summary failed")
    if not settlement_success:
        critical_issues.append("Settlement summary failed")
    if not create_success:
        critical_issues.append("Expense creation failed")
    
    if critical_issues:
        print(f"\n❌ Critical Issues Found:")
        for issue in critical_issues:
            print(f"  - {issue}")
    
    # Check Google Sheets integration
    if health_success and health_data:
        sheets_status = health_data.get('google_sheets', 'unknown')
        mongo_status = health_data.get('mongodb', 'unknown')
        print(f"\n🔧 System Status:")
        print(f"  - MongoDB: {mongo_status}")
        print(f"  - Google Sheets: {sheets_status}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())