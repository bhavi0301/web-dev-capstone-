import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Inventory } from './pages/Inventory';
import { Sales } from './pages/Sales';
import { Predictions } from './pages/Predictions';
import { PurchaseOrders } from './pages/PurchaseOrders';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { AlertOctagon } from 'lucide-react';

// Protected Route Wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div className="glass-card p-8 max-w-md mx-auto text-center mt-20">
        <AlertOctagon className="w-12 h-12 text-rose-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Access Denied</h3>
        <p className="text-xs text-slate-400 mt-2">
          Your active role clearance ({user.role}) is insufficient to view this administration screen.
        </p>
        <button
          onClick={() => window.history.back()}
          className="btn-secondary text-xs mt-6"
        >
          Go Back
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Login */}
              <Route path="/login" element={<Login />} />

              {/* Application Dashboard Shell */}
              <Route path="/" element={<Layout />}>
                
                <Route index element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } />
                
                <Route path="inventory" element={
                  <ProtectedRoute>
                    <Inventory />
                  </ProtectedRoute>
                } />
                
                <Route path="sales" element={
                  <ProtectedRoute>
                    <Sales />
                  </ProtectedRoute>
                } />
                
                <Route path="predictions" element={
                  <ProtectedRoute>
                    <Predictions />
                  </ProtectedRoute>
                } />
                
                <Route path="purchase-orders" element={
                  <ProtectedRoute allowedRoles={['admin', 'manager']}>
                    <PurchaseOrders />
                  </ProtectedRoute>
                } />
                
                <Route path="reports" element={
                  <ProtectedRoute allowedRoles={['admin', 'manager']}>
                    <Reports />
                  </ProtectedRoute>
                } />
                
                <Route path="settings" element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                } />

              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />

            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
};
