import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ShoppingBag, ArrowUpRight, DollarSign, Calendar, Search, Trash2, Loader2, ArrowUpDown, X } from 'lucide-react';

interface Sale {
  id: number;
  product_id: number;
  quantity_sold: number;
  revenue: number;
  sale_date: string;
  product?: {
    sku: string;
    name: string;
    selling_price: number;
  };
}

interface ProductData {
  id: number;
  name: string;
  sku: string;
  selling_price: number;
}

interface WarehouseData {
  id: number;
  name: string;
  location: string;
}

export const Sales: React.FC = () => {
  const { hasRole } = useAuth();
  const { showToast } = useToast();

  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');

  // Log sale form
  const [logFormOpen, setLogFormOpen] = useState(false);
  const [newSale, setNewSale] = useState({
    product_id: '',
    warehouse_id: '',
    quantity_sold: '',
    custom_revenue: ''
  });
  const [loggingSale, setLoggingSale] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Products
      const prodRes = await axios.get('/products');
      setProducts(prodRes.data);
      if (prodRes.data.length > 0) {
        setNewSale(prev => ({ ...prev, product_id: prodRes.data[0].id.toString() }));
      }

      // Fetch Warehouses
      const whRes = await axios.get('/warehouses');
      setWarehouses(whRes.data);
      if (whRes.data.length > 0) {
        setNewSale(prev => ({ ...prev, warehouse_id: whRes.data[0].id.toString() }));
      }

      // Fetch Sales
      await refreshSales();
    } catch (err) {
      console.error(err);
      showToast("Error loading sales datasets", "error");
    } finally {
      setLoading(false);
    }
  };

  const refreshSales = async () => {
    const params: any = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    
    const salesRes = await axios.get('/sales', { params });
    setSales(salesRes.data);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Reload sales when date filters change
  useEffect(() => {
    refreshSales();
  }, [startDate, endDate]);

  // Handle selected product changing in Log Form to auto-populate revenue preview
  const getSelectedProductPrice = () => {
    if (!newSale.product_id) return 0;
    const p = products.find(prod => prod.id === Number(newSale.product_id));
    return p ? p.selling_price : 0;
  };

  const calculatedRevenuePreview = () => {
    const qty = Number(newSale.quantity_sold) || 0;
    const price = getSelectedProductPrice();
    return qty * price;
  };

  const handleLogSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSale.product_id || !newSale.warehouse_id || !newSale.quantity_sold) {
      showToast("Please complete all fields", "warning");
      return;
    }

    setLoggingSale(true);
    try {
      const p_id = Number(newSale.product_id);
      const wh_id = Number(newSale.warehouse_id);
      const qty = Number(newSale.quantity_sold);
      const rev = newSale.custom_revenue ? Number(newSale.custom_revenue) : (qty * getSelectedProductPrice());

      const payload = {
        product_id: p_id,
        quantity_sold: qty,
        revenue: rev
      };

      await axios.post('/sales', payload, {
        params: { warehouse_id: wh_id }
      });

      showToast("Sale transaction logged successfully", "success");
      setLogFormOpen(false);
      
      // Reset form
      setNewSale({
        product_id: products[0]?.id.toString() || '',
        warehouse_id: warehouses[0]?.id.toString() || '',
        quantity_sold: '',
        custom_revenue: ''
      });
      
      fetchData(); // reload sales
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || "Failed to log sale. Verify warehouse stock levels.", "error");
    } finally {
      setLoggingSale(false);
    }
  };

  // Filter sales based on search text
  const filteredSales = sales.filter(s => {
    if (!search) return true;
    const term = search.toLowerCase();
    const prodName = s.product?.name.toLowerCase() || '';
    const sku = s.product?.sku.toLowerCase() || '';
    return prodName.includes(term) || sku.includes(term);
  });

  return (
    <div className="space-y-6">
      
      {/* HEADER SECTION CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Order Register</h3>
          <p className="text-sm text-slate-500">Record consumer sales and track order history logs</p>
        </div>
        
        <div>
          <button
            onClick={() => setLogFormOpen(true)}
            className="btn-primary flex items-center gap-2 text-xs"
          >
            <ShoppingBag className="w-4 h-4" />
            Log a Sale
          </button>
        </div>
      </div>

      {/* FILTERS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
        
        {/* Search */}
        <div className="relative md:col-span-2">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Filter sales by Product Name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {/* Start Date */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-400 uppercase">From:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-350 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {/* End Date */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-slate-400 uppercase">To:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-350 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </div>

      {/* SALES HISTORY TABLE */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse">
            <thead>
              <tr>
                <th className="table-header">Transaction ID</th>
                <th className="table-header">Date & Time</th>
                <th className="table-header">SKU</th>
                <th className="table-header">Product</th>
                <th className="table-header text-center">Unit Price</th>
                <th className="table-header text-center">Quantity Sold</th>
                <th className="table-header text-right">Total Revenue</th>
              </tr>
            </thead>
            
            <tbody>
              {loading ? (
                [1, 2, 3, 4].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td className="table-cell"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16" /></td>
                    <td className="table-cell"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-28" /></td>
                    <td className="table-cell"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16" /></td>
                    <td className="table-cell"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-36" /></td>
                    <td className="table-cell text-center"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-12 mx-auto" /></td>
                    <td className="table-cell text-center"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-10 mx-auto" /></td>
                    <td className="table-cell text-right"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-sm text-slate-400">
                    No sales orders found matching filter queries.
                  </td>
                </tr>
              ) : (
                filteredSales.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                    <td className="table-cell font-mono text-xs font-semibold text-slate-400">#SL-{(s.id).toString().padStart(4, '0')}</td>
                    <td className="table-cell text-xs text-slate-500 dark:text-slate-400">
                      {new Date(s.sale_date).toLocaleString()}
                    </td>
                    <td className="table-cell font-mono text-xs font-semibold">{s.product?.sku}</td>
                    <td className="table-cell font-medium">{s.product?.name}</td>
                    <td className="table-cell text-center font-mono text-xs">
                      ₹{s.product?.selling_price.toFixed(2) || '0.00'}
                    </td>
                    <td className="table-cell text-center font-semibold font-mono text-xs text-slate-500 dark:text-slate-350">
                      {s.quantity_sold}
                    </td>
                    <td className="table-cell text-right font-extrabold text-brand-600 dark:text-brand-400">
                      ₹{s.revenue.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: LOG SALE */}
      {logFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden p-6 animate-slide-up">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-brand-500" />
                Register Sales Order
              </h3>
              <button onClick={() => setLogFormOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleLogSale} className="space-y-4">
              {/* Product selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Select Sold Product *</label>
                <select
                  value={newSale.product_id}
                  onChange={(e) => setNewSale({ ...newSale, product_id: e.target.value })}
                  className="input-field text-sm text-slate-600 dark:text-slate-350"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.sku} - {p.name} (₹{p.selling_price.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Warehouse source selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Deduct Stock From Warehouse *</label>
                <select
                  value={newSale.warehouse_id}
                  onChange={(e) => setNewSale({ ...newSale, warehouse_id: e.target.value })}
                  className="input-field text-sm text-slate-600 dark:text-slate-350"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Quantity Sold *</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 5"
                  value={newSale.quantity_sold}
                  onChange={(e) => setNewSale({ ...newSale, quantity_sold: e.target.value })}
                  className="input-field text-sm"
                />
              </div>

              {/* Price/Revenue custom overrides */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Custom Revenue (₹) <span className="text-[10px] text-slate-400 font-medium">(Optional - leaves default)</span></label>
                <input
                  type="number"
                  step="0.01"
                  placeholder={`Default: ₹${calculatedRevenuePreview().toFixed(2)}`}
                  value={newSale.custom_revenue}
                  onChange={(e) => setNewSale({ ...newSale, custom_revenue: e.target.value })}
                  className="input-field text-sm"
                />
              </div>

              {/* Calculated info */}
              <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl flex justify-between text-xs font-semibold text-slate-500">
                <span>Calculated Billing:</span>
                <span className="text-brand-600 dark:text-brand-400">₹{calculatedRevenuePreview().toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setLogFormOpen(false)} className="btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={loggingSale} className="btn-primary text-xs flex items-center gap-1.5">
                  {loggingSale && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
