import { useSync } from "@/context/SyncContext";
import { useTheme } from "@/context/ThemeContext";
import { RefreshCw, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const Header = () => {
  const { isOnline, isSyncing, lastSyncTime, unsyncedCount } = useSync();
  const { theme, toggleTheme } = useTheme();

  const formatLastSync = (time) => {
    if (!time) return 'Never';
    const date = new Date(time);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <header 
      className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50 pt-safe"
      data-testid="header"
    >
      <div className="flex items-center justify-between px-4 h-14">
        {/* Logo/Title */}
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold tracking-tight" data-testid="app-title">
            Expenses
          </h1>
        </div>

        {/* Right side: Status & Theme */}
        <div className="flex items-center gap-3">
          {/* Sync Status */}
          <div 
            className="flex items-center gap-2 text-xs text-muted-foreground"
            data-testid="sync-status"
          >
            {isSyncing ? (
              <RefreshCw className="w-3 h-3 spin-slow text-primary" />
            ) : (
              <div 
                className={cn(
                  "w-2 h-2 rounded-full",
                  isOnline 
                    ? "bg-green-500 pulse-online" 
                    : "bg-gray-400"
                )}
                data-testid="online-indicator"
              />
            )}
            <span className="hidden sm:inline">
              {isSyncing 
                ? 'Syncing...' 
                : isOnline 
                  ? formatLastSync(lastSyncTime)
                  : 'Offline'
              }
            </span>
            {unsyncedCount > 0 && !isSyncing && (
              <span 
                className="bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                data-testid="unsynced-badge"
              >
                {unsyncedCount}
              </span>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="tap-target flex items-center justify-center w-9 h-9 rounded-full hover:bg-muted transition-colors touch-feedback"
            data-testid="theme-toggle"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-slate-600" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
