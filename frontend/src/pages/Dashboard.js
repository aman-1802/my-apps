import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { getExpenses, getAnalyticsSummary, getSettlementSummary, markExpensePaid, markExpenseUnpaid, deleteExpense, getAllTags, settleAllByPerson, deleteAllByPerson } from "@/lib/api";
import { useSync } from "@/context/SyncContext";
import StatsCards from "@/components/StatsCards";
import SettlementCards from "@/components/SettlementCards";
import FilterPanel from "@/components/FilterPanel";
import ExpenseList from "@/components/ExpenseList";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const Dashboard = ({ onEditExpense }) => {
  const { triggerSync } = useSync();
  const [expenses, setExpenses] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [settlement, setSettlement] = useState(null);
  const [tags, setTags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [deleteDialog, setDeleteDialog] = useState({ open: false, expenseId: null });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [expensesData, analyticsData, settlementData, tagsData] = await Promise.all([
        getExpenses(filters),
        getAnalyticsSummary(),
        getSettlementSummary(),
        getAllTags()
      ]);
      
      setExpenses(expensesData);
      setAnalytics(analyticsData);
      setSettlement(settlementData);
      setTags(tagsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleMarkPaid = async (expenseId) => {
    try {
      await markExpensePaid(expenseId);
      toast.success('Marked as paid');
      triggerSync();
      loadData();
    } catch (error) {
      console.error('Error marking as paid:', error);
      toast.error('Failed to mark as paid');
    }
  };

  const handleMarkUnpaid = async (expenseId) => {
    try {
      await markExpenseUnpaid(expenseId);
      toast.success('Marked as unpaid');
      triggerSync();
      loadData();
    } catch (error) {
      console.error('Error marking as unpaid:', error);
      toast.error('Failed to mark as unpaid');
    }
  };

  const handleSettleAll = async (paidBy) => {
    try {
      const result = await settleAllByPerson(paidBy);
      toast.success(`Settled ${result.updated_count} expenses for ${paidBy}`);
      triggerSync();
      loadData();
    } catch (error) {
      console.error('Error settling all:', error);
      toast.error('Failed to settle');
    }
  };

  const handleDeleteAllByPerson = async (paidBy) => {
    try {
      const result = await deleteAllByPerson(paidBy);
      toast.success(`Deleted ${result.deleted_count} expenses for ${paidBy}`);
      triggerSync();
      loadData();
    } catch (error) {
      console.error('Error deleting all:', error);
      toast.error('Failed to delete');
    }
  };

  const handleDeleteClick = (expenseId) => {
    setDeleteDialog({ open: true, expenseId });
  };

  const handleDeleteConfirm = async () => {
    const { expenseId } = deleteDialog;
    setDeleteDialog({ open: false, expenseId: null });
    
    try {
      await deleteExpense(expenseId);
      toast.success('Expense deleted');
      triggerSync();
      loadData();
    } catch (error) {
      console.error('Error deleting expense:', error);
      toast.error('Failed to delete expense');
    }
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  return (
    <div className="px-4 py-4 space-y-6" data-testid="dashboard">
      {/* Stats Cards */}
      <StatsCards analytics={analytics} />

      {/* Settlement Summary */}
      <SettlementCards settlement={settlement} onSettleAll={handleSettleAll} onDeleteAll={handleDeleteAllByPerson} />

      {/* Filters */}
      <FilterPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        tags={tags}
      />

      {/* Expense List */}
      <div>
        <div className="flex items-center justify-between px-1 mb-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Recent Expenses
          </h3>
          <span className="text-sm text-muted-foreground">
            {expenses.length} {expenses.length === 1 ? 'item' : 'items'}
          </span>
        </div>
        
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-card rounded-2xl p-4 border border-border/50 animate-pulse">
                <div className="flex justify-between">
                  <div className="space-y-2">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-20 bg-muted rounded" />
                  </div>
                  <div className="h-5 w-16 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ExpenseList
            expenses={expenses}
            onMarkPaid={handleMarkPaid}
            onMarkUnpaid={handleMarkUnpaid}
            onDelete={handleDeleteClick}
            onEdit={onEditExpense}
          />
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ open: false, expenseId: null })}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Expense</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this expense? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" data-testid="cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full"
              data-testid="confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
