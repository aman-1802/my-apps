// IndexedDB utility for offline expense storage

const DB_NAME = 'ExpenseTrackerDB';
const DB_VERSION = 1;
const STORES = {
  EXPENSES: 'expenses',
  SYNC_QUEUE: 'syncQueue',
  SETTINGS: 'settings'
};

let dbInstance = null;

export const initDB = () => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB');
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Expenses store
      if (!db.objectStoreNames.contains(STORES.EXPENSES)) {
        const expenseStore = db.createObjectStore(STORES.EXPENSES, { keyPath: 'id' });
        expenseStore.createIndex('date', 'date', { unique: false });
        expenseStore.createIndex('category', 'category', { unique: false });
        expenseStore.createIndex('synced', 'synced', { unique: false });
        expenseStore.createIndex('snapshot_month', 'snapshot_month', { unique: false });
      }

      // Sync queue store
      if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
        syncStore.createIndex('action', 'action', { unique: false });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
      }

      // Settings store
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
    };
  });
};

// Generate UUID
export const generateId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Expense operations
export const addExpense = async (expense) => {
  const db = await initDB();
  const id = expense.id || generateId();
  const now = new Date().toISOString();
  
  const expenseData = {
    ...expense,
    id,
    synced: false,
    created_timestamp: expense.created_timestamp || now,
    snapshot_month: expense.snapshot_month || now.slice(0, 7),
    remaining_balance: expense.amount - (expense.paid_amount || 0),
    payment_status: calculatePaymentStatus(expense.amount, expense.paid_amount || 0)
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.EXPENSES, STORES.SYNC_QUEUE], 'readwrite');
    const expenseStore = transaction.objectStore(STORES.EXPENSES);
    const syncStore = transaction.objectStore(STORES.SYNC_QUEUE);

    const expenseRequest = expenseStore.put(expenseData);
    
    expenseRequest.onsuccess = () => {
      // Add to sync queue
      syncStore.put({
        id: generateId(),
        expense_id: id,
        action: 'create',
        data: expenseData,
        timestamp: now
      });
      resolve(expenseData);
    };

    expenseRequest.onerror = () => reject(expenseRequest.error);
  });
};

export const updateExpense = async (id, updates) => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.EXPENSES, STORES.SYNC_QUEUE], 'readwrite');
    const expenseStore = transaction.objectStore(STORES.EXPENSES);
    const syncStore = transaction.objectStore(STORES.SYNC_QUEUE);

    const getRequest = expenseStore.get(id);
    
    getRequest.onsuccess = () => {
      const expense = getRequest.result;
      if (!expense) {
        reject(new Error('Expense not found'));
        return;
      }

      const updatedExpense = {
        ...expense,
        ...updates,
        synced: false,
        remaining_balance: (updates.amount || expense.amount) - (updates.paid_amount ?? expense.paid_amount),
        payment_status: calculatePaymentStatus(
          updates.amount || expense.amount,
          updates.paid_amount ?? expense.paid_amount
        )
      };

      const putRequest = expenseStore.put(updatedExpense);
      
      putRequest.onsuccess = () => {
        // Add to sync queue
        syncStore.put({
          id: generateId(),
          expense_id: id,
          action: 'update',
          data: updatedExpense,
          timestamp: new Date().toISOString()
        });
        resolve(updatedExpense);
      };

      putRequest.onerror = () => reject(putRequest.error);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
};

export const deleteExpense = async (id) => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORES.EXPENSES, STORES.SYNC_QUEUE], 'readwrite');
    const expenseStore = transaction.objectStore(STORES.EXPENSES);
    const syncStore = transaction.objectStore(STORES.SYNC_QUEUE);

    const getRequest = expenseStore.get(id);
    
    getRequest.onsuccess = () => {
      const expense = getRequest.result;
      
      const deleteRequest = expenseStore.delete(id);
      
      deleteRequest.onsuccess = () => {
        if (expense && expense.synced) {
          // Only add to sync queue if it was synced
          syncStore.put({
            id: generateId(),
            expense_id: id,
            action: 'delete',
            data: expense,
            timestamp: new Date().toISOString()
          });
        }
        resolve();
      };

      deleteRequest.onerror = () => reject(deleteRequest.error);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
};

export const getAllExpenses = async (filters = {}) => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.EXPENSES, 'readonly');
    const store = transaction.objectStore(STORES.EXPENSES);
    const request = store.getAll();

    request.onsuccess = () => {
      let expenses = request.result || [];
      
      // Apply filters
      if (filters.month && filters.year) {
        expenses = expenses.filter(e => e.snapshot_month === `${filters.year}-${filters.month.padStart(2, '0')}`);
      } else if (filters.year) {
        expenses = expenses.filter(e => e.snapshot_month?.startsWith(filters.year));
      } else if (filters.month) {
        expenses = expenses.filter(e => e.snapshot_month?.endsWith(`-${filters.month.padStart(2, '0')}`));
      }
      
      if (filters.category) {
        expenses = expenses.filter(e => e.category === filters.category);
      }
      
      if (filters.payment_status) {
        expenses = expenses.filter(e => e.payment_status === filters.payment_status);
      }
      
      if (filters.to_be_paid_by) {
        expenses = expenses.filter(e => e.to_be_paid_by === filters.to_be_paid_by);
      }
      
      if (filters.is_fixed !== undefined) {
        expenses = expenses.filter(e => e.is_fixed === filters.is_fixed);
      }
      
      if (filters.tag) {
        expenses = expenses.filter(e => e.tags?.toLowerCase().includes(filters.tag.toLowerCase()));
      }
      
      // Sort by date descending
      expenses.sort((a, b) => new Date(b.created_timestamp) - new Date(a.created_timestamp));
      
      resolve(expenses);
    };

    request.onerror = () => reject(request.error);
  });
};

