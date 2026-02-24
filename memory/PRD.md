# PWA Expense Tracker - Product Requirements Document

## Overview
A modern, mobile-first Progressive Web App (PWA) expense tracking system optimized for iPhone Safari with offline support and Google Sheets synchronization.

## User Personas
- **Primary User**: Single personal user tracking daily expenses on iPhone
- **Use Case**: Track expenses, partial payments, settlements between family members (Mom, Dad, Me)

## Core Requirements

### 1. PWA Features (IMPLEMENTED)
- ✅ Offline-first with IndexedDB storage
- ✅ Service Worker for caching
- ✅ Manifest.json for "Add to Home Screen"
- ✅ Auto-sync when online
- ✅ Sync status indicator (Online/Offline/Last Synced)

### 2. Expense Management (IMPLEMENTED)
- ✅ Create/Edit/Delete expenses
- ✅ Fields: Date, Title, Amount, Category, To Be Paid By, Paid Amount, Tags, Fixed/Variable, Remark
- ✅ Auto-calculated: Remaining Balance, Payment Status
- ✅ Categories: Food, Rent, Subscriptions, Dinner, Blinkit, Travel, Utilities, Shopping, Other

### 3. Partial Payment System (IMPLEMENTED)
- ✅ Track paid amount vs total
- ✅ Auto-calculate remaining balance
- ✅ Payment Status: Paid, Partially Paid, Unpaid

### 4. Settlement Dashboard (IMPLEMENTED)
- ✅ Mom Owes total
- ✅ Dad Owes total
- ✅ I Owe total
- ✅ Total Settled

### 5. Analytics Dashboard (IMPLEMENTED)
- ✅ Financial Overview (Total, Monthly, Yearly)
- ✅ Spending Trend Indicator (vs last month)
- ✅ Average Daily Spend
- ✅ Category Distribution (Pie Chart)
- ✅ Monthly Trend (Line Chart)
- ✅ Paid vs Unpaid (Bar Chart)
- ✅ Fixed vs Variable (Bar Chart)

### 6. Swipe Gestures (IMPLEMENTED)
- ✅ Swipe Right → Mark Paid
- ✅ Swipe Left → Delete
- ✅ Swipe Half → Edit

### 7. Filter System (IMPLEMENTED)
- ✅ Filter by Month, Year, Category, Status, Paid By, Type, Tags
- ✅ Collapsible filter panel

### 8. Dark Mode (IMPLEMENTED)
- ✅ OLED-friendly true black background
- ✅ System auto-detect
- ✅ Manual toggle

### 9. Google Sheets Integration (IMPLEMENTED)
- ✅ Service Account authentication
- ✅ Real-time row insertion when online
- ✅ Background sync on reconnection
- ✅ Proper column mapping

### 10. Monthly Snapshots (IMPLEMENTED)
- ✅ Archive monthly data
- ✅ Lock historical data
- ✅ Store totals and breakdown

## Architecture

### Backend (FastAPI)
- `/app/backend/server.py` - Main API
- MongoDB for data storage
- Google Sheets API for cloud sync

### Frontend (React)
- `/app/frontend/src/` - React components
- IndexedDB for offline storage
- Service Worker for PWA

## What's Been Implemented (Feb 24, 2026)
- Full PWA setup with service worker
- Complete expense CRUD with offline support
- Settlement summary dashboard
- Analytics with charts
- Swipe gestures for expense items
- Filter panel with all options
- Dark mode with OLED support
- Google Sheets integration (Service Account)
- Monthly snapshot system

## Prioritized Backlog

### P0 (Done)
- ✅ Core expense tracking
- ✅ Offline support
- ✅ Google Sheets sync
- ✅ Settlement dashboard
- ✅ Analytics charts

### P1 (Next)
- Export to CSV/PDF
- Expense receipt image upload
- Budget limits per category
- Push notifications for payment reminders

### P2 (Future)
- Multi-currency support
- Recurring expense automation
- Data import from bank statements
- Shared expense splitting

## Next Tasks
1. Test Google Sheets sync in production
2. Add expense receipt image upload
3. Implement budget limits with alerts
4. Add export functionality
