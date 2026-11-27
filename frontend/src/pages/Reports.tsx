import React, { useState } from 'react';
import axios from 'axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { 
  FileText, Download, FileSpreadsheet, Eye, ClipboardList, Info, 
  HelpCircle, CheckCircle, Loader2 
} from 'lucide-react';

export const Reports: React.FC = () => {
  const { showToast } = useToast();
  const { user } = useAuth();
  
  const [reportType, setReportType] = useState<'sales' | 'inventory'>('sales');
  const [reportFormat, setReportFormat] = useState<'pdf' | 'csv'>('pdf');
  const [downloading, setDownloading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);

  // Function to download the report from backend
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const response = await axios.get('/reports/export', {
        params: { type: reportType, format: reportFormat },
        responseType: 'blob', // crucial for file binary downloads
      });

      // Create browser link to trigger download
      const contentType = (response.headers['content-type'] as string) || 'application/octet-stream';
      const blob = new Blob([response.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const fileExtension = reportFormat.toLowerCase();
      link.setAttribute('download', `${reportType}_report_${new Date().toISOString().split('T')[0]}.${fileExtension}`);
      
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      showToast(`${reportType.toUpperCase()} report downloaded in ${reportFormat.toUpperCase()} format`, "success");
    } catch (err: any) {
      console.error(err);
      showToast("Failed to export report from backend", "error");
    } finally {
      setDownloading(false);
    }
  };

  // Generate a live preview inside the dashboard
  const handlePreview = async () => {
    setPreviewing(true);
    try {
      if (reportType === 'sales') {
        const res = await axios.get('/sales');
        setPreviewData(res.data.slice(0, 10)); // preview top 10
      } else {
        const res = await axios.get('/inventory');
        setPreviewData(res.data.slice(0, 10));
      }
      showToast("Generated preview list", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to generate preview dataset", "error");
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="space-y-6">
      
      <div>
        <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Reports Center</h3>
        <p className="text-sm text-slate-500">Compile sales progression ledgers and inventory asset value summaries</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* REPORT GENERATION PANEL */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <ClipboardList className="w-5 h-5 text-brand-500" />
              <h4 className="font-bold text-sm text-slate-850 dark:text-slate-100">Export Settings</h4>
            </div>

            {/* Select Report Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">Report Summary Category</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
                <button
                  onClick={() => { setReportType('sales'); setPreviewData([]); }}
                  className={`py-2.5 text-xs font-semibold rounded-lg transition-all
                    ${reportType === 'sales' 
                      ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-850'}
                  `}
                >
                  Sales History
                </button>
                <button
                  onClick={() => { setReportType('inventory'); setPreviewData([]); }}
                  className={`py-2.5 text-xs font-semibold rounded-lg transition-all
                    ${reportType === 'inventory' 
                      ? 'bg-white dark:bg-slate-900 text-brand-600 dark:text-brand-400 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-850'}
                  `}
                >
                  Inventory Balances
                </button>
              </div>
            </div>

            {/* Select Format */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2">File Format</label>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl">
                <button
                  onClick={() => setReportFormat('pdf')}
                  className={`py-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all
                    ${reportFormat === 'pdf' 
                      ? 'bg-white dark:bg-slate-900 text-rose-500 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-850'}
                  `}
                >
                  <FileText className="w-4 h-4" />
                  Adobe PDF
                </button>
                <button
                  onClick={() => setReportFormat('csv')}
                  className={`py-2.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all
                    ${reportFormat === 'csv' 
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-850'}
                  `}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Excel CSV
                </button>
              </div>
            </div>

            {/* Help Alert */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 rounded-xl flex items-start gap-2.5 text-xs text-slate-400">
              <Info className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
              <p className="leading-normal">
                PDF reports compile detailed document titles, summaries, and totals formatted for distribution. CSV reports export raw rows suitable for loading in third party BI systems.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handlePreview}
              disabled={previewing}
              className="btn-secondary text-xs flex items-center justify-center gap-1.5"
            >
              {previewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
              Live Preview
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="btn-primary text-xs flex items-center justify-center gap-1.5"
            >
              {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              Download
            </button>
          </div>
        </div>

        {/* PREVIEW CONTAINER */}
        <div className="lg:col-span-2 glass-card p-6 flex flex-col justify-between min-h-[400px]">
          <div>
            <h4 className="font-bold text-sm text-slate-850 dark:text-slate-100 mb-1">Document Preview Window</h4>
            <p className="text-xs text-slate-400 mb-5">Mock structure of first 10 database rows</p>
            
            {previewData.length > 0 ? (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-850 rounded-xl">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    {reportType === 'sales' ? (
                      <tr className="bg-slate-100 dark:bg-slate-950 font-bold">
                        <th className="p-2 border-b border-slate-200 dark:border-slate-800">Date</th>
                        <th className="p-2 border-b border-slate-200 dark:border-slate-800">SKU</th>
                        <th className="p-2 border-b border-slate-200 dark:border-slate-800">Product</th>
                        <th className="p-2 border-b border-slate-200 dark:border-slate-800 text-center">Qty</th>
                        <th className="p-2 border-b border-slate-200 dark:border-slate-800 text-right">Revenue</th>
                      </tr>
                    ) : (
                      <tr className="bg-slate-100 dark:bg-slate-950 font-bold">
                        <th className="p-2 border-b border-slate-200 dark:border-slate-800">SKU</th>
                        <th className="p-2 border-b border-slate-200 dark:border-slate-800">Product Name</th>
                        <th className="p-2 border-b border-slate-200 dark:border-slate-800">Location</th>
                        <th className="p-2 border-b border-slate-200 dark:border-slate-800 text-center">In Stock</th>
                        <th className="p-2 border-b border-slate-200 dark:border-slate-800 text-center">Reorder Lvl</th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {reportType === 'sales' 
                      ? previewData.map((row: any) => (
                          <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                            <td className="p-2 border-b border-slate-150 dark:border-slate-900">{new Date(row.sale_date).toLocaleDateString()}</td>
                            <td className="p-2 border-b border-slate-150 dark:border-slate-900 font-mono font-semibold">{row.product?.sku}</td>
                            <td className="p-2 border-b border-slate-150 dark:border-slate-900 truncate max-w-[120px]">{row.product?.name}</td>
                            <td className="p-2 border-b border-slate-150 dark:border-slate-900 text-center font-mono">{row.quantity_sold}</td>
                            <td className="p-2 border-b border-slate-150 dark:border-slate-900 text-right font-bold font-mono">₹{row.revenue.toFixed(2)}</td>
                          </tr>
                        ))
                      : previewData.map((row: any) => (
                          <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10">
                            <td className="p-2 border-b border-slate-150 dark:border-slate-900 font-mono font-semibold">{row.product?.sku}</td>
                            <td className="p-2 border-b border-slate-150 dark:border-slate-900 truncate max-w-[150px]">{row.product?.name}</td>
                            <td className="p-2 border-b border-slate-150 dark:border-slate-900">{row.warehouse?.name}</td>
                            <td className="p-2 border-b border-slate-150 dark:border-slate-900 text-center font-mono font-bold">{row.quantity}</td>
                            <td className="p-2 border-b border-slate-150 dark:border-slate-900 text-center font-mono">{row.product?.reorder_level}</td>
                          </tr>
                        ))
                    }
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-8 py-16 text-slate-400">
                <HelpCircle className="w-10 h-10 text-slate-350 dark:text-slate-700 mb-2" />
                <span className="text-xs font-semibold">Preview container empty</span>
                <p className="text-[10px] text-slate-400/80 mt-1 max-w-[200px] text-center">Click "Live Preview" to fetch active metrics logs.</p>
              </div>
            )}
          </div>
          
          <div className="text-[10px] text-slate-400 font-semibold mt-4 text-right">
            Verified report schema standard: v1.0.0
          </div>
        </div>

      </div>

    </div>
  );
};
