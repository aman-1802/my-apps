import { format } from "date-fns";
import { cn } from "@/lib/utils";
import SwipeableExpenseItem from "./SwipeableExpenseItem";
import { AlertCircle, Clock, CheckCircle2 } from "lucide-react";

const ExpenseList = ({ expenses, onMarkPaid, onMarkUnpaid, onDelete, onEdit }) => {
  if (!expenses || expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="font-semibold text-lg mb-1">No expenses yet</h3>
        <p className="text-sm text-muted-foreground">
          Tap the + button to add your first expense
        </p>
      </div>
    );
  }

  const getCategoryClass = (category) => {
    const classes = {
      'Food': 'badge-food',
      'Rent': 'badge-rent',
      'Subscriptions': 'badge-subscriptions',
      'Dinner': 'badge-dinner',
      'Blinkit': 'badge-blinkit',
      'Travel': 'badge-travel',
      'Utilities': 'badge-utilities',
      'Shopping': 'badge-shopping',
      'Other': 'badge-other'
    };
    return classes[category] || 'badge-other';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Paid':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'Partially Paid':
        return <Clock className="w-4 h-4 text-amber-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Paid':
        return 'status-paid';
      case 'Partially Paid':
        return 'status-partially-paid';
      default:
        return 'status-unpaid';
    }
  };

  // Group expenses by date
  const groupedExpenses = expenses.reduce((groups, expense) => {
    const date = expense.date || expense.created_timestamp?.split('T')[0];
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(expense);
    return groups;
  }, {});

  const sortedDates = Object.keys(groupedExpenses).sort((a, b) => new Date(b) - new Date(a));

  return (
    <div className="space-y-6">
      {sortedDates.map((date) => (
        <div key={date} className="space-y-2">
          {/* Date Header */}
          <div className="flex items-center justify-between px-1 mb-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {format(new Date(date), 'EEEE, MMM d')}
            </h3>
            <span className="text-sm font-medium text-muted-foreground">
              ₹{groupedExpenses[date].reduce((sum, e) => sum + (e.amount || 0), 0).toLocaleString()}
            </span>
          </div>

          {/* Expenses for this date */}
          {groupedExpenses[date].map((expense, index) => (
            <SwipeableExpenseItem
              key={expense.id}
              expense={expense}
              onMarkPaid={onMarkPaid}
              onMarkUnpaid={onMarkUnpaid}
              onDelete={onDelete}
              onEdit={onEdit}
            >
              <div 
                className={cn(
                  "p-4 expense-item cursor-pointer",
                  "border border-border/50 rounded-2xl",
                  "active:bg-muted/50 transition-colors"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => onEdit(expense)}
                data-testid={`expense-item-${expense.id}`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left: Title and details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-base truncate">
                        {expense.title}
                      </h4>
                      {!expense.synced && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" title="Not synced" />
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        getCategoryClass(expense.category)
                      )}>
                        {expense.category}
                      </span>
                      
                      {expense.to_be_paid_by && expense.to_be_paid_by !== 'Me' && (
                        <span className="text-xs text-muted-foreground">
                          → {expense.to_be_paid_by}
                        </span>
                      )}
                      
                      {expense.is_fixed && (
                        <span className="text-xs text-muted-foreground">
                          • Fixed
                        </span>
                      )}
                    </div>

                    {/* Tags */}
                    {expense.tags && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {expense.tags.split(',').slice(0, 3).map((tag, i) => (
                          <span 
                            key={i} 
                            className="text-xs text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded"
                          >
                            {tag.trim().startsWith('#') ? tag.trim() : `#${tag.trim()}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right: Amount and status */}
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-lg font-bold">
                      ₹{expense.amount?.toLocaleString()}
                    </span>
                    
                    <div className={cn(
                      "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full",
                      getStatusClass(expense.payment_status)
                    )}>
                      {getStatusIcon(expense.payment_status)}
                      <span className="font-medium">{expense.payment_status}</span>
                    </div>

                    {expense.payment_status === 'Partially Paid' && (
                      <span className="text-xs text-muted-foreground">
                        ₹{expense.remaining_balance?.toLocaleString()} left
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </SwipeableExpenseItem>
          ))}
        </div>
      ))}
    </div>
  );
};

export default ExpenseList;
