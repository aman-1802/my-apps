import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { syncToServer, getUnsyncedCount, forceSync, getNetworkStatus } from '@/lib/api';
import { toast } from 'sonner';

const SyncContext = createContext();

export const useSync = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
};

export const SyncProvider = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(() => {
    return localStorage.getItem('lastSyncTime');
  });
  const [unsyncedCount, setUnsyncedCount] = useState(0);

  // Update online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online', { duration: 2000 });
      // Auto-sync when coming back online
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You are offline', { 
        description: 'Changes will be saved locally',
        duration: 3000 
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update unsynced count periodically
  useEffect(() => {
    const updateUnsyncedCount = async () => {
      const count = await getUnsyncedCount();
      setUnsyncedCount(count);
    };

    updateUnsyncedCount();
    const interval = setInterval(updateUnsyncedCount, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, []);

  const triggerSync = useCallback(async () => {
    if (!isOnline || isSyncing) return;

    setIsSyncing(true);
    try {
      const result = await syncToServer();
      if (result.success) {
        const now = new Date().toISOString();
        setLastSyncTime(now);
        localStorage.setItem('lastSyncTime', now);
        
        const count = await getUnsyncedCount();
        setUnsyncedCount(count);
        
        if (result.synced > 0) {
          toast.success(`Synced ${result.synced} expense(s)`, { duration: 2000 });
        }
      }
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing]);

  const triggerForceSync = useCallback(async () => {
    if (!isOnline) {
      toast.error('Cannot sync while offline');
      return { success: false };
    }

    setIsSyncing(true);
    try {
      const result = await forceSync();
      if (result.success) {
        const now = new Date().toISOString();
        setLastSyncTime(now);
        localStorage.setItem('lastSyncTime', now);
        
        const count = await getUnsyncedCount();
        setUnsyncedCount(count);
        
        toast.success('Force sync complete', { 
          description: `Synced ${result.synced_count || 0} expenses to Google Sheets`,
          duration: 3000 
        });
      } else {
        toast.error('Sync failed', { description: result.message });
      }
      return result;
    } catch (error) {
      console.error('Force sync failed:', error);
      toast.error('Sync failed', { description: error.message });
      return { success: false, message: error.message };
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline]);

  // Auto-sync every 5 minutes when online
  useEffect(() => {
    if (!isOnline) return;

    const interval = setInterval(() => {
      triggerSync();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [isOnline, triggerSync]);

  const value = {
    isOnline,
    isSyncing,
    lastSyncTime,
    unsyncedCount,
    triggerSync,
    triggerForceSync,
    setUnsyncedCount
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
};
