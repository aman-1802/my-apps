import { useState, useRef } from "react";
import { Check, Trash2, Edit2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SWIPE_THRESHOLD = 80;

const SwipeableExpenseItem = ({ expense, onMarkPaid, onMarkUnpaid, onDelete, onEdit, children }) => {
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isHorizontalSwipe = useRef(null);

  const isPaid = expense.payment_status === 'Paid';

  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isHorizontalSwipe.current = null;
    setIsSwiping(false);
  };

  const handleTouchMove = (e) => {
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startX.current;
    const diffY = currentY - startY.current;

    // Determine swipe direction on first significant movement
    if (isHorizontalSwipe.current === null) {
      if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) {
        isHorizontalSwipe.current = Math.abs(diffX) > Math.abs(diffY);
      }
    }

    // Only handle horizontal swipes
    if (isHorizontalSwipe.current) {
      e.preventDefault();
      setIsSwiping(true);
      
      // Limit swipe range
      const maxSwipe = 120;
      const clampedX = Math.max(-maxSwipe, Math.min(maxSwipe, diffX));
      setSwipeX(clampedX);
    }
  };

  const handleTouchEnd = () => {
    if (!isSwiping) {
      setSwipeX(0);
      return;
    }

    // Right swipe - Mark as paid (only if not already paid)
    if (swipeX > SWIPE_THRESHOLD) {
      if (!isPaid) {
        onMarkPaid(expense.id);
      }
    }
    // Left swipe - If paid → mark unpaid, if unpaid → delete
    else if (swipeX < -SWIPE_THRESHOLD) {
      if (isPaid) {
        onMarkUnpaid(expense.id);
      } else {
        onDelete(expense.id);
      }
    }
    // Half swipe right - Edit
    else if (swipeX > 40 && swipeX <= SWIPE_THRESHOLD) {
      onEdit(expense);
    }

    // Reset position
    setSwipeX(0);
    setIsSwiping(false);
  };

  return (
    <div className="swipe-container relative overflow-hidden rounded-2xl mb-3">
      {/* Background actions */}
      <div className="absolute inset-0 flex">
        {/* Right swipe background (Mark Paid) */}
        <div 
          className={cn(
            "flex items-center justify-start pl-6 flex-1",
            "bg-green-500 text-white transition-opacity",
            swipeX > 0 ? "opacity-100" : "opacity-0"
          )}
        >
          {swipeX > SWIPE_THRESHOLD ? (
            <Check className="w-6 h-6" />
          ) : (
            <Edit2 className="w-5 h-5" />
          )}
          <span className="ml-2 font-medium text-sm">
            {swipeX > SWIPE_THRESHOLD ? 'Mark Paid' : 'Edit'}
          </span>
        </div>
        
        {/* Left swipe background (Delete or Mark Unpaid) */}
        <div 
          className={cn(
            "flex items-center justify-end pr-6 flex-1",
            "transition-opacity",
            isPaid ? "bg-amber-500" : "bg-red-500",
            "text-white",
            swipeX < 0 ? "opacity-100" : "opacity-0"
          )}
        >
          <span className="mr-2 font-medium text-sm">
            {isPaid ? 'Mark Unpaid' : 'Delete'}
          </span>
          {isPaid ? <Undo2 className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
        </div>
      </div>

      {/* Swipeable content */}
      <div
        className="swipe-content relative bg-card"
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: isSwiping ? 'none' : 'transform 200ms ease-out'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
};

export default SwipeableExpenseItem;
