import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { 
  User, ShieldCheck, Sun, Moon, ShieldAlert, Key, Link2, CheckCircle2 
} from 'lucide-react';

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { showToast } = useToast();

  const handleResetPassword = () => {
    showToast("Password reset link dispatched (Demo mode)", "info");
  };

  const getRolePrivileges = () => {
    if (user?.role === 'admin') {
      return ["Modify Products Catalog (CRUD)", "Deduct & Receive stock levels", "View predictive demand charts", "Generate purchase orders", "Export CSV & PDF reports", "Perform database deletions"];
    }
    if (user?.role === 'manager') {
      return ["Modify Products Catalog (CRUD)", "Deduct & Receive stock levels", "View predictive demand charts", "Generate purchase orders", "Export CSV & PDF reports"];
    }
    return ["View products & stock levels", "Record daily stock updates (IN/OUT)", "View predictive demand charts"];
  };

  return (
    <div className="space-y-6">
      
      <div>
        <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Control Panel</h3>
        <p className="text-sm text-slate-500">Review access roles and customize account preferences</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* PROFILE PROFILE */}
        <div className="glass-card p-6 md:col-span-2 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <User className="w-5 h-5 text-brand-500" />
            <h4 className="font-bold text-sm text-slate-850 dark:text-slate-100">Account Identity</h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Full Name</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1 block">{user?.name}</span>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Email Address</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-1 block">{user?.email}</span>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase">Active Role Clearance</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-600 bg-brand-500/10 px-2.5 py-0.5 rounded-full mt-1.5 capitalize">
                <ShieldCheck className="w-3.5 h-3.5" />
                {user?.role} clearance
              </span>
            </div>

            <div>
              <span className="block text-[10px] font-bold text-slate-400 uppercase">System Status</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-0.5 rounded-full mt-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 animate-pulse" />
                Database Connected
              </span>
            </div>
          </div>

          {/* Reset password button */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleResetPassword}
              className="btn-secondary text-xs flex items-center gap-1.5"
            >
              <Key className="w-4 h-4" />
              Reset Access Password
            </button>
          </div>
        </div>

        {/* ACCESS ACCESS ROLE INFO */}
        <div className="glass-card p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <ShieldAlert className="w-5 h-5 text-brand-500" />
            <h4 className="font-bold text-sm text-slate-850 dark:text-slate-100">Role Capabilities</h4>
          </div>

          <p className="text-xs text-slate-400 leading-normal">
            Based on your registered login role, your account holds the following functional clearance:
          </p>

          <ul className="space-y-2">
            {getRolePrivileges().map((priv, idx) => (
              <li key={idx} className="flex items-center gap-2 text-xs text-slate-650 dark:text-slate-350">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
                {priv}
              </li>
            ))}
          </ul>
        </div>

      </div>

    </div>
  );
};
