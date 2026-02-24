// API utility for expense tracker
import * as db from './indexedDB';

const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Network status
let isOnline = navigator.onLine;
let lastSyncTime = null;

// Update online status
window.addEventListener('online', () => {
  isOnline = true;
  // Trigger sync when coming back online
  syncToServer();
});

window.addEventListener('offline', () => {
  isOnline = false;
});

export const getNetworkStatus = () => ({
  isOnline,
  lastSyncTime
});

// API request wrapper with offline fallback
const apiRequest = async (method, endpoint, data = null) => {
  const url = `${API_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (data && (method === 'POST' || method === 'PUT')) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

// Expense API functions
export const createExpense = async (expenseData) => {
  // Always save locally first
  const localExpense = await db.addExpense(expenseData);
  
  if (isOnline) {
    try {
      const serverExpense = await apiRequest('POST', '/expenses', expenseData);
      // Update local with server data
      await db.updateExpense(localExpense.id, { ...serverExpense, synced: true });
      return serverExpense;
    } catch (error) {
      console.log('Failed to sync to server, saved locally');
      return localExpense;
    }
  }
  
  return localExpense;
};

export const getExpenses = async (filters = {}) => {
  // Try to get from server first if online
  if (isOnline) {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value);
        }
      });
      
      const endpoint = queryParams.toString() ? `/expenses?${queryParams}` : '/expenses';
      const serverExpenses = await apiRequest('GET', endpoint);
      
      // Update local storage with server data
      await db.bulkUpdateExpenses(serverExpenses);
      
      return serverExpenses;
    } catch (error) {
      console.log('Failed to fetch from server, using local data');
    }
  }
  
  // Fallback to local data
  return db.getAllExpenses(filters);
};

export const getExpenseById = async (id) => {
  if (isOnline) {
    try {
      return await apiRequest('GET', `/expenses/${id}`);
    } catch (error) {
      console.log('Failed to fetch from server, using local data');
    }
  }
  
  return db.getExpenseById(id);
};

export const updateExpense = async (id, updates) => {
  // Update locally first
  const localExpense = await db.updateExpense(id, updates);
  
  if (isOnline) {
    try {
      const serverExpense = await apiRequest('PUT', `/expenses/${id}`, updates);
      await db.updateExpense(id, { ...serverExpense, synced: true });
      return serverExpense;
    } catch (error) {
      console.log('Failed to sync update to server');
      return localExpense;
    }
  }
  
  return localExpense;
};

export const deleteExpense = async (id) => {
  // Delete locally
  await db.deleteExpense(id);
  
  if (isOnline) {
    try {
      await apiRequest('DELETE', `/expenses/${id}`);
    } catch (error) {
      console.log('Failed to delete from server, will sync later');
    }
  }
};

export const markExpensePaid = async (id) => {
  const expense = await db.getExpenseById(id);
  if (!expense) return null;
  
  const updates = {
    paid_amount: expense.amount,
    remaining_balance: 0,
    payment_status: 'Paid'
  };
  
  return updateExpense(id, updates);
};

export const markExpenseUnpaid = async (id) => {
  const updates = {
    paid_amount: 0,
    remaining_balance: null, // Will be recalculated
    payment_status: 'Unpaid'
  };
  
  // Get expense to recalculate
  const expense = await db.getExpenseById(id);
  if (expense) {
    updates.remaining_balance = expense.amount;
  }
  
  return updateExpense(id, updates);
};

export const settleAllByPerson = async (paidBy) => {
  if (!isOnline) {
    // Offline: update locally
    const expenses = await db.getAllExpenses({ to_be_paid_by: paidBy });
    let count = 0;
    for (const exp of expenses) {
      if (exp.payment_status !== 'Paid') {
        await db.updateExpense(exp.id, {
          paid_amount: exp.amount,
          remaining_balance: 0,
          payment_status: 'Paid'
        });
        count++;
      }
    }
    return { updated_count: count };
  }
  
  try {
    return await apiRequest('PUT', `/expenses/settle-all/${paidBy}`);
  } catch (error) {
    console.log('Failed to settle all on server');
    throw error;
  }
};

export const deleteAllByPerson = async (paidBy) => {
  if (!isOnline) {
    const expenses = await db.getAllExpenses({ to_be_paid_by: paidBy });
    let count = 0;
    for (const exp of expenses) {
      await db.deleteExpense(exp.id);
      count++;
    }
    return { deleted_count: count };
  }
  
  try {
    return await apiRequest('DELETE', `/expenses/delete-all/${paidBy}`);
  } catch (error) {
    console.log('Failed to delete all on server');
    throw error;
  }
};

// Sync functions
export const syncToServer = async () => {
  if (!isOnline) {
    return { success: false, message: 'Offline' };
  }

  try {
    const syncQueue = await db.getSyncQueue();
    
    if (syncQueue.length === 0) {
      lastSyncTime = new Date().toISOString();
      return { success: true, synced: 0 };
    }

    let syncedCount = 0;
    
    for (const item of syncQueue) {
      try {
        if (item.action === 'create') {
          await apiRequest('POST', '/expenses', item.data);
          await db.markExpenseAsSynced(item.expense_id);
        } else if (item.action === 'update') {
          await apiRequest('PUT', `/expenses/${item.expense_id}`, item.data);
          await db.markExpenseAsSynced(item.expense_id);
        } else if (item.action === 'delete') {
          await apiRequest('DELETE', `/expenses/${item.expense_id}`);
        }
        
        await db.removeSyncQueueItem(item.id);
        syncedCount++;
      } catch (error) {
        console.error('Failed to sync item:', item, error);
      }
    }

    lastSyncTime = new Date().toISOString();
    return { success: true, synced: syncedCount };
  } catch (error) {
    console.error('Sync failed:', error);
    return { success: false, message: error.message };
  }
};

export const forceSync = async () => {
  if (!isOnline) {
    return { success: false, message: 'Offline' };
  }

  try {
    // First sync local changes
    await syncToServer();
    
    // Then call server force sync
    const result = await apiRequest('POST', '/sync/force');
    lastSyncTime = new Date().toISOString();
    
    return { success: true, ...result };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

export const getUnsyncedCount = async () => {
  const queue = await db.getSyncQueue();
  return queue.length;
};

// Analytics functions
export const getAnalyticsSummary = async () => {
  if (isOnline) {
    try {
      return await apiRequest('GET', '/analytics/summary');
    } catch (error) {
      console.log('Failed to fetch analytics from server');
    }
  }
  
  return db.getLocalAnalytics();
};

export const getSettlementSummary = async () => {
  if (isOnline) {
    try {
      return await apiRequest('GET', '/analytics/settlement');
    } catch (error) {
      console.log('Failed to fetch settlement from server');
    }
  }
  
  return db.getLocalSettlement();
};

export const getCategoryBreakdown = async (month, year) => {
  if (isOnline) {
    try {
      const params = new URLSearchParams();
      if (month) params.append('month', month);
      if (year) params.append('year', year);
      const endpoint = params.toString() ? `/analytics/category-breakdown?${params}` : '/analytics/category-breakdown';
      return await apiRequest('GET', endpoint);
    } catch (error) {
      console.log('Failed to fetch category breakdown from server');
    }
  }
  
  return db.getLocalCategoryBreakdown();
};

export const getMonthlyTrend = async (months = 12) => {
  if (isOnline) {
    try {
      return await apiRequest('GET', `/analytics/monthly-trend?months=${months}`);
    } catch (error) {
      console.log('Failed to fetch monthly trend from server');
    }
  }
  
  return db.getLocalMonthlyTrend();
};

export const getFixedVsVariable = async (month, year) => {
  if (isOnline) {
    try {
      const params = new URLSearchParams();
      if (month) params.append('month', month);
      if (year) params.append('year', year);
      const endpoint = params.toString() ? `/analytics/fixed-vs-variable?${params}` : '/analytics/fixed-vs-variable';
      return await apiRequest('GET', endpoint);
    } catch (error) {
      console.log('Failed to fetch fixed vs variable from server');
    }
  }
  
  // Local fallback
  const expenses = await db.getAllExpenses();
  const fixed = expenses.filter(e => e.is_fixed);
  const variable = expenses.filter(e => !e.is_fixed);
  
  return {
    fixed: { total: fixed.reduce((sum, e) => sum + e.amount, 0), count: fixed.length },
    variable: { total: variable.reduce((sum, e) => sum + e.amount, 0), count: variable.length }
  };
};

// Categories
export const getCategories = async () => {
  if (isOnline) {
    try {
      const result = await apiRequest('GET', '/categories');
      return result.categories;
    } catch (error) {
      console.log('Failed to fetch categories from server');
    }
  }
  
  return ['Food', 'Rent', 'Subscriptions', 'Dinner', 'Blinkit', 'Travel', 'Utilities', 'Shopping', 'Other'];
};

// Tags
export const getAllTags = async () => {
  if (isOnline) {
    try {
      const result = await apiRequest('GET', '/tags');
      return result.tags;
    } catch (error) {
      console.log('Failed to fetch tags from server');
    }
  }
  
  // Get from local
  const expenses = await db.getAllExpenses();
  const tags = new Set();
  expenses.forEach(e => {
    if (e.tags) {
      e.tags.split(',').forEach(tag => {
        const t = tag.trim();
        if (t) tags.add(t);
      });
    }
  });
  
  return Array.from(tags).sort();
};

// Snapshots
export const createSnapshot = async (month) => {
  if (!isOnline) {
    return { success: false, message: 'Offline - cannot create snapshot' };
  }
  
  try {
    return await apiRequest('POST', `/snapshots/create?month=${month}`);
  } catch (error) {
    return { success: false, message: error.message };
  }
};

export const getSnapshots = async () => {
  if (isOnline) {
    try {
      return await apiRequest('GET', '/snapshots');
    } catch (error) {
      console.log('Failed to fetch snapshots from server');
    }
  }
  
  return [];
};

// Health check
export const healthCheck = async () => {
  try {
    return await apiRequest('GET', '/health');
  } catch (error) {
    return { status: 'unhealthy', error: error.message };
  }
};
