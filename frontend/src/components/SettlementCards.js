import { User, Users, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const SettlementCards = ({ settlement }) => {
  if (!settlement) return null;

  const {
    mom_owes = 0,
    dad_owes = 0,
    i_owe = 0,
    total_settled = 0
  } = settlement;

  const cards = [
    {
      title: 'Mom Owes',
      value: mom_owes,
      icon: User,
      color: 'from-pink-500/20 to-pink-600/20 border-pink-500/30',
      textColor: 'text-pink-500'
    },
    {
      title: 'Dad Owes',
      value: dad_owes,
      icon: User,
      color: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
      textColor: 'text-blue-500'
    },
    {
      title: 'I Owe',
      value: i_owe,
      icon: Users,
      color: 'from-amber-500/20 to-amber-600/20 border-amber-500/30',
      textColor: 'text-amber-500'
    },
    {
      title: 'Settled',
      value: total_settled,
      icon: CheckCircle,
      color: 'from-green-500/20 to-green-600/20 border-green-500/30',
      textColor: 'text-green-500'
    }
  ];

  return (
    <div className="space-y-3" data-testid="settlement-cards">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
        Settlement Summary
      </h3>
      
      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <div
            key={card.title}
            className={cn(
              "relative overflow-hidden rounded-2xl p-4",
              "bg-gradient-to-br border",
              card.color,
              "transition-all duration-200 card-press"
            )}
            data-testid={`settlement-${card.title.toLowerCase().replace(' ', '-')}`}
          >
            <div className="flex items-center justify-between mb-2">
              <card.icon className={cn("w-5 h-5", card.textColor)} />
            </div>
            <p className="text-xs text-muted-foreground mb-0.5">{card.title}</p>
            <p className={cn("text-xl font-bold", card.textColor)}>
              ₹{card.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SettlementCards;
