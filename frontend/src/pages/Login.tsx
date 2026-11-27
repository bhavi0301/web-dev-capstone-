import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Boxes, ShieldCheck, Key, User, Loader2 } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast("Please enter email and password credentials", "warning");
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      showToast("Session authenticated. Welcome back!", "success");
      navigate('/');
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || "Authentication failed. Validate credentials.", "error");
    } finally {
      setLoading(false);
    }
  };

  // Helper helper to login with demo roles instantly
  const handleDemoLogin = async (role: 'admin' | 'manager' | 'staff') => {
    const creds = {
      admin: { email: 'admin@company.com', pass: 'admin123' },
      manager: { email: 'manager@company.com', pass: 'manager123' },
      staff: { email: 'staff@company.com', pass: 'staff123' }
    };
    
    setLoading(true);
    try {
      await login(creds[role].email, creds[role].pass);
      showToast(`Logged in successfully as demo ${role.toUpperCase()}`, "success");
      navigate('/');
    } catch (err) {
      console.error(err);
      showToast("Demo login session failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 transition-colors duration-200">
      
      <div className="w-full max-w-md space-y-6">
        
        {/* LOGO */}
        <div className="flex flex-col items-center text-center">
          <div className="p-3 bg-brand-600 rounded-2xl text-white shadow-lg shadow-brand-500/20 mb-3">
            <Boxes className="w-8 h-8 animate-pulse" />
          </div>
          <h1 className="font-extrabold text-2xl font-sans tracking-tight text-slate-800 dark:text-slate-100">StockPulse</h1>
          <p className="text-xs text-slate-400 font-semibold tracking-wider uppercase mt-1">Smart Inventory forecasting & sales analytics</p>
        </div>

        {/* CARD CONTAINER */}
        <div className="glass-card p-8 border border-slate-200/60 dark:border-slate-800/60">
          <h2 className="text-center text-lg font-bold text-slate-800 dark:text-slate-200 mb-6">Access Dashboard</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-slate-505 mb-1.5 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Registered Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field text-sm"
                placeholder="email@company.com"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-505 mb-1.5 flex items-center gap-1">
                <Key className="w-3.5 h-3.5 text-slate-400" />
                Access Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field text-sm"
                placeholder="••••••••"
              />
            </div>

            {/* Login button */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2 mt-6"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Sign In
            </button>
          </form>

          {/* Quick Demo logins */}
          <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-6">
            <span className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-widest text-center mb-3.5">
              Instantly Evaluate Roles (Demo)
            </span>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin('admin')}
                className="px-2 py-2 bg-rose-500/10 text-rose-600 dark:text-rose-450 hover:bg-rose-500/15 border border-rose-200/30 text-[10px] font-bold rounded-xl transition-all"
              >
                Admin
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('manager')}
                className="px-2 py-2 bg-blue-500/10 text-blue-600 dark:text-blue-450 hover:bg-blue-500/15 border border-blue-200/30 text-[10px] font-bold rounded-xl transition-all"
              >
                Manager
              </button>
              <button
                type="button"
                onClick={() => handleDemoLogin('staff')}
                className="px-2 py-2 bg-slate-100 dark:bg-slate-850 text-slate-655 dark:text-slate-350 hover:bg-slate-200/30 text-[10px] font-bold rounded-xl transition-all"
              >
                Staff
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
