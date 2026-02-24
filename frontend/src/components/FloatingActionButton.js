import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const FloatingActionButton = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "fixed bottom-20 right-4 z-50",
        "w-14 h-14 rounded-full",
        "bg-primary text-primary-foreground",
        "shadow-lg shadow-primary/30",
        "flex items-center justify-center",
        "transition-all duration-200",
        "hover:scale-105 active:scale-95",
        "fab-pulse"
      )}
      data-testid="add-expense-fab"
      aria-label="Add expense"
    >
      <Plus className="w-6 h-6" strokeWidth={2.5} />
    </button>
  );
};

export default FloatingActionButton;
