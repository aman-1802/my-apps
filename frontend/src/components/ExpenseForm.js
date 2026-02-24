import { useState, useEffect } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, X, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { createExpense, updateExpense, getCategories } from "@/lib/api";
import { toast } from "sonner";
import { useSync } from "@/context/SyncContext";

const DEFAULT_CATEGORIES = ["Food", "Rent", "Subscriptions", "Dinner", "Blinkit", "Travel", "Utilities", "Shopping", "Other"];

const ExpenseForm = ({ open, onClose, expense, onSave }) => {
  const { triggerSync } = useSync();
  const [isLoading, setIsLoading] = useState(false);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [showCalendar, setShowCalendar] = useState(false);
  
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    title: '',
    amount: '',
    category: 'Other',
    to_be_paid_by: 'Me',
    paid_amount: '',
    tags: '',
    is_fixed: false,
    remark: ''
  });

  // Load categories
  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  // Reset form when opening
  useEffect(() => {
    if (open) {
      if (expense) {
        setFormData({
          date: expense.date || format(new Date(), 'yyyy-MM-dd'),
          title: expense.title || '',
          amount: expense.amount?.toString() || '',
          category: expense.category || 'Other',
          to_be_paid_by: expense.to_be_paid_by || 'Me',
          paid_amount: expense.paid_amount?.toString() || '',
          tags: expense.tags || '',
          is_fixed: expense.is_fixed || false,
          remark: expense.remark || ''
        });
      } else {
        setFormData({
          date: format(new Date(), 'yyyy-MM-dd'),
          title: '',
          amount: '',
          category: 'Other',
          to_be_paid_by: 'Me',
          paid_amount: '',
          tags: '',
          is_fixed: false,
          remark: ''
        });
      }
    }
  }, [open, expense]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const paidAmount = parseFloat(formData.paid_amount) || 0;
    if (paidAmount < 0 || paidAmount > amount) {
      toast.error('Paid amount must be between 0 and total amount');
      return;
    }

    setIsLoading(true);

    try {
      const expenseData = {
        ...formData,
        amount,
        paid_amount: paidAmount
      };

      if (expense?.id) {
        await updateExpense(expense.id, expenseData);
        toast.success('Expense updated');
      } else {
        await createExpense(expenseData);
        toast.success('Expense added');
      }

      triggerSync();
      onSave();
    } catch (error) {
      console.error('Error saving expense:', error);
      toast.error('Failed to save expense');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateSelect = (date) => {
    if (date) {
      setFormData(prev => ({ ...prev, date: format(date, 'yyyy-MM-dd') }));
      setShowCalendar(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="border-b border-border/50 pb-4">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-xl font-bold">
              {expense ? 'Edit Expense' : 'Add Expense'}
            </DrawerTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full"
              data-testid="close-form-btn"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="p-4 space-y-5 overflow-y-auto">
          {/* Amount Input - Large and prominent */}
          <div className="py-4 text-center">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
              Amount
            </Label>
            <div className="flex items-center justify-center gap-1">
              <span className="text-3xl font-bold text-muted-foreground">₹</span>
              <input
                type="number"
                inputMode="decimal"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0"
                className="amount-input max-w-[200px]"
                data-testid="amount-input"
                step="0.01"
                min="0"
              />
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="What did you spend on?"
              className="h-12 text-base rounded-xl"
              data-testid="title-input"
            />
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Date</Label>
            <Popover open={showCalendar} onOpenChange={setShowCalendar}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full h-12 justify-start text-left font-normal rounded-xl"
                  data-testid="date-picker-btn"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.date ? format(new Date(formData.date), 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.date ? new Date(formData.date) : undefined}
                  onSelect={handleDateSelect}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
            >
              <SelectTrigger className="h-12 rounded-xl" data-testid="category-select">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* To Be Paid By */}
          <div className="space-y-2">
            <Label>To Be Paid By</Label>
            <Select
              value={formData.to_be_paid_by}
              onValueChange={(value) => setFormData(prev => ({ ...prev, to_be_paid_by: value }))}
            >
              <SelectTrigger className="h-12 rounded-xl" data-testid="paid-by-select">
                <SelectValue placeholder="Who will pay?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Me">Me</SelectItem>
                <SelectItem value="Mom">Mom</SelectItem>
                <SelectItem value="Dad">Dad</SelectItem>
                <SelectItem value="Others">Others</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Paid Amount */}
          <div className="space-y-2">
            <Label htmlFor="paid_amount">Paid Amount (Optional)</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
              <Input
                id="paid_amount"
                type="number"
                inputMode="decimal"
                value={formData.paid_amount}
                onChange={(e) => setFormData(prev => ({ ...prev, paid_amount: e.target.value }))}
                placeholder="0"
                className="h-12 text-base rounded-xl pl-8"
                data-testid="paid-amount-input"
                step="0.01"
                min="0"
              />
            </div>
            {formData.amount && formData.paid_amount && (
              <p className="text-sm text-muted-foreground">
                Remaining: ₹{(parseFloat(formData.amount) - parseFloat(formData.paid_amount || 0)).toFixed(2)}
              </p>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma separated)</Label>
            <Input
              id="tags"
              value={formData.tags}
              onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="#health, #investment"
              className="h-12 text-base rounded-xl"
              data-testid="tags-input"
            />
          </div>

          {/* Fixed/Variable Toggle */}
          <div className="flex items-center justify-between py-2">
            <div>
              <Label htmlFor="is_fixed" className="text-base">Fixed Expense</Label>
              <p className="text-sm text-muted-foreground">Recurring monthly expense</p>
            </div>
            <Switch
              id="is_fixed"
              checked={formData.is_fixed}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_fixed: checked }))}
              data-testid="fixed-toggle"
            />
          </div>

          {/* Remark */}
          <div className="space-y-2">
            <Label htmlFor="remark">Remark (Optional)</Label>
            <Input
              id="remark"
              value={formData.remark}
              onChange={(e) => setFormData(prev => ({ ...prev, remark: e.target.value }))}
              placeholder="Any notes..."
              className="h-12 text-base rounded-xl"
              data-testid="remark-input"
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-14 text-lg font-semibold rounded-full mt-4"
            data-testid="submit-expense-btn"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              expense ? 'Update Expense' : 'Add Expense'
            )}
          </Button>
        </form>
      </DrawerContent>
    </Drawer>
  );
};

export default ExpenseForm;