export const getExpenseById = async (id) => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.EXPENSES, 'readonly');
    const store = transaction.objectStore(STORES.EXPENSES);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getUnsyncedExpenses = async () => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.EXPENSES, 'readonly');
    const store = transaction.objectStore(STORES.EXPENSES);
    const index = store.index('synced');
    const request = index.getAll(false);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

// Sync queue operations
export const getSyncQueue = async () => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SYNC_QUEUE, 'readonly');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const request = store.getAll();

    request.onsuccess = () => {
      const items = request.result || [];
      items.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      resolve(items);
    };
    request.onerror = () => reject(request.error);
  });
};

export const clearSyncQueue = async () => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const removeSyncQueueItem = async (id) => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const markExpenseAsSynced = async (id) => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.EXPENSES, 'readwrite');
    const store = transaction.objectStore(STORES.EXPENSES);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const expense = getRequest.result;
      if (expense) {
        expense.synced = true;
        const putRequest = store.put(expense);
        putRequest.onsuccess = () => resolve(expense);
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve(null);
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
};

// Settings operations
export const getSetting = async (key) => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SETTINGS, 'readonly');
    const store = transaction.objectStore(STORES.SETTINGS);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result?.value);
    request.onerror = () => reject(request.error);
  });
};

export const setSetting = async (key, value) => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.SETTINGS, 'readwrite');
    const store = transaction.objectStore(STORES.SETTINGS);
    const request = store.put({ key, value });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Bulk operations for syncing with server
export const bulkUpdateExpenses = async (expenses) => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.EXPENSES, 'readwrite');
    const store = transaction.objectStore(STORES.EXPENSES);

    let completed = 0;
    const total = expenses.length;

    if (total === 0) {
      resolve();
      return;
    }

    expenses.forEach((expense) => {
      const request = store.put({ ...expense, synced: true });
      
      request.onsuccess = () => {
        completed++;
        if (completed === total) {
          resolve();
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  });
};

// Helper function
const calculatePaymentStatus = (amount, paidAmount) => {
  if (paidAmount >= amount) return 'Paid';
  if (paidAmount > 0) return 'Partially Paid';
  return 'Unpaid';
};

// Get analytics data from local storage
export const getLocalAnalytics = async () => {
  const expenses = await getAllExpenses();
  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7);
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);
  
  const totalExpense = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalPaid = expenses.reduce((sum, e) => sum + (e.paid_amount || 0), 0);
  const totalUnpaid = expenses.reduce((sum, e) => sum + (e.remaining_balance || 0), 0);
  
  const currentMonthExpenses = expenses.filter(e => e.snapshot_month === currentMonth);
  const currentMonthTotal = currentMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  
  const lastMonthExpenses = expenses.filter(e => e.snapshot_month === lastMonth);
  const lastMonthTotal = lastMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  
  const trendPercentage = lastMonthTotal > 0 
    ? ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100 
    : 0;
  
  const avgDailySpend = now.getDate() > 0 ? currentMonthTotal / now.getDate() : 0;
  
  return {
    total_expense: totalExpense,
    total_paid: totalPaid,
    total_unpaid: totalUnpaid,
    current_month_expense: currentMonthTotal,
    last_month_expense: lastMonthTotal,
    trend_percentage: Math.round(trendPercentage * 10) / 10,
    trend_direction: trendPercentage < 0 ? 'down' : trendPercentage > 0 ? 'up' : 'neutral',
    avg_daily_spend: Math.round(avgDailySpend * 100) / 100,
    expense_count: expenses.length
  };
};

export const getLocalSettlement = async () => {
  const expenses = await getAllExpenses();
  
  const settlement = {
    mom_owes: 0,
    dad_owes: 0,
    i_owe: 0,
    others_owe: 0,
    total_settled: 0
  };
  
  expenses.forEach(expense => {
    const remaining = expense.remaining_balance || 0;
    const paidBy = expense.to_be_paid_by || 'Me';
    const paidAmount = expense.paid_amount || 0;
    
    if (paidBy === 'Mom') settlement.mom_owes += remaining;
    else if (paidBy === 'Dad') settlement.dad_owes += remaining;
    else if (paidBy === 'Others') settlement.others_owe += remaining;
    else settlement.i_owe += remaining;
    
    settlement.total_settled += paidAmount;
  });
  
  return settlement;
};

export const getLocalCategoryBreakdown = async () => {
  const expenses = await getAllExpenses();
  
  const breakdown = {};
  expenses.forEach(expense => {
    const category = expense.category || 'Other';
    if (!breakdown[category]) {
      breakdown[category] = { total: 0, paid: 0, unpaid: 0, count: 0 };
    }
    breakdown[category].total += expense.amount || 0;
    breakdown[category].paid += expense.paid_amount || 0;
    breakdown[category].unpaid += expense.remaining_balance || 0;
    breakdown[category].count += 1;
  });
  
  return breakdown;
};

export const getLocalMonthlyTrend = async () => {
  const expenses = await getAllExpenses();
  
  const monthlyData = {};
  expenses.forEach(expense => {
    const month = expense.snapshot_month || '';
    if (!monthlyData[month]) {
      monthlyData[month] = { total: 0, paid: 0, unpaid: 0 };
    }
    monthlyData[month].total += expense.amount || 0;
    monthlyData[month].paid += expense.paid_amount || 0;
    monthlyData[month].unpaid += expense.remaining_balance || 0;
  });
  
  return monthlyData;
};
