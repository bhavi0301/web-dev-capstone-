import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend } from 'recharts';
import { IndianRupee, ShoppingCart, Percent, AlertTriangle, Calendar, TrendingUp, ArrowUpRight } from 'lucide-react';

interface KPIMetrics {
  total_revenue: number;
  total_profit: number;
  profit_margin: number;
  units_sold: number;
  low_stock_count: number;
}

interface TrendPoint {
  date: string;
  revenue: number;
  profit: number;
}

interface TopProduct {
  product_name: string;
  sku: string;
  units_sold: number;
  revenue: number;
}

interface CategorySales {
  category: string;
  revenue: number;
  percentage: number;
}

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { showToast } = useToast();
  
  // Date ranges: default to last 30 days
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<KPIMetrics>({
    total_revenue: 0,
    total_profit: 0,
    profit_margin: 0,
    units_sold: 0,
    low_stock_count: 0
  });
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [topBottom, setTopBottom] = useState<{ top: TopProduct[]; bottom: TopProduct[] }>({ top: [], bottom: [] });
  const [categorySales, setCategorySales] = useState<CategorySales[]>([]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch KPIs
      const metricsRes = await axios.get('/sales/analytics', {
        params: { start_date: startDate, end_date: endDate }
      });
      setMetrics(metricsRes.data);

      // 2. Fetch Trends
      const trendsRes = await axios.get('/sales/trends', {
        params: { start_date: startDate, end_date: endDate }
      });
      setTrends(trendsRes.data);

      // 3. Fetch Top/Bottom
      const topBottomRes = await axios.get('/sales/top-bottom');
      setTopBottom(topBottomRes.data);

      // 4. Fetch Category sales
      const catRes = await axios.get('/sales/category');
      setCategorySales(catRes.data);
      
    } catch (err) {
      console.error(err);
      showToast("Failed to load sales analytics details", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [startDate, endDate]);

  const COLORS = ['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'];

  // Render Skeleton cards
  if (loading && trends.length === 0) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Date Filter skeleton */}
        <div className="h-12 w-64 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        
        {/* KPI Cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          ))}
        </div>

        {/* Charts skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* FILTER CONTROLS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-slate-400" />
          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Date Filtering:</span>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <span className="text-slate-400 text-sm">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          
          {/* Quick ranges */}
          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
            <button
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 7);
                setStartDate(d.toISOString().split('T')[0]);
                setEndDate(new Date().toISOString().split('T')[0]);
              }}
              className="px-3 py-1 text-xs font-semibold rounded-lg hover:text-brand-600 dark:hover:text-brand-400"
            >
              7D
            </button>
            <button
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 30);
                setStartDate(d.toISOString().split('T')[0]);
                setEndDate(new Date().toISOString().split('T')[0]);
              }}
              className="px-3 py-1 text-xs font-semibold rounded-lg hover:text-brand-600 dark:hover:text-brand-400"
            >
              30D
            </button>
            <button
              onClick={() => {
                const d = new Date();
                d.setMonth(d.getMonth() - 6);
                setStartDate(d.toISOString().split('T')[0]);
                setEndDate(new Date().toISOString().split('T')[0]);
              }}
              className="px-3 py-1 text-xs font-semibold rounded-lg hover:text-brand-600 dark:hover:text-brand-400"
            >
              6M
            </button>
          </div>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* REVENUE */}
        <div className="interactive-card p-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Total Revenue</span>
            <h3 className="text-2xl font-extrabold font-sans mt-1 text-slate-900 dark:text-slate-50">
              ₹{metrics.total_revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <span className="inline-flex items-center text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full mt-2">
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
              SaaS Gross
            </span>
          </div>
          <div className="p-3 bg-brand-500/10 text-brand-500 dark:text-brand-400 rounded-2xl">
            <IndianRupee className="w-6 h-6" />
          </div>
        </div>

        {/* GROSS PROFIT */}
        <div className="interactive-card p-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Gross Profit</span>
            <h3 className="text-2xl font-extrabold font-sans mt-1 text-slate-900 dark:text-slate-50">
              ₹{metrics.total_profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h3>
            <span className="inline-flex items-center text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full mt-2">
              Margin: {metrics.profit_margin}%
            </span>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 rounded-2xl">
            <Percent className="w-6 h-6" />
          </div>
        </div>

        {/* UNITS SOLD */}
        <div className="interactive-card p-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Units Dispensed</span>
            <h3 className="text-2xl font-extrabold font-sans mt-1 text-slate-900 dark:text-slate-50 font-mono">
              {metrics.units_sold.toLocaleString()}
            </h3>
            <span className="inline-flex items-center text-[10px] font-semibold text-slate-400 bg-slate-500/10 px-2 py-0.5 rounded-full mt-2">
              Sales volume
            </span>
          </div>
          <div className="p-3 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-2xl">
            <ShoppingCart className="w-6 h-6" />
          </div>
        </div>

        {/* LOW STOCK ALERT COUNT */}
        <div className="interactive-card p-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-400 dark:text-slate-400 uppercase tracking-wider">Low Stock SKUs</span>
            <h3 className="text-2xl font-extrabold font-sans mt-1 text-rose-600 dark:text-rose-400 font-mono">
              {metrics.low_stock_count}
            </h3>
            <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full mt-2
              ${metrics.low_stock_count > 0 ? 'text-rose-500 bg-rose-500/10' : 'text-emerald-500 bg-emerald-500/10'}
            `}>
              {metrics.low_stock_count > 0 ? 'Requires Action' : 'Fully Stocked'}
            </span>
          </div>
          <div className={`p-3 rounded-2xl
            ${metrics.low_stock_count > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}
          `}>
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* CHARTS CONTAINER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* REVENUE TRENDS AREA CHART */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">Revenue & Profit Progression</h3>
              <p className="text-xs text-slate-400 font-medium">Daily transaction logging</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <span className="w-2.5 h-2.5 rounded bg-brand-500" /> Revenue
              <span className="w-2.5 h-2.5 rounded bg-emerald-500 ml-2" /> Profit
            </div>
          </div>
          
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#1e293b' : '#f1f5f9'} />
                <XAxis 
                  dataKey="date" 
                  stroke={theme === 'dark' ? '#64748b' : '#94a3b8'} 
                  fontSize={10} 
                  tickLine={false} 
                />
                <YAxis 
                  stroke={theme === 'dark' ? '#64748b' : '#94a3b8'} 
                  fontSize={10} 
                  tickLine={false} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                    border: `1px solid ${theme === 'dark' ? '#1e293b' : '#e2e8f0'}`,
                    borderRadius: '12px',
                    fontSize: '12px'
                  }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" name="Revenue" />
                <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProf)" name="Profit" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CATEGORY breakdown donut chart */}
        <div className="glass-card p-6">
          <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 mb-1">Sales by Category</h3>
          <p className="text-xs text-slate-400 font-medium mb-6">Revenue distribution breakdown</p>
          
          <div className="h-64 relative flex items-center justify-center">
            {categorySales.length === 0 ? (
              <span className="text-xs text-slate-400">No category sales in date range.</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categorySales}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="revenue"
                    nameKey="category"
                  >
                    {categorySales.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any) => [`₹${value.toLocaleString()}`, 'Revenue']}
                    contentStyle={{ 
                      backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff',
                      border: `1px solid ${theme === 'dark' ? '#1e293b' : '#e2e8f0'}`,
                      borderRadius: '12px',
                      fontSize: '12px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="absolute flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xs text-slate-400 font-semibold uppercase">Categories</span>
              <span className="text-xl font-extrabold text-slate-800 dark:text-slate-100">{categorySales.length}</span>
            </div>
          </div>

          {/* Custom Legends */}
          <div className="grid grid-cols-2 gap-2 mt-4 text-[10px] font-semibold">
            {categorySales.slice(0, 4).map((entry, index) => (
              <div key={entry.category} className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="text-slate-500 dark:text-slate-400 truncate">{entry.category} ({Math.round(entry.percentage)}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TOP & BOTTOM SELLING PRODUCTS LISTS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* TOP SELLING PRODUCTS */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">Top 5 Performing Products</h3>
          </div>
          
          <div className="space-y-4">
            {topBottom.top.map((item, idx) => (
              <div key={item.sku} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                    #{idx + 1}
                  </span>
                  <div className="truncate">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{item.product_name}</h4>
                    <p className="text-[10px] text-slate-400 font-mono">{item.sku}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.units_sold} sold</span>
                  <p className="text-[10px] text-slate-400 font-semibold">₹{item.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} rev</p>
                </div>
              </div>
            ))}
            {topBottom.top.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400">No sales recorded yet.</div>
            )}
          </div>
        </div>

        {/* BOTTOM SELLING PRODUCTS */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-1.5 bg-amber-500/10 text-amber-500 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">Bottom 5 Performing Products</h3>
          </div>

          <div className="space-y-4">
            {topBottom.bottom.map((item, idx) => (
              <div key={item.sku} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
                    #{idx + 1}
                  </span>
                  <div className="truncate">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{item.product_name}</h4>
                    <p className="text-[10px] text-slate-400 font-mono">{item.sku}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.units_sold} sold</span>
                  <p className="text-[10px] text-slate-400 font-semibold">₹{item.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })} rev</p>
                </div>
              </div>
            ))}
            {topBottom.bottom.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400">No sales recorded yet.</div>
            )}
          </div>
        </div>
      </div>
      
    </div>
  );
};
