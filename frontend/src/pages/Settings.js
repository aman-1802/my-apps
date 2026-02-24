import { useState, useEffect } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useSync } from "@/context/SyncContext";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Moon, Sun, RefreshCw, Cloud, CloudOff, Database, Smartphone, Info } from "lucide-react";
import { toast } from "sonner";
import { healthCheck, getSnapshots, createSnapshot } from "@/lib/api";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const Settings = () => {
  const { theme, toggleTheme, isDark } = useTheme();
  const { isOnline, isSyncing, lastSyncTime, unsyncedCount, triggerForceSync } = useSync();
  const [health, setHealth] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [healthData, snapshotsData] = await Promise.all([
          healthCheck(),
          getSnapshots()
        ]);
        setHealth(healthData);
        setSnapshots(snapshotsData);
      } catch (error) {
        console.error('Error loading settings data:', error);
      }
    };

    loadData();
  }, []);

  const handleForceSync = async () => {
    const result = await triggerForceSync();
    if (!result.success) {
      toast.error('Sync failed');
    }
  };

  const handleCreateSnapshot = async () => {
    const currentMonth = format(new Date(), 'yyyy-MM');
    setIsCreatingSnapshot(true);
    
    try {
      await createSnapshot(currentMonth);
      toast.success('Snapshot created');
      const snapshotsData = await getSnapshots();
      setSnapshots(snapshotsData);
    } catch (error) {
      console.error('Error creating snapshot:', error);
      toast.error(error.message || 'Failed to create snapshot');
    } finally {
      setIsCreatingSnapshot(false);
    }
  };

  const formatLastSync = (time) => {
    if (!time) return 'Never';
    return format(new Date(time), 'MMM d, yyyy h:mm a');
  };

  return (
    <div className="px-4 py-4 space-y-6" data-testid="settings-page">
      {/* Appearance */}
      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Appearance
          </h3>
        </div>
        
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isDark ? (
                <Moon className="w-5 h-5 text-primary" />
              ) : (
                <Sun className="w-5 h-5 text-amber-500" />
              )}
              <div>
                <p className="font-medium">Dark Mode</p>
                <p className="text-sm text-muted-foreground">
                  {isDark ? 'OLED-friendly dark theme' : 'Light theme active'}
                </p>
              </div>
            </div>
            <Switch
              checked={isDark}
              onCheckedChange={toggleTheme}
              data-testid="dark-mode-toggle"
            />
          </div>
        </div>
      </div>

      {/* Sync Status */}
      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Sync & Backup
          </h3>
        </div>
        
        <div className="p-5 space-y-4">
          {/* Connection Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {isOnline ? (
                <Cloud className="w-5 h-5 text-green-500" />
              ) : (
                <CloudOff className="w-5 h-5 text-gray-400" />
              )}
              <div>
                <p className="font-medium">Connection</p>
                <p className="text-sm text-muted-foreground">
                  {isOnline ? 'Online - Connected to server' : 'Offline - Using local storage'}
                </p>
              </div>
            </div>
            <div className={cn(
              "w-3 h-3 rounded-full",
              isOnline ? "bg-green-500 pulse-online" : "bg-gray-400"
            )} />
          </div>

          {/* Last Sync */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RefreshCw className={cn("w-5 h-5", isSyncing && "spin-slow text-primary")} />
              <div>
                <p className="font-medium">Last Synced</p>
                <p className="text-sm text-muted-foreground">
                  {formatLastSync(lastSyncTime)}
                </p>
              </div>
            </div>
            {unsyncedCount > 0 && (
              <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                {unsyncedCount} pending
              </span>
            )}
          </div>

          {/* Force Sync Button */}
          <Button
            onClick={handleForceSync}
            disabled={!isOnline || isSyncing}
            className="w-full rounded-full"
            variant="outline"
            data-testid="force-sync-btn"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 spin-slow" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Force Sync to Google Sheets
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Monthly Snapshots */}
      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Monthly Snapshots
          </h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCreateSnapshot}
            disabled={isCreatingSnapshot || !isOnline}
            className="text-xs"
            data-testid="create-snapshot-btn"
          >
            {isCreatingSnapshot ? 'Creating...' : '+ Create'}
          </Button>
        </div>
        
        <div className="p-5">
          {snapshots.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No snapshots yet. Create one to archive monthly data.
            </p>
          ) : (
            <div className="space-y-3">
              {snapshots.slice(0, 5).map((snapshot) => (
                <div 
                  key={snapshot.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-xl"
                >
                  <div>
                    <p className="font-medium">{snapshot.month}</p>
                    <p className="text-xs text-muted-foreground">
                      {snapshot.is_locked ? 'Locked' : 'Active'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">₹{snapshot.total_expense?.toLocaleString()}</p>
                    <p className="text-xs text-green-500">
                      ₹{snapshot.total_paid?.toLocaleString()} paid
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* System Status */}
      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            System Status
          </h3>
        </div>
        
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-muted-foreground" />
              <span>MongoDB</span>
            </div>
            <span className={cn(
              "text-xs font-medium px-2 py-1 rounded-full",
              health?.mongodb === 'healthy' 
                ? "bg-green-500/10 text-green-500" 
                : "bg-red-500/10 text-red-500"
            )}>
              {health?.mongodb || 'Unknown'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Cloud className="w-5 h-5 text-muted-foreground" />
              <span>Google Sheets</span>
            </div>
            <span className={cn(
              "text-xs font-medium px-2 py-1 rounded-full",
              health?.google_sheets === 'healthy' 
                ? "bg-green-500/10 text-green-500" 
                : "bg-amber-500/10 text-amber-500"
            )}>
              {health?.google_sheets || 'Unknown'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-muted-foreground" />
              <span>PWA Status</span>
            </div>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-green-500/10 text-green-500">
              Installed
            </span>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="bg-card rounded-2xl border border-border/50 overflow-hidden">
        <div className="px-5 py-4 border-b border-border/50">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            About
          </h3>
        </div>
        
        <div className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <Info className="w-5 h-5 text-primary" />
            <div>
              <p className="font-medium">Expense Tracker PWA</p>
              <p className="text-sm text-muted-foreground">Version 1.0.0</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            A personal expense tracking app with offline support and Google Sheets integration.
            Swipe right to mark paid, left to delete.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Settings;
