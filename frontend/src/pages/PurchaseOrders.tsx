import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  FileSpreadsheet, Plus, Check, Truck, Clock, X, Calendar, ArrowUpRight, 
  Warehouse, Loader2, ClipboardCheck 
} from 'lucide-react';

interface PurchaseOrder {
  id: number;
  product_id: number;
  quantity: number;
  status: string; // pending, ordered, received
  order_date: string;
  expected_date: string;
  product?: {
    sku: string;
    name: string;
    cost_price: number;
    supplier?: {
      name: string;
    };
  };
}

interface ProductData {
  id: number;
  name: string;
  sku: string;
}

interface WarehouseData {
  id: number;
  name: string;
}

export const PurchaseOrders: React.FC = () => {
  const { hasRole } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();

  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
  const [loading, setLoading] = useState(true);

  // Form modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newPo, setNewPo] = useState({
    product_id: '',
    quantity: '',
    expected_date: ''
  });
  const [savingPo, setSavingPo] = useState(false);

  // Receive stock modal state
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [receiveData, setReceiveData] = useState({
    po_id: 0,
    warehouse_id: ''
  });
  const [submittingReceipt, setSubmittingReceipt] = useState(false);

  // Load state parameters if redirected from forecast or alert bell
  const stateParams = location.state as { product_id?: number; sku?: string; name?: string; qty?: number } | null;

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Products
      const prodRes = await axios.get('/products');
      setProducts(prodRes.data);

      // Fetch Warehouses
      const whRes = await axios.get('/warehouses');
      setWarehouses(whRes.data);
      if (whRes.data.length > 0) {
        setReceiveData(prev => ({ ...prev, warehouse_id: whRes.data[0].id.toString() }));
      }

      // Fetch POs
      await refreshPOs();
    } catch (err) {
      console.error(err);
      showToast("Error loading purchase orders logs", "error");
    } finally {
      setLoading(false);
    }
  };

  const refreshPOs = async () => {
    const poRes = await axios.get('/purchase-orders');
    setPurchaseOrders(poRes.data);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Listen to navigation state parameters (e.g. when user clicks "Generate PO" from predictions)
  useEffect(() => {
    if (stateParams?.product_id) {
      setNewPo({
        product_id: stateParams.product_id.toString(),
        quantity: stateParams.qty ? stateParams.qty.toString() : '50',
        expected_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 7 days out
      });
      setCreateModalOpen(true);
    }
  }, [stateParams]);

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPo.product_id || !newPo.quantity || !newPo.expected_date) {
      showToast("Please fill in all fields", "warning");
      return;
    }

    setSavingPo(true);
    try {
      const payload = {
        product_id: Number(newPo.product_id),
        quantity: Number(newPo.quantity),
        status: 'pending',
        expected_date: new Date(newPo.expected_date).toISOString()
      };

      await axios.post('/purchase-orders', payload);
      showToast("Purchase order generated successfully", "success");
      setCreateModalOpen(false);
      
      // Reset form
      setNewPo({
        product_id: products[0]?.id.toString() || '',
        quantity: '',
        expected_date: ''
      });
      
      refreshPOs();
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || "Failed to generate purchase order", "error");
    } finally {
      setSavingPo(false);
    }
  };

  const handleUpdateStatus = async (id: number, status: string) => {
    if (status === 'received') {
      // Open modal to select target warehouse
      setReceiveData(prev => ({ ...prev, po_id: id }));
      setReceiveModalOpen(true);
      return;
    }

    try {
      await axios.put(`/purchase-orders/${id}`, { status });
      showToast(`Purchase order marked as ${status}`, "success");
      refreshPOs();
    } catch (err: any) {
      console.error(err);
      showToast("Failed to update status", "error");
    }
  };

  const handleReceiveConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReceipt(true);
    try {
      await axios.put(`/purchase-orders/${receiveData.po_id}`, 
        { status: 'received' },
        { params: { warehouse_id: Number(receiveData.warehouse_id) } }
      );
      
      showToast("Purchase order marked as RECEIVED. Stock added to warehouse.", "success");
      setReceiveModalOpen(false);
      refreshPOs();
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || "Failed to receive purchase order stock", "error");
    } finally {
      setSubmittingReceipt(false);
    }
  };

  // Helper to color codes
  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'received') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
          <Check className="w-3 h-3" /> Received
        </span>
      );
    }
    if (s === 'ordered') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded-full">
          <Truck className="w-3 h-3 animate-bounce" /> Ordered
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
        <Clock className="w-3 h-3" /> Pending
      </span>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER SECTION CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Logistics Desk</h3>
          <p className="text-sm text-slate-500">Track and generate restocking procurement purchase orders</p>
        </div>
        
        <div>
          {hasRole(['admin', 'manager']) && (
            <button
              onClick={() => {
                if (products.length > 0) {
                  setNewPo(prev => ({
                    ...prev,
                    product_id: products[0].id.toString(),
                    expected_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                  }));
                }
                setCreateModalOpen(true);
              }}
              className="btn-primary flex items-center gap-2 text-xs"
            >
              <Plus className="w-4 h-4" />
              Generate PO
            </button>
          )}
        </div>
      </div>

      {/* PO LIST TABLE */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr>
                <th className="table-header">Order ID</th>
                <th className="table-header">Date Generated</th>
                <th className="table-header">Product SKU</th>
                <th className="table-header">Description</th>
                <th className="table-header">Supplier</th>
                <th className="table-header text-center">Unit Cost</th>
                <th className="table-header text-center">Quantity</th>
                <th className="table-header text-center">Status</th>
                <th className="table-header text-center">Delivery Estimate</th>
                <th className="table-header text-right">Workflow Actions</th>
              </tr>
            </thead>
            
            <tbody>
              {loading ? (
                [1, 2, 3].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td className="table-cell"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16" /></td>
                    <td className="table-cell"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20" /></td>
                    <td className="table-cell"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16" /></td>
                    <td className="table-cell"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-36" /></td>
                    <td className="table-cell"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-28" /></td>
                    <td className="table-cell text-center"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-10 mx-auto" /></td>
                    <td className="table-cell text-center"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-10 mx-auto" /></td>
                    <td className="table-cell text-center"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16 mx-auto" /></td>
                    <td className="table-cell text-center"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20 mx-auto" /></td>
                    <td className="table-cell text-right"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24 ml-auto" /></td>
                  </tr>
                ))
              ) : purchaseOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-sm text-slate-400">
                    No active or historical purchase orders logs found.
                  </td>
                </tr>
              ) : (
                purchaseOrders.map((po) => {
                  const unitCost = po.product?.cost_price || 0;
                  const totalCost = po.quantity * unitCost;
                  
                  return (
                    <tr key={po.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                      <td className="table-cell font-mono text-xs font-semibold text-slate-400">#PO-{po.id.toString().padStart(4, '0')}</td>
                      <td className="table-cell text-xs text-slate-500 dark:text-slate-400">
                        {new Date(po.order_date).toLocaleDateString()}
                      </td>
                      <td className="table-cell font-mono text-xs font-semibold">{po.product?.sku}</td>
                      <td className="table-cell font-medium max-w-[180px] truncate" title={po.product?.name}>{po.product?.name}</td>
                      <td className="table-cell text-xs text-slate-500 truncate max-w-[150px]">{po.product?.supplier?.name || 'Acme Supplier'}</td>
                      <td className="table-cell text-center font-mono text-xs">₹{unitCost.toFixed(2)}</td>
                      <td className="table-cell text-center font-bold font-mono text-xs">{po.quantity}</td>
                      <td className="table-cell text-center">{getStatusBadge(po.status)}</td>
                      <td className="table-cell text-center text-xs text-slate-500">
                        {new Date(po.expected_date).toLocaleDateString()}
                      </td>
                      <td className="table-cell text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1.5">
                          {po.status === 'pending' && (
                            <button
                              onClick={() => handleUpdateStatus(po.id, 'ordered')}
                              className="px-2.5 py-1 bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 text-xs font-semibold rounded-lg transition-all"
                            >
                              Dispatch Order
                            </button>
                          )}
                          {po.status === 'ordered' && (
                            <button
                              onClick={() => handleUpdateStatus(po.id, 'received')}
                              className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 text-xs font-semibold rounded-lg transition-all flex items-center gap-1"
                            >
                              <ClipboardCheck className="w-3.5 h-3.5" />
                              Receive Stock
                            </button>
                          )}
                          {po.status === 'received' && (
                            <span className="text-[10px] text-slate-400 font-semibold italic">Fulfilled</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: CREATE PURCHASE ORDER */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden p-6 animate-slide-up">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-brand-500" />
                Generate Purchase Order
              </h3>
              <button onClick={() => setCreateModalOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleCreatePO} className="space-y-4">
              {/* Product selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Select Product *</label>
                <select
                  value={newPo.product_id}
                  onChange={(e) => setNewPo({ ...newPo, product_id: e.target.value })}
                  className="input-field text-sm text-slate-600 dark:text-slate-350"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Order Quantity *</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 100"
                  value={newPo.quantity}
                  onChange={(e) => setNewPo({ ...newPo, quantity: e.target.value })}
                  className="input-field text-sm"
                />
              </div>

              {/* Expected date */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Expected Delivery Date *</label>
                <input
                  type="date"
                  required
                  value={newPo.expected_date}
                  onChange={(e) => setNewPo({ ...newPo, expected_date: e.target.value })}
                  className="input-field text-sm text-slate-600 dark:text-slate-350"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setCreateModalOpen(false)} className="btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={savingPo} className="btn-primary text-xs flex items-center gap-1.5">
                  {savingPo && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Issue PO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECEIVE INVENTORY SELECT WAREHOUSE */}
      {receiveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-2xl shadow-xl overflow-hidden p-6 animate-slide-up">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-emerald-500" />
                Receive PO Stock
              </h3>
              <button onClick={() => setReceiveModalOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleReceiveConfirm} className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                  Select which warehouse location this procurement batch is being received into:
                </p>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Target Warehouse *</label>
                <select
                  value={receiveData.warehouse_id}
                  onChange={(e) => setReceiveData({ ...receiveData, warehouse_id: e.target.value })}
                  className="input-field text-sm text-slate-600 dark:text-slate-350"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setReceiveModalOpen(false)} className="btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={submittingReceipt} className="btn-primary text-xs flex items-center gap-1.5">
                  {submittingReceipt && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Delivery
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
