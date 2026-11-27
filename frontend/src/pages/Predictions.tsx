import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line 
} from 'recharts';
import { 
  TrendingUp, AlertTriangle, AlertCircle, RefreshCw, Layers, CheckCircle2, ShoppingCart, ShieldAlert 
} from 'lucide-react';

interface ForecastPoint {
  date: string;
  forecast: number;
  lower_bound: number;
  upper_bound: number;
}

interface PredictionData {
  sku: string;
  product_name: string;
  current_stock: number;
  forecast_7_days: number;
  forecast_30_days: number;
  forecast_90_days: number;
  reorder_point: number;
  suggested_reorder_qty: number;
  anomaly_flag: boolean;
  forecast_data: ForecastPoint[];
}

interface ProductItem {
  id: number;
  name: string;
  sku: string;
}

export const Predictions: React.FC = () => {
  const { showToast } = useToast();
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [selectedSku, setSelectedSku] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [forecast, setForecast] = useState<PredictionData | null>(null);

  // Check if a product was passed through navigation state (e.g. from alert drawer)
  const stateProduct = location.state as { sku?: string; product_id?: number } | null;

  const fetchProducts = async () => {
    setLoadingProducts(true);
    try {
      const res = await axios.get('/products');
      setProducts(res.data);
      
      if (res.data.length > 0) {
        // Use state product if present, otherwise default to first item
        if (stateProduct?.sku) {
          setSelectedSku(stateProduct.sku);
        } else {
          setSelectedSku(res.data[0].sku);
        }
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to load products list", "error");
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchForecast = async (sku: string) => {
    if (!sku) return;
    setLoadingForecast(true);
    try {
      const res = await axios.get(`/predict/${sku}`);
      setForecast(res.data);
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || "Failed to generate prediction forecast", "error");
    } finally {
      setLoadingForecast(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedSku) {
      fetchForecast(selectedSku);
    }
  }, [selectedSku]);

  // Handle PO redirection
  const handleGeneratePO = () => {
    if (!forecast) return;
    navigate('/purchase-orders', { 
      state: { 
        product_id: products.find(p => p.sku === forecast.sku)?.id, 
        sku: forecast.sku, 
        name: forecast.product_name,
        qty: forecast.suggested_reorder_qty 
      } 
    });
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER SECTION CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">AI Forecast Dashboard</h3>
          <p className="text-sm text-slate-500">Run Facebook Prophet predictive models on individual product SKUs</p>
        </div>
        
        {/* SKU Selector */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-semibold text-slate-400 uppercase">Selected Product:</span>
          {loadingProducts ? (
            <div className="h-9 w-48 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse" />
          ) : (
            <select
              value={selectedSku}
              onChange={(e) => setSelectedSku(e.target.value)}
              className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-700 dark:text-slate-200 font-semibold"
            >
              {products.map(p => (
                <option key={p.sku} value={p.sku}>{p.sku} - {p.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {loadingForecast && !forecast ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
            ))}
          </div>
          <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        </div>
      ) : forecast ? (
        <div className="space-y-6">
          
          {/* ANOMALY BANNER */}
          {forecast.anomaly_flag && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3">
              <div className="p-1.5 bg-rose-500 text-white rounded-lg mt-0.5">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-rose-800 dark:text-rose-400">Demand Sales Anomaly Detected</h4>
                <p className="text-xs text-rose-600 dark:text-rose-300/80 leading-relaxed mt-0.5">
                  Actual sales for "{forecast.product_name}" in the past 5 days deviate significantly from historical averages (Z-Score &gt; 2.5). This might indicate a promotional event, seasonal spike, or catalog listing error.
                </p>
              </div>
            </div>
          )}

          {/* DYNAMIC FORECASTING METRICS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            
            {/* CURRENT STOCK */}
            <div className="glass-card p-6 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Current Stock</span>
                <h3 className="text-2xl font-extrabold font-sans mt-1 text-slate-800 dark:text-slate-100 font-mono">
                  {forecast.current_stock} <span className="text-xs text-slate-400 font-normal font-sans">units</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-2 font-semibold">In all warehouses</p>
              </div>
              <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl">
                <Layers className="w-6 h-6" />
              </div>
            </div>

            {/* PREDICTED DEMAND */}
            <div className="glass-card p-6 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Next 30D Forecasted Sales</span>
                <h3 className="text-2xl font-extrabold font-sans mt-1 text-brand-600 dark:text-brand-400 font-mono">
                  {Math.round(forecast.forecast_30_days)} <span className="text-xs text-slate-400 font-normal font-sans">units</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-2 font-semibold">90D sum: {Math.round(forecast.forecast_90_days)}</p>
              </div>
              <div className="p-3 bg-brand-500/10 text-brand-500 dark:text-brand-400 rounded-2xl">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            {/* REORDER LEVEL */}
            <div className="glass-card p-6 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ML Reorder Point</span>
                <h3 className="text-2xl font-extrabold font-sans mt-1 text-amber-600 dark:text-amber-400 font-mono">
                  {forecast.reorder_point} <span className="text-xs text-slate-400 font-normal font-sans">qty</span>
                </h3>
                <p className="text-[10px] text-slate-400 mt-2 font-semibold">Based on demand & lead time</p>
              </div>
              <div className="p-3 bg-amber-500/10 text-amber-500 dark:text-amber-400 rounded-2xl">
                <AlertCircle className="w-6 h-6" />
              </div>
            </div>

            {/* SUGGESTED REORDER QTY */}
            <div className="glass-card p-6 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Suggested Reorder</span>
                <h3 className="text-2xl font-extrabold font-sans mt-1 text-emerald-600 dark:text-emerald-400 font-mono">
                  {forecast.suggested_reorder_qty} <span className="text-xs text-slate-400 font-normal font-sans">units</span>
                </h3>
                {forecast.suggested_reorder_qty > 0 && hasRole(['admin', 'manager']) ? (
                  <button 
                    onClick={handleGeneratePO}
                    className="text-[10px] text-brand-600 dark:text-brand-400 font-bold underline mt-2 hover:text-brand-500 block text-left"
                  >
                    Generate PO Now &rarr;
                  </button>
                ) : (
                  <p className="text-[10px] text-emerald-500 font-semibold mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Stock Sufficient
                  </p>
                )}
              </div>
              <div className={`p-3 rounded-2xl
                ${forecast.suggested_reorder_qty > 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500'}
              `}>
                <ShoppingCart className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* FORECAST CHART CARD */}
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">Demand Projection Chart</h3>
                <p className="text-xs text-slate-400 font-medium">90 days forecast with 95% confidence bounds (shaded)</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                <span className="w-2.5 h-2.5 rounded bg-brand-500" /> Forecast Line
                <span className="w-3.5 h-2.5 bg-brand-500/10 border-l border-r border-brand-500/30 ml-2" /> Confidence Interval
              </div>
            </div>

            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecast.forecast_data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis 
                    dataKey="date" 
                    stroke="#64748b" 
                    fontSize={10} 
                    tickLine={false} 
                  />
                  <YAxis 
                    stroke="#64748b" 
                    fontSize={10} 
                    tickLine={false} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f172a',
                      color: '#ffffff',
                      border: '1px solid #1e293b',
                      borderRadius: '12px',
                      fontSize: '12px'
                    }}
                    formatter={(value: any) => [value, 'Demand']}
                  />
                  
                  {/* Shaded confidence interval band */}
                  <Area
                    type="monotone"
                    dataKey={((item: any) => [item.lower_bound, item.upper_bound]) as any}
                    stroke="none"
                    fill="#8b5cf6"
                    fillOpacity={0.1}
                    name="Confidence Band"
                  />
                  
                  {/* Forecast Line */}
                  <Area
                    type="monotone"
                    dataKey="forecast"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    fill="none"
                    name="Expected Sales"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          
        </div>
      ) : (
        <div className="glass-card p-12 text-center text-slate-400">
          Select a product SKU above to calculate machine learning forecast demand values.
        </div>
      )}

    </div>
  );
};
