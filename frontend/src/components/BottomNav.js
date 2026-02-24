import { useLocation, useNavigate } from "react-router-dom";
import { Home, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-40 glass border-t border-border/50 bottom-nav"
      data-testid="bottom-nav"
    >
      <div className="flex items-center justify-around h-14 max-w-md mx-auto">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path || 
            (path === '/' && location.pathname === '/dashboard');
          
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-16 h-12 rounded-xl transition-all touch-feedback",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid={`nav-${label.toLowerCase()}`}
            >
              <Icon 
                className={cn(
                  "w-5 h-5 transition-transform",
                  isActive && "scale-110"
                )} 
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
