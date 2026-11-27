import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Plus, Edit2, Check, X, Search, SlidersHorizontal, ArrowUpDown, Trash2, 
  Warehouse, ArrowUpRight, ArrowDownLeft, Loader2 
} from 'lucide-react';

interface Product {
  id: number;
  name: string;
  sku: string;
  category: string;
  cost_price: number;
  selling_price: number;
  reorder_level: number;
  supplier_id: number;
  supplier?: {
    id: number;
    name: string;
  };
}

interface InventoryItem {
  id: number;
  product_id: number;
  warehouse_id: number;
  quantity: number;
  product: Product;
  warehouse: {
    id: number;
    name: string;
    location: string;
  };
}

interface WarehouseData {
  id: number;
  name: string;
  location: string;
}

interface SupplierData {
  id: number;
  name: string;
  contact: string;
}

export const Inventory: React.FC = () => {
  const { hasRole } = useAuth();
  const { showToast } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierData[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter and Sorting state
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [sortBy, setSortBy] = useState('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Inline editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});

  // Add Product state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '', sku: '', category: 'Electronics', cost_price: '', selling_price: '', reorder_level: '10', supplier_id: ''
  });
  const [savingProduct, setSavingProduct] = useState(false);

  // Stock Adjustment state
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustData, setAdjustData] = useState({
    product_id: '', warehouse_id: '', quantity_change: '', type: 'stock_in' // stock_in, stock_out
  });
  const [submittingAdjustment, setSubmittingAdjustment] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Warehouses and Suppliers
      const whRes = await axios.get('/warehouses');
      setWarehouses(whRes.data);
      
      const supRes = await axios.get('/suppliers');
      setSuppliers(supRes.data);
      if (supRes.data.length > 0) {
        setNewProduct(prev => ({ ...prev, supplier_id: supRes.data[0].id.toString() }));
      }
      
      // 2. Fetch Products and Inventory
      await refreshProducts();
      await refreshInventory();
      
    } catch (err) {
      console.error(err);
      showToast("Error loading inventory database details", "error");
    } finally {
      setLoading(false);
    }
  };

  const refreshProducts = async () => {
    const prodRes = await axios.get('/products', {
      params: {
        search: search || undefined,
        category: categoryFilter || undefined,
        supplier_id: supplierFilter || undefined,
        sort_by: sortBy,
        sort_order: sortOrder
      }
    });
    setProducts(prodRes.data);
  };

  const refreshInventory = async () => {
    const invRes = await axios.get('/inventory');
    setInventory(invRes.data);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Refresh products on filter/sort changes
  useEffect(() => {
    refreshProducts();
  }, [search, categoryFilter, supplierFilter, sortBy, sortOrder]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // Inline editing handlers
  const startEditing = (p: Product) => {
    setEditingId(p.id);
    setEditForm({ ...p });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveInlineEdit = async (id: number) => {
    try {
      const data = {
        name: editForm.name,
        category: editForm.category,
        cost_price: Number(editForm.cost_price),
        selling_price: Number(editForm.selling_price),
        reorder_level: Number(editForm.reorder_level),
      };
      
      const res = await axios.put(`/products/${id}`, data);
      showToast(`Product "${res.data.name}" updated successfully`, "success");
      setEditingId(null);
      refreshProducts();
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || "Failed to update product details", "error");
    }
  };

  // Add Product handler
  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.sku || !newProduct.cost_price || !newProduct.selling_price || !newProduct.supplier_id) {
      showToast("Please fill in all required product fields", "warning");
      return;
    }
    
    setSavingProduct(true);
    try {
      const data = {
        ...newProduct,
        cost_price: Number(newProduct.cost_price),
        selling_price: Number(newProduct.selling_price),
        reorder_level: Number(newProduct.reorder_level),
        supplier_id: Number(newProduct.supplier_id)
      };
      
      await axios.post('/products', data);
      showToast("Product registered and added to inventory databases", "success");
      setAddModalOpen(false);
      
      // Clear form
      setNewProduct({
        name: '', sku: '', category: 'Electronics', cost_price: '', selling_price: '', reorder_level: '10', supplier_id: suppliers[0]?.id.toString() || ''
      });
      
      fetchData(); // reload
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || "Failed to create product", "error");
    } finally {
      setSavingProduct(false);
    }
  };

  // Delete Product Handler
  const handleDeleteProduct = async (id: number) => {
    if (!window.confirm("Are you sure you want to permanently delete this product? All inventory stock logs will be removed!")) return;
    try {
      await axios.delete(`/products/${id}`);
      showToast("Product permanently deleted", "success");
      fetchData();
    } catch (err: any) {
      console.error(err);
      showToast("Failed to delete product", "error");
    }
  };

  // Stock Adjustment handler
  const handleStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustData.product_id || !adjustData.warehouse_id || !adjustData.quantity_change) {
      showToast("Please complete all stock adjustment options", "warning");
      return;
    }
    
    setSubmittingAdjustment(true);
    try {
      const isOut = adjustData.type === 'stock_out';
      const qtyChange = Number(adjustData.quantity_change) * (isOut ? -1 : 1);
      
      const payload = {
        product_id: Number(adjustData.product_id),
        warehouse_id: Number(adjustData.warehouse_id),
        quantity_change: qtyChange,
        transaction_type: isOut ? 'stock_out' : 'stock_in'
      };
      
      await axios.post('/inventory/transaction', payload);
      showToast(`Stock levels successfully adjusted (${qtyChange > 0 ? '+' : ''}${qtyChange} units)`, "success");
      setAdjustModalOpen(false);
      setAdjustData(prev => ({ ...prev, quantity_change: '' }));
      
      fetchData(); // reload values
    } catch (err: any) {
      console.error(err);
      showToast(err.response?.data?.detail || "Failed to adjust stock levels", "error");
    } finally {
      setSubmittingAdjustment(false);
    }
  };

  // Helper to sum stock across warehouses
  const getProductTotalStock = (productId: number) => {
    return inventory
      .filter(item => item.product_id === productId)
      .reduce((sum, item) => sum + item.quantity, 0);
  };

  // Helper to fetch warehouse-specific stocks
  const getProductWarehouseStock = (productId: number, whId: number) => {
    const item = inventory.find(i => i.product_id === productId && i.warehouse_id === whId);
    return item ? item.quantity : 0;
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER SECTION CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Storage Ledger</h3>
          <p className="text-sm text-slate-500">Manage products catalog, check levels, and adjust stock</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (products.length > 0) {
                setAdjustData(prev => ({
                  ...prev,
                  product_id: products[0].id.toString(),
                  warehouse_id: warehouses[0]?.id.toString() || ''
                }));
              }
              setAdjustModalOpen(true);
            }}
            className="btn-secondary flex items-center gap-2 text-xs"
          >
            <Warehouse className="w-4 h-4" />
            Stock In/Out
          </button>
          
          {hasRole(['admin', 'manager']) && (
            <button
              onClick={() => setAddModalOpen(true)}
              className="btn-primary flex items-center gap-2 text-xs"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          )}
        </div>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-sm">
        
        {/* Search */}
        <div className="relative md:col-span-2">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Product Name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {/* Category Filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-600 dark:text-slate-300"
        >
          <option value="">All Categories</option>
          <option value="Electronics">Electronics</option>
          <option value="Office Supplies">Office Supplies</option>
          <option value="Apparel">Apparel</option>
          <option value="Home & Kitchen">Home & Kitchen</option>
          <option value="Accessories">Accessories</option>
        </select>

        {/* Supplier Filter */}
        <select
          value={supplierFilter}
          onChange={(e) => setSupplierFilter(e.target.value)}
          className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-600 dark:text-slate-300"
        >
          <option value="">All Suppliers</option>
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {/* PRODUCTS & STOCKS TABLE */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse">
            <thead>
              <tr>
                <th onClick={() => handleSort('sku')} className="table-header cursor-pointer select-none">
                  SKU <ArrowUpDown className="inline w-3 h-3 ml-1" />
                </th>
                <th onClick={() => handleSort('name')} className="table-header cursor-pointer select-none">
                  Product Name <ArrowUpDown className="inline w-3 h-3 ml-1" />
                </th>
                <th onClick={() => handleSort('category')} className="table-header cursor-pointer select-none">
                  Category <ArrowUpDown className="inline w-3 h-3 ml-1" />
                </th>
                <th onClick={() => handleSort('cost_price')} className="table-header cursor-pointer select-none">
                  Cost <ArrowUpDown className="inline w-3 h-3 ml-1" />
                </th>
                <th onClick={() => handleSort('selling_price')} className="table-header cursor-pointer select-none">
                  Selling Price <ArrowUpDown className="inline w-3 h-3 ml-1" />
                </th>
                {warehouses.map(w => (
                  <th key={w.id} className="table-header font-bold text-center">
                    {w.name.split(' ')[0]}
                  </th>
                ))}
                <th className="table-header text-center">Total Stock</th>
                <th className="table-header text-center">Reorder Lvl</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            
            <tbody>
              {loading ? (
                [1, 2, 3, 4, 5].map(i => (
                  <tr key={i} className="animate-pulse">
                    <td className="table-cell"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16" /></td>
                    <td className="table-cell"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-32" /></td>
                    <td className="table-cell"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20" /></td>
                    <td className="table-cell"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-12" /></td>
                    <td className="table-cell"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-12" /></td>
                    {warehouses.map(w => (
                      <td key={w.id} className="table-cell text-center"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-8 mx-auto" /></td>
                    ))}
                    <td className="table-cell text-center"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-8 mx-auto" /></td>
                    <td className="table-cell text-center"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-8 mx-auto" /></td>
                    <td className="table-cell text-right"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8 + warehouses.length} className="py-12 text-center text-sm text-slate-400">
                    No products matching filter criteria.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isEditing = editingId === p.id;
                  const totalStock = getProductTotalStock(p.id);
                  const isLowStock = totalStock < p.reorder_level;
                  
                  return (
                    <tr 
                      key={p.id} 
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors
                        ${isLowStock ? 'bg-rose-500/[0.02]' : ''}
                      `}
                    >
                      {/* SKU */}
                      <td className="table-cell font-mono text-xs font-semibold">{p.sku}</td>
                      
                      {/* Product Name */}
                      <td className="table-cell font-medium">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.name || ''}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs focus:ring-1 focus:ring-brand-500 w-full"
                          />
                        ) : (
                          p.name
                        )}
                      </td>
                      
                      {/* Category */}
                      <td className="table-cell text-xs">
                        {isEditing ? (
                          <select
                            value={editForm.category || ''}
                            onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                            className="px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs"
                          >
                            <option value="Electronics">Electronics</option>
                            <option value="Office Supplies">Office Supplies</option>
                            <option value="Apparel">Apparel</option>
                            <option value="Home & Kitchen">Home & Kitchen</option>
                            <option value="Accessories">Accessories</option>
                          </select>
                        ) : (
                          p.category
                        )}
                      </td>
                      
                      {/* Cost price */}
                      <td className="table-cell">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.cost_price || ''}
                            onChange={(e) => setEditForm({ ...editForm, cost_price: Number(e.target.value) })}
                            className="px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs w-16"
                          />
                        ) : (
                          `₹${p.cost_price.toFixed(2)}`
                        )}
                      </td>
                      
                      {/* Selling price */}
                      <td className="table-cell">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.selling_price || ''}
                            onChange={(e) => setEditForm({ ...editForm, selling_price: Number(e.target.value) })}
                            className="px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs w-16"
                          />
                        ) : (
                          `₹${p.selling_price.toFixed(2)}`
                        )}
                      </td>

                      {/* Warehouse balances */}
                      {warehouses.map(w => (
                        <td key={w.id} className="table-cell text-center font-mono text-xs text-slate-500 dark:text-slate-400">
                          {getProductWarehouseStock(p.id, w.id)}
                        </td>
                      ))}

                      {/* Total Stock */}
                      <td className="table-cell text-center font-bold font-mono">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold
                          ${isLowStock 
                            ? 'text-rose-600 bg-rose-500/10 dark:text-rose-400' 
                            : 'text-slate-700 bg-slate-100 dark:text-slate-300 dark:bg-slate-800'}
                        `}>
                          {totalStock}
                        </span>
                      </td>

                      {/* Reorder Level */}
                      <td className="table-cell text-center font-mono font-medium">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editForm.reorder_level || ''}
                            onChange={(e) => setEditForm({ ...editForm, reorder_level: Number(e.target.value) })}
                            className="px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs w-16"
                          />
                        ) : (
                          p.reorder_level
                        )}
                      </td>

                      {/* Actions */}
                      <td className="table-cell text-right whitespace-nowrap">
                        {isEditing ? (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => saveInlineEdit(p.id)}
                              className="p-1 text-emerald-500 hover:bg-emerald-500/15 rounded-lg transition-all"
                              title="Save Changes"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-1.5">
                            {hasRole(['admin', 'manager']) && (
                              <button
                                onClick={() => startEditing(p)}
                                className="p-1 text-slate-400 hover:text-brand-600 hover:bg-brand-500/10 rounded-lg transition-all"
                                title="Edit Product"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            {hasRole(['admin']) && (
                              <button
                                onClick={() => handleDeleteProduct(p.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 rounded-lg transition-all"
                                title="Delete Product"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ADD PRODUCT */}
      {addModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden p-6 animate-slide-up">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100">Add New Product to System</h3>
              <button onClick={() => setAddModalOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleAddProduct} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    className="input-field text-sm"
                    placeholder="e.g. Ergonomic Office Desk"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                    className="input-field text-sm font-mono"
                    placeholder="e.g. OFF-012"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Category *</label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    className="input-field text-sm text-slate-600 dark:text-slate-350"
                  >
                    <option value="Electronics">Electronics</option>
                    <option value="Office Supplies">Office Supplies</option>
                    <option value="Apparel">Apparel</option>
                    <option value="Home & Kitchen">Home & Kitchen</option>
                    <option value="Accessories">Accessories</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Cost Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newProduct.cost_price}
                    onChange={(e) => setNewProduct({ ...newProduct, cost_price: e.target.value })}
                    className="input-field text-sm"
                    placeholder="120.00"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newProduct.selling_price}
                    onChange={(e) => setNewProduct({ ...newProduct, selling_price: e.target.value })}
                    className="input-field text-sm"
                    placeholder="199.99"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Reorder Level *</label>
                  <input
                    type="number"
                    required
                    value={newProduct.reorder_level}
                    onChange={(e) => setNewProduct({ ...newProduct, reorder_level: e.target.value })}
                    className="input-field text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Supplier *</label>
                  <select
                    value={newProduct.supplier_id}
                    onChange={(e) => setNewProduct({ ...newProduct, supplier_id: e.target.value })}
                    className="input-field text-sm text-slate-600 dark:text-slate-350"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setAddModalOpen(false)} className="btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={savingProduct} className="btn-primary text-xs flex items-center gap-1.5">
                  {savingProduct && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Register Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STOCK ADJUSTMENT (IN/OUT) */}
      {adjustModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden p-6 animate-slide-up">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="font-bold text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Warehouse className="w-5 h-5 text-brand-500" />
                Record Stock Movement
              </h3>
              <button onClick={() => setAdjustModalOpen(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-850">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleStockAdjustment} className="space-y-4">
              {/* Type Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">Transaction Type</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setAdjustData({ ...adjustData, type: 'stock_in' })}
                    className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all
                      ${adjustData.type === 'stock_in' 
                        ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800'}
                    `}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    Stock IN (Receive)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustData({ ...adjustData, type: 'stock_out' })}
                    className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all
                      ${adjustData.type === 'stock_out' 
                        ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-800'}
                    `}
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                    Stock OUT (Release)
                  </button>
                </div>
              </div>

              {/* Product selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Select Product *</label>
                <select
                  value={adjustData.product_id}
                  onChange={(e) => setAdjustData({ ...adjustData, product_id: e.target.value })}
                  className="input-field text-sm text-slate-600 dark:text-slate-350"
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.sku} - {p.name}</option>
                  ))}
                </select>
              </div>

              {/* Warehouse selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Select Warehouse *</label>
                <select
                  value={adjustData.warehouse_id}
                  onChange={(e) => setAdjustData({ ...adjustData, warehouse_id: e.target.value })}
                  className="input-field text-sm text-slate-600 dark:text-slate-350"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Unit Count *</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 50"
                  value={adjustData.quantity_change}
                  onChange={(e) => setAdjustData({ ...adjustData, quantity_change: e.target.value })}
                  className="input-field text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setAdjustModalOpen(false)} className="btn-secondary text-xs">
                  Cancel
                </button>
                <button type="submit" disabled={submittingAdjustment} className="btn-primary text-xs flex items-center gap-1.5">
                  {submittingAdjustment && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
