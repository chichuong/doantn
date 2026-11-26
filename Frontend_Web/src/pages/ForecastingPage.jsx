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
  ChevronRight,
  Bot,
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

  const [runs, setRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [selectedRun, setSelectedRun] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [creatingBatchDoc, setCreatingBatchDoc] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProductForDetail, setSelectedProductForDetail] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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
        setError('Tài khoản hiện tại chưa được cấp quyền xem dự báo nhu cầu bán hàng.');
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

  const fetchRunDetail = useCallback(
    async (runId) => {
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
            Array.isArray(aData) ? aData : Array.isArray(aData?.rows) ? aData.rows : []
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
    },
    [canReadAlerts, canReadInventory]
  );

  useEffect(() => {
    if (selectedRunId) {
      fetchRunDetail(selectedRunId);
    }
  }, [selectedRunId, fetchRunDetail]);

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
            badgeClass: 'wm-badge-neutral',
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
            badgeClass: 'wm-badge-warning',
            priority: 1,
          },
        };
      }

      return {
        ...item,
        status: {
          code: 'safe',
          label: 'Đủ hàng',
          badgeClass: 'wm-badge-success',
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

  const totalForecastQty = useMemo(
    () => processedProducts.reduce((sum, p) => sum + (p.predictedQuantity || 0), 0),
    [processedProducts]
  );

  const attentionCount = useMemo(
    () => processedProducts.filter((p) => p.status.code === 'attention').length,
    [processedProducts]
  );

  const unknownCount = useMemo(
    () => processedProducts.filter((p) => p.status.code === 'unknown').length,
    [processedProducts]
  );

  const isDataSparse = useMemo(() => {
    if (!processedProducts.length) return false;
    return totalForecastQty / processedProducts.length < 0.1;
  }, [processedProducts, totalForecastQty]);

  const handleCreateBatchReplenishDoc = async () => {
    if (!processedProducts.length) return;
    try {
      setCreatingBatchDoc(true);
      setError('');
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
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1680px] mx-auto p-4 sm:p-6 space-y-5">
        {/* Header */}
        <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Trang chủ</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span>Kho & Hàng hóa</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-700">Warehouse AI</span>
            </nav>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 mt-1 flex items-center gap-2.5">
              <BrainCircuit className="w-6 h-6 text-[#b8860b] shrink-0" />
              <span>Dự báo Nhu cầu AI & Gợi ý Nhập hàng</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Phân tích chuỗi thời gian doanh số và cảnh báo sớm các mã hàng có nguy cơ thiếu hụt tồn kho
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {runs.length > 0 && (
              <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 h-9 rounded-xl text-xs shadow-2xs">
                <History className="w-3.5 h-3.5 text-[#b8860b]" />
                <select
                  value={selectedRunId}
                  onChange={(e) => setSelectedRunId(e.target.value)}
                  aria-label="Chọn đợt chạy dự báo"
                  className="bg-transparent font-semibold text-slate-700 focus:outline-none focus:shadow-none border-none cursor-pointer"
                >
                  {runs.map((run) => (
                    <option key={run.id} value={run.id}>
                      Đợt {run.to_date?.slice(5)} ({run.horizon_days}N)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {canRunForecast && (
              <button
                type="button"
                onClick={() => {
                  fetchRuns();
                  if (selectedRunId) fetchRunDetail(selectedRunId);
                }}
                disabled={loading || loadingDetail}
                className="wm-btn wm-btn-ghost !px-2.5"
                title="Làm mới"
                aria-label="Làm mới dữ liệu dự báo"
              >
                <RefreshCw className={`w-4 h-4 ${loading || loadingDetail ? 'animate-spin' : ''}`} />
              </button>
            )}

            {processedProducts.length > 0 && (
              <button
                type="button"
                disabled={creatingBatchDoc}
                onClick={handleCreateBatchReplenishDoc}
                className="wm-btn wm-btn-dark"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#f7d268]" />
                <span>{creatingBatchDoc ? 'Đang lập phiếu...' : 'Lập phiếu nhập kho AI'}</span>
              </button>
            )}

            {canRunForecast && (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="wm-btn wm-btn-primary"
              >
                <Plus className="w-4 h-4" />
                <span>Tạo dự báo mới</span>
              </button>
            )}
          </div>
        </header>

        {error && (
          <div role="alert" className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            {error}
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex flex-wrap items-center justify-between gap-2"
          >
            <span className="font-medium">{successMessage}</span>
            <button
              type="button"
              onClick={() => navigate('/warehouse-approvals')}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1 transition"
            >
              <span>Xem & Duyệt phiếu ngay</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Warehouse AI Assistant Callout Banner (inspired by warehouse-ai.html .d11-say) */}
        {processedProducts.length > 0 && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#fffaf0] via-[#fdf8e6] to-white border border-[#f7e08f] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f7d268] to-[#b8860b] text-[#0f172a] flex items-center justify-center shrink-0 shadow-xs">
                <Bot className="w-5 h-5" />
              </span>
              <p className="text-xs sm:text-[13px] text-slate-700 leading-relaxed">
                <b className="font-bold text-slate-900">Trợ lý Kho AI:</b> Đã phân tích{' '}
                <b>{formatNumber(processedProducts.length)}</b> mặt hàng trong chu kỳ{' '}
                <b>{selectedRun?.horizon_days || 7} ngày</b> tới — hiện có{' '}
                <b className="text-amber-700">{formatNumber(attentionCount)} mặt hàng</b> cần cân nhắc nhập bổ sung sớm.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'attention' ? 'all' : 'attention')}
                className="wm-btn wm-btn-ghost !h-8 text-xs"
              >
                {statusFilter === 'attention' ? 'Xem tất cả SP' : 'Lọc SP cần nhập'}
              </button>
            </div>
          </div>
        )}

        {/* 4 KPI Cards */}
        <ForecastSummaryCards
          totalProducts={processedProducts.length}
          totalForecastQty={totalForecastQty}
          attentionCount={attentionCount}
          unknownCount={unknownCount}
          selectedRun={selectedRun}
          loading={loadingDetail}
        />

        {/* Main Products Table */}
        <section className="wm-card overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">Danh sách Sản phẩm Theo dõi</h2>
              <span className="wm-badge wm-badge-neutral tabular-nums">{filteredProducts.length} mã</span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Tìm tên sản phẩm hoặc SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="wm-field !h-9 pl-8.5 pr-3 w-full sm:w-60"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 h-9 rounded-lg text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Lọc trạng thái dự báo"
                  className="bg-transparent text-slate-700 font-medium focus:outline-none focus:shadow-none border-none cursor-pointer"
                >
                  <option value="all">Tất cả trạng thái</option>
                  <option value="attention">Cần xem xét</option>
                  <option value="safe">Đủ hàng</option>
                  <option value="unknown">Chưa rõ tồn</option>
                </select>
              </div>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {loadingDetail ? (
              <div className="py-10 text-center text-xs text-slate-400">Đang tải dữ liệu...</div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">Chưa có dữ liệu dự báo phù hợp.</div>
            ) : (
              filteredProducts.map((item) => {
                const avail = item.availableQuantity;
                const pred = item.predictedQuantity;
                const isSmall = pred > 0 && pred < 1;
                return (
                  <div key={item.productId} className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] font-bold text-[#926a09]">{item.sku}</div>
                        <div className="font-bold text-xs text-slate-900 line-clamp-2">{item.name}</div>
                      </div>
                      <span className={`wm-badge shrink-0 ${item.status?.badgeClass}`}>
                        {item.status?.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <div className="space-x-3 tabular-nums">
                        <span className="text-slate-500">
                          Khả dụng:{' '}
                          <strong className="text-slate-900">
                            {avail === null || avail === undefined ? 'Chưa rõ' : formatNumber(avail)}
                          </strong>
                        </span>
                        <span className="text-[#926a09]">
                          Dự báo: <strong>{isSmall ? 'Dưới 1' : pred === 0 ? '0' : Math.round(pred)}</strong>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedProductForDetail(item)}
                        className="wm-btn wm-btn-ghost !h-7 !px-2.5 text-xs"
                      >
                        Chi tiết
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="wm-table min-w-[820px]">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Mã SKU</th>
                  <th className="text-right">Tồn kho khả dụng</th>
                  <th className="text-right">Dự kiến bán ({selectedRun?.horizon_days || 7}N)</th>
                  <th className="text-center">Trạng thái</th>
                  <th className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {loadingDetail ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-1.5 text-[#b8860b]" />
                      Đang phân tích dữ liệu dự báo...
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
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
                      <tr key={item.productId}>
                        <td>
                          <div className="font-semibold text-slate-900 truncate max-w-[320px]" title={item.name}>
                            {item.name}
                          </div>
                        </td>
                        <td>
                          <span className="font-mono text-xs font-semibold text-[#926a09] bg-[#fdf8e6] px-2 py-0.5 rounded border border-[#f7e08f]">
                            {item.sku}
                          </span>
                        </td>
                        <td className="text-right font-medium">
                          {avail === null || avail === undefined ? (
                            <span className="text-slate-400 font-normal">Chưa rõ</span>
                          ) : (
                            <span className="text-slate-800 font-semibold">{formatNumber(avail)}</span>
                          )}
                        </td>
                        <td
                          className="text-right font-extrabold text-slate-900"
                          title={`Giá trị đầy đủ: ${pred.toFixed(6)}`}
                        >
                          {isSmall ? 'Dưới 1' : pred === 0 ? '0' : Math.round(pred)}
                        </td>
                        <td className="text-center">
                          <span className={`wm-badge ${item.status?.badgeClass}`}>
                            {item.status?.label}
                          </span>
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedProductForDetail(item)}
                            className="wm-btn wm-btn-ghost !h-8 !px-3 text-xs"
                          >
                            Xem biểu đồ
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
            <div className="px-4 py-2.5 bg-[#fffdf7] border-t border-[#f7e08f]/60 text-[11px] text-[#735309]">
              Dữ liệu bán hàng lịch sử còn ít — độ chính xác dự báo sẽ tăng dần khi phát sinh thêm đơn hàng.
            </div>
          )}
        </section>

        <ModelTechSection selectedRun={selectedRun} />
      </div>

      <ForecastDetailModal
        isOpen={Boolean(selectedProductForDetail)}
        onClose={() => setSelectedProductForDetail(null)}
        product={selectedProductForDetail}
        selectedRun={selectedRun}
      />

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
