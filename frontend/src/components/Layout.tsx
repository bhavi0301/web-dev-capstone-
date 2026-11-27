import React, { useState, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import axios from 'axios';
import {
  LayoutDashboard,
  Boxes,
  BarChart3,
  TrendingUp,
  FileSpreadsheet,
  FileText,
  Settings,
  Bell,
  Sun,
  Moon,
  LogOut,
  User,
  Menu,
  X,
  AlertTriangle,
  Info
} from 'lucide-react';

interface AlertNotification {
  product_id: number;
  product_name: string;
  sku: string;
  current_stock: number;
  reorder_level: number;
  type: string;
  severity: string;
  message: string;
}

export const Layout: React.FC = () => {
  const { user, logout, hasRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  // Close menus on page navigation
  useEffect(() => {
    setMobileMenuOpen(false);
    setNotificationsOpen(false);
  }, [location]);

  // Fetch low stock alerts for the notifications bell
  const fetchAlerts = async () => {
    if (!user) return;
    setLoadingAlerts(true);
    try {
      const res = await axios.get('/alerts');
      setAlerts(res.data);
    } catch (err) {
      console.error("Failed to load alerts", err);
    } finally {
      setLoadingAlerts(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAlerts();
      // Poll alerts every 60 seconds
      const interval = setInterval(fetchAlerts, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Sales Analytics Dashboard';
    if (path === '/inventory') return 'Inventory Management';
    if (path === '/sales') return 'Sales Operations & Logs';
    if (path === '/predictions') return 'AI Demand Forecasting & Predictions';
    if (path === '/purchase-orders') return 'Purchase Order Tracking';
    if (path === '/reports') return 'System Reports & Export';
    if (path === '/settings') return 'Account Settings';
    return 'StockPulse';
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['admin', 'manager', 'staff'] },
    { name: 'Inventory', path: '/inventory', icon: Boxes, roles: ['admin', 'manager', 'staff'] },
    { name: 'Sales Operations', path: '/sales', icon: BarChart3, roles: ['admin', 'manager', 'staff'] },
    { name: 'AI Predictions', path: '/predictions', icon: TrendingUp, roles: ['admin', 'manager', 'staff'] },
    { name: 'Purchase Orders', path: '/purchase-orders', icon: FileSpreadsheet, roles: ['admin', 'manager'] },
    { name: 'Reports', path: '/reports', icon: FileText, roles: ['admin', 'manager'] },
    { name: 'Settings', path: '/settings', icon: Settings, roles: ['admin', 'manager', 'staff'] },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Filter alerts by warning/critical
  const lowStockAlerts = alerts.filter(a => a.type === 'low_stock');

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      
      {/* SIDEBAR - DESKTOP */}
      <aside className="hidden lg:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200/60 dark:border-slate-800/60 p-5 shrink-0">
        {/* Brand Logo */}
        <div className="flex items-center gap-2 px-3 py-4 mb-6">
          <div className="p-2 bg-brand-600 rounded-xl text-white">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg font-sans tracking-tight text-slate-900 dark:text-slate-100">StockPulse</h1>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">AI Inventory SaaS</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            // Check role access
            if (item.roles && !hasRole(item.roles as any)) return null;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link'}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        {/* User Card at bottom */}
        <div className="border-t border-slate-100 dark:border-slate-800 pt-4 mt-4">
          <div className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/40">
            <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold">
              {user?.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{user?.name}</h4>
              <p className="text-[10px] text-slate-400 font-medium capitalize">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE MENU NAV */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm">
          <aside className="w-64 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-5 flex flex-col animate-slide-up">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-brand-600 rounded-lg text-white">
                  <Boxes className="w-5 h-5" />
                </div>
                <span className="font-bold text-lg text-slate-900 dark:text-slate-100">StockPulse</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1">
              {navItems.map((item) => {
                if (item.roles && !hasRole(item.roles as any)) return null;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => isActive ? 'sidebar-link-active' : 'sidebar-link'}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.name}
                  </NavLink>
                );
              })}
            </nav>
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* HEADER */}
        <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200/50 dark:border-slate-900/50">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-bold font-sans tracking-tight text-slate-800 dark:text-slate-100">
              {getPageTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
                title="Notifications"
              >
                <Bell className="w-5 h-5" />
                {lowStockAlerts.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
                )}
              </button>

              {/* Notifications Dropdown Panel */}
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200/70 dark:border-slate-800/70 p-4 z-40 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-3">
                    <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">System Alerts</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                      {lowStockAlerts.length} Critical
                    </span>
                  </div>
                  
                  {loadingAlerts ? (
                    <div className="py-8 text-center text-xs text-slate-400">Loading alerts...</div>
                  ) : alerts.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">All inventory levels normal.</div>
                  ) : (
                    <div className="space-y-2.5">
                      {alerts.map((alert, i) => (
                        <div
                          key={i}
                          onClick={() => {
                            setNotificationsOpen(false);
                            if (hasRole(['admin', 'manager'])) {
                              navigate('/purchase-orders', { state: { product_id: alert.product_id, sku: alert.sku, name: alert.product_name } });
                            } else {
                              navigate('/inventory');
                            }
                          }}
                          className={`p-3 rounded-xl border text-xs cursor-pointer transition-all duration-200
                            ${alert.type === 'low_stock' 
                              ? 'bg-rose-500/5 hover:bg-rose-500/10 border-rose-100 dark:border-rose-950/40 text-slate-800 dark:text-slate-200' 
                              : 'bg-blue-500/5 hover:bg-blue-500/10 border-blue-100 dark:border-blue-950/40 text-slate-800 dark:text-slate-200'}
                          `}
                        >
                          <div className="flex items-center gap-1.5 font-bold mb-1">
                            {alert.type === 'low_stock' ? (
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                            ) : (
                              <Info className="w-3.5 h-3.5 text-blue-500" />
                            )}
                            <span className="capitalize">{alert.type.replace('_', ' ')}</span>
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 leading-snug">{alert.message}</p>
                          {alert.type === 'low_stock' && hasRole(['admin', 'manager']) && (
                            <div className="mt-2 text-right text-brand-600 dark:text-brand-400 font-semibold hover:underline">
                              Generate PO &rarr;
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* CRITICAL STOCK ALERTS BANNER */}
        {lowStockAlerts.length > 0 && (
          <div className="mx-6 mt-4 p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3">
            <div className="p-1.5 bg-amber-500 text-white rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="flex-1 text-xs md:text-sm font-medium text-amber-800 dark:text-amber-300">
              There are <strong className="font-bold">{lowStockAlerts.length} items</strong> currently below reorder levels. Immediate replenishment recommended.
            </div>
            {hasRole(['admin', 'manager']) && (
              <Link
                to="/purchase-orders"
                className="hidden md:inline-block px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Reorder Items
              </Link>
            )}
          </div>
        )}

        {/* PAGES OUTLET */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
