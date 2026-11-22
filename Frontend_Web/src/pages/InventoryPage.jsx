import React, { useState, useEffect, useCallback } from 'react';
import { inventoryApi } from '../api/inventoryApi';
import { AdjustStockModal } from '../components/inventory/AdjustStockModal';
import { formatNumber } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import {
  Boxes,
  Warehouse,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Search,
  RefreshCw,
  TrendingDown,
  AlertCircle,
  Clock,
} from 'lucide-react';

export const InventoryPage = () => {
  const { hasPermission } = useAuth();
  const canReadWarehouses = hasPermission('manager.warehouses.read');
  const canAdjustInventory = hasPermission('manager.inventory.adjust');
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Modals
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  useEffect(() => {
    const fetchWarehouses = async () => {
      if (!canReadWarehouses) {
        setError('Tài khoản không có quyền xem danh sách kho hàng.');
        return;
      }
      try {
        const res = await inventoryApi.getWarehouses();
        const list = res?.data || [];
        setWarehouses(list);
        if (list.length > 0) {
          setSelectedWarehouseId(list[0].id);
        }
      } catch {
        setError('Không thể tải danh sách kho hàng');
      }
    };
    fetchWarehouses();
  }, [canReadWarehouses]);

  const fetchInventory = useCallback(async () => {
    if (!selectedWarehouseId) return;

    try {
      setLoading(true);
      setError('');
      const params = {
        warehouseId: selectedWarehouseId,
        limit: 100,
      };
      if (lowStockOnly) params.lowStock = 'true';

      const res = await inventoryApi.getInventory(params);
      setInventory(res?.data || []);
    } catch (err) {
      if (err.status === 403) {
        setError(
          'Tài khoản hiện tại chưa được cấp quyền xem dữ liệu tồn kho. Vui lòng liên hệ Quản lý cửa hàng hoặc Quản trị viên.'
        );
      } else {
        setError(err.message || 'Không thể tải dữ liệu tồn kho');
      }
    } finally {
      setLoading(false);
    }
  }, [selectedWarehouseId, lowStockOnly]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const filteredInventory = inventory.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = (item.product_name || item.productName || item.name || '').toLowerCase();
    const sku = (item.sku || '').toLowerCase();
    return name.includes(q) || sku.includes(q);
  });

  const totalQuantity = inventory.reduce((sum, i) => sum + Number(i.quantity || 0), 0);
  const totalReserved = inventory.reduce(
    (sum, i) => sum + Number(i.reserved_quantity || i.reservedQuantity || 0),
    0
  );
  const totalAvailable = inventory.reduce(
    (sum, i) =>
      sum +
      Number(
        i.available_quantity ??
          i.availableQuantity ??
          i.quantity - (i.reserved_quantity || 0)
      ),
    0
  );
  const lowStockCount = inventory.filter((i) => {
    const avail = Number(
      i.available_quantity ??
        i.availableQuantity ??
        i.quantity - (i.reserved_quantity || 0)
    );
    const reorder = Number(i.reorder_level || i.reorderLevel || 10);
    return avail <= reorder;
  }).length;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Unified Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="app-page-title flex items-center gap-2">
            <Boxes className="w-5 h-5 text-blue-600 shrink-0" />
            <span>Quản lý Tồn kho Hàng hóa</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Theo dõi số lượng hàng thực tế trong kho, số lượng đang giữ cho đơn chờ giao và số lượng sẵn sàng mở bán
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={fetchInventory}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-2xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>

          {canAdjustInventory && (
            <button
              type="button"
              onClick={() => setIsAdjustModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Điều chỉnh tồn kho</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        {error && (
          <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 4 Summary Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* On-hand Stock */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Tổng tồn trong kho</span>
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                <Boxes className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-slate-900 tabular-nums">
              {formatNumber(totalQuantity)}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Tổng số lượng hàng hiện có tại kho
            </p>
          </div>

          {/* Reserved Stock */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Đang giữ cho đơn hàng</span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200/70 text-amber-600 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-amber-700 tabular-nums">
              {formatNumber(totalReserved)}
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Hàng đã có khách đặt, đang chờ đóng gói
            </p>
          </div>

          {/* Available Stock */}
          <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-700">Có thể bán ngay</span>
              <div className="w-8 h-8 rounded-lg bg-blue-100/80 text-blue-700 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-blue-700 tabular-nums">
              {formatNumber(totalAvailable)}
            </div>
            <p className="mt-1 text-[11px] text-slate-600">
              Số lượng thực tế khách có thể đặt mua
            </p>
          </div>

          {/* Low Stock Warning */}
          <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">Cảnh báo thiếu hàng</span>
              <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-200/70 text-red-600 flex items-center justify-center">
                <TrendingDown className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-extrabold text-red-600 tabular-nums">
              {lowStockCount} <span className="text-xs font-normal text-slate-500">sản phẩm</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Chạm hoặc dưới ngưỡng an toàn
            </p>
          </div>
        </div>

        {/* Control & Filter Bar */}
        <div className="p-4 rounded-xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
          {/* Kho trung tâm display */}
          <div className="flex flex-wrap items-center gap-2">
            <Warehouse className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold text-slate-600">Kho vận hành:</span>
            <span className="bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-2.5 py-1 text-xs font-semibold">
              {warehouses[0]?.name || 'Kho trung tâm TP Hồ Chí Minh'} ({warehouses[0]?.code || 'WH-HCM-01'})
            </span>
          </div>

          {/* Filter low stock & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:flex-1 sm:justify-end sm:max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo Tên SP, SKU..."
                className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400"
              />
            </div>

            <button
              type="button"
              onClick={() => setLowStockOnly(!lowStockOnly)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition flex items-center justify-center gap-1.5 shrink-0 ${
                lowStockOnly
                  ? 'bg-red-50 text-red-700 border-red-300'
                  : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Chỉ xem tồn thấp</span>
            </button>
          </div>
        </div>

        {/* Inventory List: Mobile Cards + Desktop Table */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          {/* Mobile Cards (< md) */}
          <div className="md:hidden divide-y divide-slate-100">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Đang tải dữ liệu tồn kho...
              </div>
            ) : filteredInventory.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Không tìm thấy sản phẩm nào trong kho này
              </div>
            ) : (
              filteredInventory.map((item, idx) => {
                const qty = Number(item.quantity || 0);
                const res = Number(item.reserved_quantity || item.reservedQuantity || 0);
                const avail = Number(
                  item.available_quantity ?? item.availableQuantity ?? qty - res
                );
                const reorder = Number(item.reorder_level || item.reorderLevel || 10);
                const isLow = avail <= reorder;
                const itemKey = `m-${item.warehouse_id || 'wh'}-${item.product_id || item.id || idx}`;
                const imgUrl = item.image_url || item.imageUrl;

                return (
                  <div key={itemKey} className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-11 h-11 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt={item.product_name || item.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <Boxes className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-mono text-[11px] font-bold text-blue-700">{item.sku || '---'}</div>
                          <div className="font-bold text-xs text-slate-900 line-clamp-2">
                            {item.product_name || item.productName || item.name}
                          </div>
                        </div>
                      </div>
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200 shrink-0">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Sắp hết</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Đủ hàng</span>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs tabular-nums pt-1">
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/80">
                        <div className="text-[10px] text-slate-500">Tổng tồn</div>
                        <div className="font-bold text-slate-900 mt-0.5">{formatNumber(qty)}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-amber-50/50 border border-amber-200/70">
                        <div className="text-[10px] text-amber-700">Đang giữ</div>
                        <div className="font-bold text-amber-700 mt-0.5">{res > 0 ? `-${formatNumber(res)}` : '0'}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-blue-50/60 border border-blue-200">
                        <div className="text-[10px] text-blue-700">Có thể bán</div>
                        <div className="font-bold text-blue-700 mt-0.5">{formatNumber(avail)}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Sản phẩm</th>
                  <th className="py-3 px-4">Mã SKU</th>
                  <th className="py-3 px-4 text-right font-bold text-slate-700 bg-slate-50">
                    Tồn thực tế
                  </th>
                  <th className="py-3 px-4 text-right font-bold text-amber-700 bg-amber-50/40">
                    Đang giữ
                  </th>
                  <th className="py-3 px-4 text-right font-bold text-blue-700 bg-blue-50/50">
                    Khả dụng
                  </th>
                  <th className="py-3 px-4 text-center">Ngưỡng an toàn</th>
                  <th className="py-3 px-4 text-center">Tình trạng cảnh báo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 tabular-nums">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400">
                      Đang tải dữ liệu tồn kho...
                    </td>
                  </tr>
                ) : filteredInventory.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-slate-400">
                      Không tìm thấy sản phẩm nào trong kho này
                    </td>
                  </tr>
                ) : (
                  filteredInventory.map((item, idx) => {
                    const qty = Number(item.quantity || 0);
                    const res = Number(item.reserved_quantity || item.reservedQuantity || 0);
                    const avail = Number(
                      item.available_quantity ?? item.availableQuantity ?? qty - res
                    );
                    const reorder = Number(item.reorder_level || item.reorderLevel || 10);
                    const isLow = avail <= reorder;
                    const itemKey = `${item.warehouse_id || item.warehouseId || 'wh'}-${item.product_id || item.productId || item.id || idx}`;
                    const imgUrl = item.image_url || item.imageUrl;

                    return (
                      <tr key={itemKey} className="hover:bg-slate-50/80 transition">
                        <td
                          className="py-3.5 px-4 font-semibold text-slate-900 max-w-xs"
                          title={item.product_name || item.productName || item.name}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                              {imgUrl ? (
                                <img
                                  src={imgUrl}
                                  alt={item.product_name || item.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <Boxes className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                            <span className="truncate">{item.product_name || item.productName || item.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-blue-700">
                          {item.sku || '---'}
                        </td>

                        {/* 1. Tồn thực tế */}
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900 bg-slate-50/40">
                          {formatNumber(qty)}
                        </td>

                        {/* 2. Đang giữ */}
                        <td className="py-3.5 px-4 text-right font-bold text-amber-700 bg-amber-50/20">
                          {res > 0 ? `-${formatNumber(res)}` : '0'}
                        </td>

                        {/* 3. Khả dụng */}
                        <td className="py-3.5 px-4 text-right font-bold text-blue-700 bg-blue-50/30">
                          {formatNumber(avail)}
                        </td>

                        {/* Ngưỡng an toàn */}
                        <td className="py-3.5 px-4 text-center font-medium text-slate-600">
                          {formatNumber(reorder)}
                        </td>

                        {/* Cảnh báo */}
                        <td className="py-3.5 px-4 text-center">
                          {isLow ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Nguy cơ thiếu hàng</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Đủ hàng</span>
                            </span>
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
      </div>

      {/* Modal điều chỉnh tồn kho */}
      {canAdjustInventory && (
        <AdjustStockModal
          isOpen={isAdjustModalOpen}
          onClose={() => setIsAdjustModalOpen(false)}
          warehouses={warehouses}
          products={inventory}
          onSuccess={fetchInventory}
        />
      )}
    </div>
  );
};
