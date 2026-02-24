import { TrendingDown, TrendingUp, Minus, Wallet, CreditCard, PiggyBank, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const StatsCards = ({ analytics }) => {
  if (!analytics) return null;

  const {
    total_expense = 0,
    total_paid = 0,
    total_unpaid = 0,
    current_month_expense = 0,
    trend_percentage = 0,
    trend_direction = 'neutral',
    avg_daily_spend = 0
  } = analytics;

  const getTrendIcon = () => {
    if (trend_direction === 'down') return <TrendingDown className="w-4 h-4" />;
    if (trend_direction === 'up') return <TrendingUp className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getTrendColor = () => {
    if (trend_direction === 'down') return 'text-green-500';
    if (trend_direction === 'up') return 'text-red-500';
    return 'text-muted-foreground';
  };

  const cards = [
    {
      title: 'This Month',
      value: `₹${current_month_expense.toLocaleString()}`,
      icon: Calendar,
      trend: trend_percentage !== 0 ? `${Math.abs(trend_percentage)}%` : null,
      trendDirection: trend_direction,
      color: 'bg-primary/10 text-primary'
    },
    {
      title: 'Total Expense',
      value: `₹${total_expense.toLocaleString()}`,
      icon: Wallet,
      color: 'bg-blue-500/10 text-blue-500'
    },
    {
      title: 'Total Paid',
      value: `₹${total_paid.toLocaleString()}`,
      icon: CreditCard,
      color: 'bg-green-500/10 text-green-500'
    },
    {
      title: 'Unpaid',
      value: `₹${total_unpaid.toLocaleString()}`,
      icon: PiggyBank,
      color: 'bg-amber-500/10 text-amber-500'
    }
  ];

  return (
    <div className="grid grid-cols-2 gap-3" data-testid="stats-cards">
      {cards.map((card, index) => (
        <div
          key={card.title}
          className={cn(
            "bg-card rounded-2xl p-4 border border-border/50",
            "transition-all duration-200",
            "card-press"
          )}
          data-testid={`stat-card-${index}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className={cn("p-2 rounded-xl", card.color)}>
              <card.icon className="w-4 h-4" />
            </div>
            {card.trend && (
              <div className={cn("flex items-center gap-0.5 text-xs font-medium", getTrendColor())}>
                {getTrendIcon()}
                {card.trend}
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-0.5">{card.title}</p>
          <p className="text-xl font-bold">{card.value}</p>
        </div>
      ))}

      {/* Average Daily Spend */}
      <div className="col-span-2 bg-gradient-to-r from-primary/5 to-primary/10 rounded-2xl p-4 border border-primary/20">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">Avg. Daily Spend</p>
            <p className="text-2xl font-bold">₹{avg_daily_spend.toLocaleString()}</p>
          </div>
          <div className={cn("p-3 rounded-full", "bg-primary/20 text-primary")}>
            <Calendar className="w-6 h-6" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsCards;
