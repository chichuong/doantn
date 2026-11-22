import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BrainCircuit,
  RefreshCw,
  Search,
  Filter,
  History,
  Plus,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { forecastingApi } from '../api/forecastingApi';
import { inventoryApi } from '../api/inventoryApi';
import { formatNumber } from '../utils/formatters';
import { ForecastSummaryCards } from '../components/forecasting/ForecastSummaryCards';
import { ForecastDetailModal } from '../components/forecasting/ForecastDetailModal';
import { CreateForecastModal } from '../components/forecasting/CreateForecastModal';
import { ModelTechSection } from '../components/forecasting/ModelTechSection';
import { useAuth } from '../context/AuthContext';

export const ForecastingPage = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canRunForecast = hasPermission('forecasting.run');
  const canReadAlerts = hasPermission('forecasting.alerts.read');
  const canReadWarehouses = hasPermission('manager.warehouses.read');
  const canReadInventory = hasPermission('manager.inventory.read');
  // Data States
  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [selectedRun, setSelectedRun] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [creatingBatchDoc, setCreatingBatchDoc] = useState(false);

  // UI States
  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProductForDetail, setSelectedProductForDetail] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'attention' | 'safe' | 'unknown'

  // Load Warehouses
  useEffect(() => {
    const fetchWarehouses = async () => {
      if (!canReadWarehouses) return;
      try {
        const res = await inventoryApi.getWarehouses();
        setWarehouses(res?.data || []);
      } catch (err) {
        console.error('Không thể tải danh sách kho:', err);
      }
    };
    fetchWarehouses();
  }, [canReadWarehouses]);

  // Fetch Runs
  const fetchRuns = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await forecastingApi.getRuns({ page: 1, limit: 15 });
      const runList = res?.data || res?.rows || [];
      setRuns(runList);

      if (runList.length > 0) {
        setSelectedRunId((prev) => {
          const exists = runList.some((r) => r.id === prev);
          return exists ? prev : runList[0].id;
        });
      } else {
        setSelectedRunId('');
        setSelectedRun(null);
        setAlerts([]);
      }
    } catch (err) {
      if (err.status === 403) {
        setError('Tài khoản không có quyền xem dự báo (yêu cầu forecasting.read).');
      } else {
        setError(err.message || 'Không thể tải danh sách đợt dự báo.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Fetch Run Detail
  const fetchRunDetail = useCallback(async (runId) => {
    if (!runId) return;
    try {
      setLoadingDetail(true);
      setError('');

      const [detailRes, alertRes, invRes] = await Promise.allSettled([
        forecastingApi.getRunDetail(runId),
        canReadAlerts ? forecastingApi.getAlerts({ runId }) : Promise.resolve(null),
        canReadInventory ? inventoryApi.getInventory({ limit: 100 }) : Promise.resolve(null),
      ]);

      if (detailRes.status === 'fulfilled') {
        const dData = detailRes.value?.data || detailRes.value;
        setSelectedRun(dData || null);
      }

      if (alertRes.status === 'fulfilled') {
        const aData = alertRes.value?.data ?? alertRes.value;
        setAlerts(
          Array.isArray(aData)
            ? aData
            : Array.isArray(aData?.rows)
            ? aData.rows
            : []
        );
      } else {
        setAlerts([]);
      }

      if (invRes.status === 'fulfilled') {
        const iData = invRes.value?.data || invRes.value?.rows || [];
        setInventoryList(Array.isArray(iData) ? iData : []);
      }
    } catch (err) {
      setError(err.message || 'Không thể tải chi tiết đợt dự báo.');
    } finally {
      setLoadingDetail(false);
    }
  }, [canReadAlerts, canReadInventory]);

  useEffect(() => {
    if (selectedRunId) {
      fetchRunDetail(selectedRunId);
    }
  }, [selectedRunId, fetchRunDetail]);

  // Trigger Run
  const handleTriggerRun = async (payload) => {
    try {
      setTriggering(true);
      setError('');
      setSuccessMessage('');

      const res = await forecastingApi.triggerRun(payload);
      const createdRun = res?.data || res;

      setSuccessMessage('Đã tạo dự báo thành công.');
      setIsCreateModalOpen(false);

      await fetchRuns();
      if (createdRun?.id) {
        setSelectedRunId(createdRun.id);
      }

      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      setError(err.message || 'Khởi chạy dự báo thất bại.');
    } finally {
      setTriggering(false);
    }
  };

  // Process Products for Display
  const processedProducts = useMemo(() => {
    if (!selectedRun?.values || selectedRun.values.length === 0) return [];

    const productMap = new Map();

    selectedRun.values.forEach((v) => {
      if (!productMap.has(v.product_id)) {
        productMap.set(v.product_id, {
          productId: v.product_id,
          sku: v.sku,
          name: v.name,
          warehouseCode: v.warehouse_code,
          predictedQuantity: 0,
          dailyValues: [],
          availableQuantity: null,
          recommendedQuantity: 0,
        });
      }
      const item = productMap.get(v.product_id);
      const qty = Number(v.predicted_quantity || 0);
      item.predictedQuantity += qty;
      item.dailyValues.push({
        date: v.forecast_date,
        quantity: qty,
      });
    });

    // Merge alerts
    (alerts || []).forEach((alert) => {
      const pId = alert.product_id;
      if (productMap.has(pId)) {
        const item = productMap.get(pId);
        if (alert.available_quantity !== undefined && alert.available_quantity !== null) {
          item.availableQuantity = Number(alert.available_quantity);
        }
        item.recommendedQuantity = Number(alert.recommended_quantity || 0);
      }
    });

    // Merge inventory
    (inventoryList || []).forEach((inv) => {
      if (productMap.has(inv.product_id)) {
        const item = productMap.get(inv.product_id);
        if (item.availableQuantity === null) {
          item.availableQuantity = Number(inv.available_quantity ?? inv.quantity ?? 0);
        }
      }
    });

    const items = Array.from(productMap.values()).map((item) => {
      const avail = item.availableQuantity;
      const pred = item.predictedQuantity;

      if (avail === null || avail === undefined) {
        return {
          ...item,
          status: {
            code: 'unknown',
            label: 'Chưa rõ tồn',
            badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
            priority: 2,
          },
        };
      }

      if (avail === 0 || avail < pred || avail <= pred * 1.5) {
        return {
          ...item,
          status: {
            code: 'attention',
            label: 'Cần xem xét',
            badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
            priority: 1,
          },
        };
      }

      return {
        ...item,
        status: {
          code: 'safe',
          label: 'Đủ hàng',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          priority: 3,
        },
      };
    });

    return items.sort((a, b) => {
      if (a.status.priority !== b.status.priority) {
        return a.status.priority - b.status.priority;
      }
      return a.name.localeCompare(b.name);
    });
  }, [selectedRun, alerts, inventoryList]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return processedProducts.filter((product) => {
      const matchSearch =
        !searchQuery ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase());

      let matchStatus = true;
      if (statusFilter === 'attention') {
        matchStatus = product.status.code === 'attention';
      } else if (statusFilter === 'safe') {
        matchStatus = product.status.code === 'safe';
      } else if (statusFilter === 'unknown') {
        matchStatus = product.status.code === 'unknown';
      }

      return matchSearch && matchStatus;
    });
  }, [processedProducts, searchQuery, statusFilter]);

  // KPI calculations
  const totalForecastQty = useMemo(() => {
    return processedProducts.reduce((sum, p) => sum + (p.predictedQuantity || 0), 0);
  }, [processedProducts]);

  const attentionCount = useMemo(() => {
    return processedProducts.filter((p) => p.status.code === 'attention').length;
  }, [processedProducts]);

  const unknownCount = useMemo(() => {
    return processedProducts.filter((p) => p.status.code === 'unknown').length;
  }, [processedProducts]);

  const isDataSparse = useMemo(() => {
    if (!processedProducts.length) return false;
    return totalForecastQty / processedProducts.length < 0.1;
  }, [processedProducts, totalForecastQty]);

  const handleCreateBatchReplenishDoc = async () => {
    if (!processedProducts.length) return;
    try {
      setCreatingBatchDoc(true);
      setError('');
      // Ưu tiên các sản phẩm cần chú ý, nếu tất cả đủ hàng thì lấy Top 3 sản phẩm có dự báo cao nhất
      const attentionItems = processedProducts.filter((p) => p.status.code === 'attention');
      const targetList = attentionItems.length > 0 ? attentionItems : processedProducts.slice(0, 3);

      const itemsPayload = targetList.map((p) => {
        const availNum = Number(p.availableQuantity || 0);
        const predNum = Number(p.predictedQuantity || 0);
        const shortage = Math.ceil(predNum - availNum);
        const qty = shortage > 0 ? shortage + 15 : Math.max(15, Math.ceil(predNum * 2));
        return {
          productId: p.productId,
          quantity: qty,
          unitCost: 0,
        };
      });

      const res = await inventoryApi.createDocument({
        type: 'receipt',
        warehouseId: selectedRun?.warehouse_id || undefined,
        note: `Phiếu nhập kho đề xuất tự động từ AI Dự báo nhu cầu (${selectedRun?.model_name || 'LightGBM'} - ${targetList.length} mặt hàng)`,
        items: itemsPayload,
      });
      const created = res?.data || res;
      setSuccessMessage(
        `Đã tự động lập Phiếu nhập kho đề xuất ${created?.document_number || ''} (${targetList.length} mặt hàng).`
      );
    } catch (err) {
      setError(err.message || 'Không thể lập phiếu nhập kho đề xuất từ AI.');
    } finally {
      setCreatingBatchDoc(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Unified Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="app-page-title flex items-center gap-2">
            <BrainCircuit className="w-5 h-5 text-blue-600 shrink-0" />
            <span>Dự báo Nhu cầu AI & Gợi ý Nhập hàng</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Phân tích chuỗi thời gian doanh số và cảnh báo sớm các mã hàng có nguy cơ thiếu hụt tồn kho
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Lịch sử đợt chạy ngắn gọn */}
          {runs.length > 0 && (
            <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-2.5 py-1.5 rounded-lg text-xs">
              <History className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedRunId}
                onChange={(e) => setSelectedRunId(e.target.value)}
                aria-label="Chọn đợt chạy dự báo"
                className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer"
              >
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    Đợt {run.to_date?.slice(5)} ({run.horizon_days}N)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Làm mới */}
          {canRunForecast && (
            <button
              type="button"
              onClick={() => {
                fetchRuns();
                if (selectedRunId) fetchRunDetail(selectedRunId);
              }}
              disabled={loading || loadingDetail}
              className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-600 transition"
              title="Làm mới"
              aria-label="Làm mới dữ liệu dự báo"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading || loadingDetail ? 'animate-spin' : ''}`} />
            </button>
          )}

          {/* Lập phiếu nhập kho đề xuất từ AI */}
          {processedProducts.length > 0 && (
            <button
              type="button"
              disabled={creatingBatchDoc}
              onClick={handleCreateBatchReplenishDoc}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{creatingBatchDoc ? 'Đang tạo phiếu...' : 'Lập phiếu nhập kho AI'}</span>
            </button>
          )}

          {/* Tạo dự báo mới */}
          {canRunForecast && (
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tạo dự báo mới</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {error && (
          <div role="alert" className="px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}
        {successMessage && (
          <div role="status" className="px-3.5 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex flex-wrap items-center justify-between gap-2">
            <span>{successMessage}</span>
            <button
              type="button"
              onClick={() => navigate('/warehouse-approvals')}
              className="px-3 py-1 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1 transition"
            >
              <span>Xem & Duyệt phiếu ngay</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 4 Thẻ KPI */}
        <ForecastSummaryCards
          totalProducts={processedProducts.length}
          totalForecastQty={totalForecastQty}
          attentionCount={attentionCount}
          unknownCount={unknownCount}
          selectedRun={selectedRun}
          loading={loadingDetail}
        />

        {/* Bảng chính: Sản phẩm cần theo dõi */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          {/* Table Toolbar */}
          <div className="p-3.5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Sản phẩm cần theo dõi
              </span>
              <span className="text-xs text-slate-400 tabular-nums">
                ({filteredProducts.length})
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Tìm tên hoặc SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white w-full sm:w-52"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1 bg-white border border-slate-300 px-2.5 py-1.5 rounded-lg text-xs">
                <Filter className="w-3 h-3 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Lọc trạng thái dự báo"
                  className="bg-transparent text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">Tất cả</option>
                  <option value="attention">Cần xem xét</option>
                  <option value="safe">Đủ hàng</option>
                  <option value="unknown">Chưa rõ tồn</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table Rows */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Sản phẩm</th>
                  <th className="py-3 px-4 text-right">Tồn kho khả dụng</th>
                  <th className="py-3 px-4 text-right">Dự kiến bán ({selectedRun?.horizon_days || 7}N)</th>
                  <th className="py-3 px-4 text-center">Trạng thái</th>
                  <th className="py-3 px-4 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {loadingDetail ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1 text-slate-300" />
                      Đang tải dữ liệu...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-400">
                      {searchQuery || statusFilter !== 'all'
                        ? 'Không có sản phẩm phù hợp bộ lọc.'
                        : 'Chưa có dữ liệu dự báo.'}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((item) => {
                    const avail = item.availableQuantity;
                    const pred = item.predictedQuantity;
                    const isSmall = pred > 0 && pred < 1;

                    return (
                      <tr
                        key={item.productId}
                        className="hover:bg-slate-50/70 transition h-[48px]"
                      >
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-slate-900 truncate max-w-[280px]" title={item.name}>
                            {item.name}
                          </div>
                          <div className="font-mono text-[11px] text-blue-700">
                            {item.sku}
                          </div>
                        </td>

                        <td className="py-2.5 px-4 text-right font-medium">
                          {avail === null || avail === undefined ? (
                            <span className="text-slate-400 font-normal">Chưa rõ</span>
                          ) : (
                            <span className="text-slate-800">{formatNumber(avail)}</span>
                          )}
                        </td>

                        <td className="py-2.5 px-4 text-right font-bold text-slate-900" title={`Giá trị đầy đủ: ${pred.toFixed(6)}`}>
                          {isSmall ? 'Dưới 1' : pred === 0 ? '0' : Math.round(pred)}
                        </td>

                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${item.status?.badgeClass}`}
                          >
                            {item.status?.label}
                          </span>
                        </td>

                        <td className="py-2.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedProductForDetail(item)}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium text-xs transition"
                          >
                            Chi tiết
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {isDataSparse && (
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500">
              Dữ liệu bán hàng còn ít, kết quả mang tính tham khảo khi cửa hàng có thêm lịch sử giao dịch.
            </div>
          )}
        </div>

        {/* Thông tin kỹ thuật */}
        <ModelTechSection selectedRun={selectedRun} />
      </div>

      {/* Modal Chi tiết Sản phẩm */}
      <ForecastDetailModal
        isOpen={Boolean(selectedProductForDetail)}
        onClose={() => setSelectedProductForDetail(null)}
        product={selectedProductForDetail}
        selectedRun={selectedRun}
      />

      {/* Modal Tạo dự báo mới */}
      {canRunForecast && (
        <CreateForecastModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleTriggerRun}
          triggering={triggering}
          warehouses={warehouses}
        />
      )}
    </div>
  );
};
