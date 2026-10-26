import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Package,
  Tag,
  Warehouse,
  ShoppingCart,
  BarChart3,
  FileDown,
  FileUp,
  Loader2,
  Info,
} from 'lucide-react';
import { importFile, exportFile, listJobs } from '../api/dataExchangeApi';
import { useAuth } from '../context/AuthContext';

const downloadCsv = (filename, csvContent) => {
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const DATA_TYPES = [
  {
    value: 'products',
    label: 'Sản phẩm',
    icon: Package,
    canImport: true,
    canExport: true,
    requiredColumns: ['sku', 'barcode', 'name', 'category', 'cost_price', 'sale_price', 'reorder_level'],
    optionalColumns: ['description', 'is_active'],
    templateCsv: 'sku,barcode,name,description,category,cost_price,sale_price,reorder_level,is_active\nSP-001,8930001111001,Sản phẩm mẫu,Mô tả chi tiết,Văn phòng phẩm,10000,20000,10,true',
  },
  {
    value: 'categories',
    label: 'Danh mục',
    icon: Tag,
    canImport: true,
    canExport: true,
    requiredColumns: ['name'],
    optionalColumns: ['description', 'is_active'],
    templateCsv: 'name,description,is_active\nVăn phòng phẩm,Dụng cụ văn phòng,true',
  },
  {
    value: 'inventory',
    label: 'Tồn kho',
    icon: Warehouse,
    canImport: true,
    canExport: true,
    needsWarehouse: true,
    requiredColumns: ['sku', 'quantity'],
    optionalColumns: [],
    templateCsv: 'sku,quantity\nSP-001,50',
  },
  {
    value: 'orders',
    label: 'Đơn hàng',
    icon: ShoppingCart,
    canImport: false,
    canExport: true,
    needsDateRange: true,
  },
  {
    value: 'sales',
    label: 'Doanh thu',
    icon: BarChart3,
    canImport: false,
    canExport: true,
    needsDateRange: true,
  },
];

const fmtDate = (iso) =>
  iso
    ? new Date(iso).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

const statusLabel = (s) =>
  ({
    completed: 'Thành công',
    processing: 'Đang xử lý',
    failed: 'Thất bại',
    pending: 'Chờ xử lý',
  }[s] || s);

const statusClass = (s) =>
  ({
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    processing: 'bg-blue-50 text-blue-700 border-blue-200',
    failed: 'bg-red-50 text-red-700 border-red-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
  }[s] || 'bg-slate-100 text-slate-700 border-slate-200');

const DataTypeCard = ({ dt, selected, onClick }) => {
  const Icon = dt.icon;
  const isSelected = selected === dt.value;
  return (
    <button
      type="button"
      onClick={() => onClick(dt.value)}
      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border text-left transition ${
        isSelected
          ? 'border-blue-600 bg-blue-50/50 text-blue-700'
          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
        <span className="text-xs font-semibold">{dt.label}</span>
      </div>
      {isSelected && (
        <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
      )}
    </button>
  );
};

const DropZone = ({ onFile, loading, fileName }) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) onFile(f);
    },
    [onFile]
  );

  return (
    <div
      role="button"
      tabIndex={loading ? -1 : 0}
      aria-disabled={loading}
      aria-label={fileName ? `File đã chọn: ${fileName}` : 'Chọn file để nhập dữ liệu'}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !loading && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (!loading && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={`border-2 border-dashed rounded-xl p-8 sm:p-10 text-center cursor-pointer transition ${
        dragging
          ? 'border-blue-500 bg-blue-50/60'
          : 'border-slate-300 bg-white hover:border-blue-500 hover:bg-blue-50/30'
      } ${loading ? 'pointer-events-none opacity-60' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => onFile(e.target.files[0])}
      />
      <div className="flex flex-col items-center gap-2 text-slate-500">
        {loading ? (
          <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
        ) : (
          <FileUp className={`w-8 h-8 ${dragging ? 'text-blue-600' : 'text-blue-500'}`} />
        )}
        <p className="text-xs font-semibold text-slate-700">
          {loading ? 'Đang xử lý file...' : fileName || 'Kéo thả file vào đây hoặc nhấn để chọn'}
        </p>
        {!loading && !fileName && (
          <p className="text-[11px] text-slate-400">Định dạng hỗ trợ: .xlsx, .xls, .csv (tối đa 10 MB)</p>
        )}
      </div>
    </div>
  );
};

const ImportResult = ({ result }) => {
  if (!result) return null;
  const { job, errors, errorDetails } = result;
  const success = errors?.length === 0;

  return (
    <div
      className={`rounded-lg border p-4 space-y-3 ${
        success ? 'border-emerald-200 bg-emerald-50/40' : 'border-red-200 bg-red-50/40'
      }`}
    >
      <div className="flex items-center gap-2">
        {success ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        ) : (
          <XCircle className="w-4 h-4 text-red-600 shrink-0" />
        )}
        <p className={`text-xs font-bold ${success ? 'text-emerald-800' : 'text-red-800'}`}>
          {success
            ? `Nhập thành công ${job?.successRows ?? 0} dòng dữ liệu`
            : `Nhập thất bại – phát hiện ${errors?.length || 1} lỗi, không có dòng nào được lưu`}
        </p>
      </div>

      {job && (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="bg-white border border-slate-200 rounded-md p-2 text-center">
            <p className="font-bold text-slate-900 text-base">{job.totalRows ?? 0}</p>
            <p className="text-[11px] text-slate-500">Tổng số dòng</p>
          </div>
          <div className="bg-white border border-emerald-200 rounded-md p-2 text-center">
            <p className="font-bold text-emerald-700 text-base">{job.successRows ?? 0}</p>
            <p className="text-[11px] text-emerald-600">Thành công</p>
          </div>
          <div className="bg-white border border-red-200 rounded-md p-2 text-center">
            <p className="font-bold text-red-600 text-base">{job.errorRows ?? 0}</p>
            <p className="text-[11px] text-red-500">Lỗi</p>
          </div>
        </div>
      )}

      {errorDetails?.length > 0 && (
        <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
          {errorDetails.map((e, i) => (
            <div
              key={i}
              className="flex items-start gap-1.5 text-xs text-red-700 bg-white border border-red-100 rounded-md px-2.5 py-1.5"
            >
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-500" />
              <span>
                <strong className="font-semibold">Dòng {e.rowNumber}:</strong> {e.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const JobRow = ({ job }) => (
  <tr className="hover:bg-slate-50/80 transition">
    <td className="py-2.5 px-3.5 text-xs text-slate-500">{fmtDate(job.createdAt)}</td>
    <td className="py-2.5 px-3.5">
      <span
        className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border font-semibold ${
          job.operation === 'import'
            ? 'bg-blue-50 text-blue-700 border-blue-200'
            : 'bg-slate-100 text-slate-700 border-slate-200'
        }`}
      >
        {job.operation === 'import' ? <FileUp className="w-3 h-3" /> : <FileDown className="w-3 h-3" />}
        {job.operation === 'import' ? 'Nhập' : 'Xuất'}
      </span>
    </td>
    <td className="py-2.5 px-3.5 text-xs font-medium text-slate-800 capitalize">
      {job.dataType === 'products'
        ? 'Sản phẩm'
        : job.dataType === 'categories'
        ? 'Danh mục'
        : job.dataType === 'inventory'
        ? 'Tồn kho'
        : job.dataType === 'orders'
        ? 'Đơn hàng'
        : job.dataType === 'sales'
        ? 'Doanh thu'
        : job.dataType}
    </td>
    <td className="py-2.5 px-3.5 text-xs text-slate-600 max-w-[160px] truncate" title={job.fileName}>
      {job.fileName || '---'}
    </td>
    <td className="py-2.5 px-3.5 text-xs text-right font-mono text-slate-700">{job.totalRows ?? '—'}</td>
    <td className="py-2.5 px-3.5 text-xs text-right font-mono text-emerald-700">{job.successRows ?? '—'}</td>
    <td className="py-2.5 px-3.5 text-xs text-right font-mono text-red-600">{job.errorRows > 0 ? job.errorRows : '—'}</td>
    <td className="py-2.5 px-3.5">
      <span className={`inline-flex text-[11px] px-2 py-0.5 rounded border font-semibold ${statusClass(job.status)}`}>
        {statusLabel(job.status)}
      </span>
    </td>
  </tr>
);

export const DataExchangePage = () => {
  const { hasPermission } = useAuth();
  const canImport = hasPermission('data_exchange.import');
  const canExport = hasPermission('data_exchange.export');
  const canReadJobs = hasPermission('data_exchange.jobs.read');
  const firstAllowedTab = canImport ? 'import' : canExport ? 'export' : 'jobs';
  const [activeTab, setActiveTab] = useState(firstAllowedTab);
  const [selectedType, setSelectedType] = useState('products');

  // Import state
  const [importFileState, setImportFileState] = useState(null);
  const [warehouseId, setWarehouseId] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Export state
  const [exportType, setExportType] = useState('products');
  const [exportFormat, setExportFormat] = useState('xlsx');
  const [exWarehouseId, setExWarehouseId] = useState('');
  const [exFrom, setExFrom] = useState('');
  const [exTo, setExTo] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState(null);

  // Jobs state
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsMeta, setJobsMeta] = useState({ page: 1, totalPages: 1 });

  const currentDT = DATA_TYPES.find((d) => d.value === selectedType);
  const currentExDT = DATA_TYPES.find((d) => d.value === exportType);

  const fetchJobs = useCallback(async (page = 1) => {
    if (!canReadJobs) return;
    setJobsLoading(true);
    try {
      const res = await listJobs({ page, limit: 15 });
      setJobs(res?.data || []);
      setJobsMeta(res?.pagination || { page: 1, totalPages: 1 });
    } catch {
      /* silent */
    } finally {
      setJobsLoading(false);
    }
  }, [canReadJobs]);

  useEffect(() => {
    if (activeTab === 'jobs') fetchJobs(1);
  }, [activeTab, fetchJobs]);

  const handleFileSelect = (f) => {
    setImportFileState(f);
    setImportResult(null);
  };

  const handleImport = async () => {
    if (!canImport || !importFileState) return;
    setImporting(true);
    setImportResult(null);
    try {
      const res = await importFile(selectedType, importFileState, warehouseId || undefined);
      setImportResult(res);
    } catch (err) {
      setImportResult({
        errors: [err.message],
        errorDetails: [{ rowNumber: 0, message: err.message }],
        job: null,
      });
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async () => {
    if (!canExport) return;
    setExporting(true);
    setExportMsg(null);
    const params = { format: exportFormat };
    if (currentExDT?.needsWarehouse) params.warehouseId = exWarehouseId;
    if (currentExDT?.needsDateRange) {
      params.from = exFrom;
      params.to = exTo;
    }
    try {
      const blob = await exportFile(exportType, params);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportType}-${new Date().toISOString().slice(0, 10)}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportMsg({
        ok: true,
        text: `Xuất dữ liệu ${currentExDT?.label.toLowerCase()} thành công (.${exportFormat.toUpperCase()})`,
      });
    } catch (err) {
      setExportMsg({ ok: false, text: err.message || 'Xuất dữ liệu thất bại' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex-1 p-4 sm:p-5 lg:p-6 space-y-4 lg:space-y-5 bg-[#f8fafc] overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="app-page-title">
            Nhập / Xuất dữ liệu
          </h2>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-wrap items-center gap-1 bg-white border border-slate-200 p-1 rounded-lg shadow-2xs">
          {canImport && <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              activeTab === 'import'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <FileUp className="w-3.5 h-3.5" />
            <span>Nhập dữ liệu</span>
          </button>}
          {canExport && <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              activeTab === 'export'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Xuất dữ liệu</span>
          </button>}
          {canReadJobs && <button
            type="button"
            onClick={() => setActiveTab('jobs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              activeTab === 'jobs'
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Lịch sử</span>
          </button>}
        </div>
      </div>

      {/* TAB 1: NHẬP DỮ LIỆU */}
      {activeTab === 'import' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 lg:gap-6">
          {/* Cột trái: Chọn loại dữ liệu & Cấu trúc file */}
          <div className="lg:col-span-2 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
              1. Chọn loại dữ liệu
            </span>
            <div className="space-y-1.5">
              {DATA_TYPES.filter((d) => d.canImport).map((dt) => (
                <DataTypeCard
                  key={dt.value}
                  dt={dt}
                  selected={selectedType}
                  onClick={(v) => {
                    setSelectedType(v);
                    setImportFileState(null);
                    setImportResult(null);
                  }}
                />
              ))}
            </div>

            {currentDT && (
              <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 shadow-2xs">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <Info className="w-3.5 h-3.5 text-blue-600" />
                  <span>Cột yêu cầu trong file</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
                  <div className="min-w-0 rounded-md bg-blue-50/40 border border-blue-100 p-2.5">
                    <span className="text-[11px] text-slate-500 font-medium block mb-1">
                      Bắt buộc:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {currentDT.requiredColumns?.map((col) => (
                        <span
                          key={col}
                          className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200"
                        >
                          {col}
                        </span>
                      ))}
                    </div>
                  </div>

                  {currentDT.optionalColumns?.length > 0 && (
                    <div className="min-w-0 rounded-md bg-slate-50 border border-slate-200 p-2.5">
                      <span className="text-[11px] text-slate-500 font-medium block mb-1">
                        Tùy chọn:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {currentDT.optionalColumns.map((col) => (
                          <span
                            key={col}
                            className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200"
                          >
                            {col}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {currentDT.templateCsv && (
                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() =>
                        downloadCsv(`mau_${currentDT.value}.csv`, currentDT.templateCsv)
                      }
                      className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-700 bg-slate-50 border border-slate-300 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition font-medium"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span>Tải file mẫu (.csv)</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cột phải: Upload & Thực hiện */}
          <div className="lg:col-span-3 space-y-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
              2. Tải file & Thực hiện
            </span>

            {currentDT?.needsWarehouse && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mã kho hàng (Warehouse ID) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  placeholder="Nhập UUID kho hàng nhận tồn..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white text-slate-900 focus:outline-none focus:border-blue-600 font-mono"
                />
              </div>
            )}

            <DropZone
              onFile={handleFileSelect}
              loading={importing}
              fileName={importFileState?.name}
            />

            {importFileState && !importing && (
              <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3.5 py-2 shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <FileSpreadsheet className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="text-xs font-medium text-slate-800 truncate">
                    {importFileState.name}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    ({(importFileState.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setImportFileState(null);
                    setImportResult(null);
                  }}
                  className="text-xs text-slate-400 hover:text-red-600 transition"
                >
                  Xóa
                </button>
              </div>
            )}

            <button
              type="button"
              id="btn-import-submit"
              onClick={handleImport}
              disabled={
                !importFileState ||
                importing ||
                (currentDT?.needsWarehouse && !warehouseId.trim())
              }
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-2xs transition disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xử lý dữ liệu...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Bắt đầu nhập dữ liệu</span>
                </>
              )}
            </button>

            <ImportResult result={importResult} />
          </div>
        </div>
      )}

      {/* TAB 2: XUẤT DỮ LIỆU */}
      {activeTab === 'export' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 lg:gap-6">
          {/* Cột trái: Chọn loại dữ liệu */}
          <div className="lg:col-span-2 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
              1. Loại dữ liệu cần xuất
            </span>
            <div className="space-y-1.5">
              {DATA_TYPES.filter((d) => d.canExport).map((dt) => (
                <DataTypeCard
                  key={dt.value}
                  dt={dt}
                  selected={exportType}
                  onClick={setExportType}
                />
              ))}
            </div>
          </div>

          {/* Cột phải: Cấu hình và xuất */}
          <div className="lg:col-span-3 space-y-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
              2. Cấu hình & Tải file
            </span>

            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 shadow-2xs">
              {/* Định dạng file */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Định dạng xuất
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { val: 'xlsx', label: 'Excel (.xlsx)', desc: 'Định dạng bảng tính' },
                    { val: 'csv', label: 'CSV (.csv)', desc: 'Dữ liệu thuần UTF-8' },
                  ].map((f) => (
                    <button
                      key={f.val}
                      type="button"
                      onClick={() => setExportFormat(f.val)}
                      className={`p-3 rounded-lg border text-left transition ${
                        exportFormat === f.val
                          ? 'border-blue-600 bg-blue-50/50 text-blue-700'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-semibold">{f.label}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{f.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Warehouse selector nếu cần */}
              {currentExDT?.needsWarehouse && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mã kho hàng (Warehouse ID) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={exWarehouseId}
                    onChange={(e) => setExWarehouseId(e.target.value)}
                    placeholder="Nhập UUID kho hàng cần xuất..."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs bg-white text-slate-900 focus:outline-none focus:border-blue-600 font-mono"
                  />
                </div>
              )}

              {/* Date range nếu cần */}
              {currentExDT?.needsDateRange && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Khoảng thời gian <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <span className="text-[11px] text-slate-500 block mb-1">Từ ngày</span>
                      <input
                        type="date"
                        value={exFrom}
                        onChange={(e) => setExFrom(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block mb-1">Đến ngày</span>
                      <input
                        type="date"
                        value={exTo}
                        onChange={(e) => setExTo(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-xs bg-white text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  {/* Nút chọn nhanh */}
                  <div className="flex gap-1.5 mt-2">
                    {[
                      { label: '7 ngày qua', days: 7 },
                      { label: '30 ngày qua', days: 30 },
                      { label: 'Tháng này', days: 0, thisMonth: true },
                    ].map((q) => (
                      <button
                        key={q.label}
                        type="button"
                        onClick={() => {
                          const to = new Date();
                          let from;
                          if (q.thisMonth) {
                            from = new Date(to.getFullYear(), to.getMonth(), 1);
                          } else {
                            from = new Date(to);
                            from.setDate(to.getDate() - q.days);
                          }
                          setExFrom(from.toISOString().slice(0, 10));
                          setExTo(to.toISOString().slice(0, 10));
                        }}
                        className="text-[11px] bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2 py-0.5 rounded text-slate-600 transition"
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                id="btn-export-submit"
                onClick={handleExport}
                disabled={
                  exporting ||
                  (currentExDT?.needsWarehouse && !exWarehouseId.trim()) ||
                  (currentExDT?.needsDateRange && (!exFrom || !exTo))
                }
                className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-2xs transition disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {exporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang tạo file...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Xuất dữ liệu {currentExDT?.label} (.${exportFormat.toUpperCase()})</span>
                  </>
                )}
              </button>

              {exportMsg && (
                <div
                  className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                    exportMsg.ok
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-700'
                  }`}
                >
                  {exportMsg.ok ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="w-4 h-4 shrink-0 text-red-600" />
                  )}
                  <span>{exportMsg.text}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LỊCH SỬ TÁC VỤ */}
      {activeTab === 'jobs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Lịch sử tác vụ nhập / xuất
            </span>
            <button
              type="button"
              onClick={() => fetchJobs(jobsMeta.page)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-2xs flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${jobsLoading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-slate-50/70 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-3.5">Thời gian</th>
                    <th className="py-3 px-3.5">Thao tác</th>
                    <th className="py-3 px-3.5">Loại dữ liệu</th>
                    <th className="py-3 px-3.5">Tên file</th>
                    <th className="py-3 px-3.5 text-right">Tổng dòng</th>
                    <th className="py-3 px-3.5 text-right">Thành công</th>
                    <th className="py-3 px-3.5 text-right">Lỗi</th>
                    <th className="py-3 px-3.5">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobsLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        Đang tải danh sách tác vụ...
                      </td>
                    </tr>
                  ) : jobs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        Chưa có lịch sử nhập hoặc xuất dữ liệu
                      </td>
                    </tr>
                  ) : (
                    jobs.map((job) => <JobRow key={job.id} job={job} />)
                  )}
                </tbody>
              </table>
            </div>

            {jobsMeta.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
                <span>
                  Trang {jobsMeta.page} / {jobsMeta.totalPages}
                </span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={jobsMeta.page <= 1}
                    onClick={() => fetchJobs(jobsMeta.page - 1)}
                    className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition"
                  >
                    Trước
                  </button>
                  <button
                    type="button"
                    disabled={jobsMeta.page >= jobsMeta.totalPages}
                    onClick={() => fetchJobs(jobsMeta.page + 1)}
                    className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
