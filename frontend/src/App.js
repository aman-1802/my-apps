import { useEffect, useState, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { initDB } from "@/lib/indexedDB";
import { syncToServer, getNetworkStatus, getUnsyncedCount } from "@/lib/api";

// Components
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import FloatingActionButton from "@/components/FloatingActionButton";
import ExpenseForm from "@/components/ExpenseForm";

// Pages
import Dashboard from "@/pages/Dashboard";
import Analytics from "@/pages/Analytics";
import Settings from "@/pages/Settings";

// Theme context
import { ThemeProvider } from "@/context/ThemeContext";
import { SyncProvider } from "@/context/SyncContext";

function AppContent() {
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const location = useLocation();

  // Initialize IndexedDB on mount
  useEffect(() => {
    initDB().catch(console.error);
  }, []);

  // Register service worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then((registration) => {
          console.log('SW registered:', registration);
        })
        .catch((error) => {
          console.log('SW registration failed:', error);
        });
    }
  }, []);

  // Listen for service worker sync messages
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SYNC_REQUESTED') {
          syncToServer();
        }
      });
    }
  }, []);

  const handleAddExpense = () => {
    setEditingExpense(null);
    setShowExpenseForm(true);
  };

  const handleEditExpense = (expense) => {
    setEditingExpense(expense);
    setShowExpenseForm(true);
  };

  const handleCloseForm = () => {
    setShowExpenseForm(false);
    setEditingExpense(null);
  };

  const handleExpenseSaved = useCallback(() => {
    setShowExpenseForm(false);
    setEditingExpense(null);
    setRefreshKey(prev => prev + 1);
  }, []);

  const showFAB = location.pathname === '/' || location.pathname === '/dashboard';

  return (
    <div className="min-h-screen bg-background pb-safe">
      <Header />
      
      <main className="pt-16 pb-20">
        <Routes>
          <Route 
            path="/" 
            element={
              <Dashboard 
                key={refreshKey}
                onEditExpense={handleEditExpense} 
              />
            } 
          />
          <Route 
            path="/dashboard" 
            element={
              <Dashboard 
                key={refreshKey}
                onEditExpense={handleEditExpense} 
              />
            } 
          />
          <Route path="/analytics" element={<Analytics key={refreshKey} />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      <BottomNav />
      
      {showFAB && (
        <FloatingActionButton onClick={handleAddExpense} />
      )}

      <ExpenseForm
        open={showExpenseForm}
        onClose={handleCloseForm}
        expense={editingExpense}
        onSave={handleExpenseSaved}
      />

      <Toaster 
        position="top-center" 
        richColors 
        closeButton
        toastOptions={{
          className: 'font-sans'
        }}
      />
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <SyncProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </SyncProvider>
    </ThemeProvider>
  );
}

export default App;
