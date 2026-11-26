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
  ChevronRight,
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

  const [searchQuery, setSearchQuery] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
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
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1680px] mx-auto p-4 sm:p-6 space-y-5">
        {/* Page Header */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Trang chủ</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span>Kho & Hàng hóa</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-700">Tồn kho</span>
            </nav>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 mt-1 flex items-center gap-2.5">
              <Boxes className="w-6 h-6 text-[#b8860b] shrink-0" />
              <span>Quản lý Tồn kho Hàng hóa</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi tồn thực tế, số lượng giữ chỗ cho đơn chờ giao và lượng hàng khả dụng mở bán
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={fetchInventory}
              disabled={loading}
              className="wm-btn wm-btn-ghost"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>

            {canAdjustInventory && (
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(true)}
                className="wm-btn wm-btn-primary"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Điều chỉnh tồn kho</span>
              </button>
            )}
          </div>
        </header>

        {error && (
          <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 4 Connected KPI Cells (kh-strip style) */}
        <div className="wm-card grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 overflow-hidden">
          <div className="p-4 flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-slate-500 block">Tổng tồn trong kho</span>
              <div className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
                {formatNumber(totalQuantity)}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Đơn vị thực tế tại kệ</p>
            </div>
            <span className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
              <Boxes className="w-5 h-5" />
            </span>
          </div>

          <div className="p-4 flex items-center justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-slate-500 block">Đang giữ cho đơn</span>
              <div className="text-2xl font-extrabold text-amber-700 mt-1 tabular-nums">
                {formatNumber(totalReserved)}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Chờ đóng gói & bàn giao</p>
            </div>
            <span className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </span>
          </div>

          <div className="p-4 flex items-center justify-between gap-3 bg-[#fffdf7]">
            <div>
              <span className="text-xs font-semibold text-[#926a09] block">Có thể bán ngay</span>
              <div className="text-2xl font-extrabold text-[#735309] mt-1 tabular-nums">
                {formatNumber(totalAvailable)}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Sẵn sàng trên POS & Web</p>
            </div>
            <span className="w-10 h-10 rounded-xl bg-[#fdf8e6] border border-[#f7e08f] text-[#b8860b] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </span>
          </div>

          <button
            type="button"
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`p-4 flex items-center justify-between gap-3 text-left transition ${
              lowStockOnly ? 'bg-rose-50/70 shadow-[inset_0_-3px_0_#e11d48]' : 'hover:bg-slate-50/70'
            }`}
          >
            <div>
              <span className="text-xs font-semibold text-slate-500 block">Cảnh báo thiếu hàng</span>
              <div className="text-2xl font-extrabold text-rose-600 mt-1 tabular-nums">
                {lowStockCount}{' '}
                <span className="text-xs font-normal text-slate-500">mã SP</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {lowStockOnly ? 'Đang lọc tồn thấp (nhấn để bỏ)' : 'Nhấn để lọc mã sắp hết'}
              </p>
            </div>
            <span className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
              <TrendingDown className="w-5 h-5" />
            </span>
          </button>
        </div>

        {/* Inventory Table Card */}
        <section className="wm-card overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Warehouse className="w-4 h-4 text-[#b8860b]" />
              <span className="text-xs font-semibold text-slate-600">Kho vận hành:</span>
              <span className="wm-badge wm-badge-gold">
                {warehouses[0]?.name || 'Kho trung tâm TP Hồ Chí Minh'} ({warehouses[0]?.code || 'WH-HCM-01'})
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:flex-1 sm:justify-end sm:max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo Tên SP, SKU..."
                  className="wm-field !h-9 w-full pl-9"
                />
              </div>

              <button
                type="button"
                onClick={() => setLowStockOnly(!lowStockOnly)}
                className={`wm-btn !h-9 text-xs ${
                  lowStockOnly
                    ? 'bg-rose-50 text-rose-700 border border-rose-300'
                    : 'wm-btn-ghost'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Chỉ xem tồn thấp</span>
              </button>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">Đang tải dữ liệu tồn kho...</div>
            ) : filteredInventory.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Không tìm thấy sản phẩm nào trong kho này
              </div>
            ) : (
              filteredInventory.map((item, idx) => {
                const qty = Number(item.quantity || 0);
                const res = Number(item.reserved_quantity || item.reservedQuantity || 0);
                const avail = Number(item.available_quantity ?? item.availableQuantity ?? qty - res);
                const reorder = Number(item.reorder_level || item.reorderLevel || 10);
                const isLow = avail <= reorder;
                const itemKey = `m-${item.warehouse_id || 'wh'}-${item.product_id || item.id || idx}`;
                const imgUrl = item.image_url || item.imageUrl;

                return (
                  <div key={itemKey} className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
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
                          <div className="font-mono text-[11px] font-bold text-[#926a09]">{item.sku || '---'}</div>
                          <div className="font-bold text-xs text-slate-900 line-clamp-2">
                            {item.product_name || item.productName || item.name}
                          </div>
                        </div>
                      </div>
                      {isLow ? (
                        <span className="wm-badge wm-badge-danger shrink-0">
                          <AlertTriangle className="w-3 h-3" /> Sắp hết
                        </span>
                      ) : (
                        <span className="wm-badge wm-badge-success shrink-0">
                          <CheckCircle2 className="w-3 h-3" /> Đủ hàng
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs tabular-nums pt-1">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-200/80">
                        <div className="text-[10px] text-slate-500">Tổng tồn</div>
                        <div className="font-bold text-slate-900 mt-0.5">{formatNumber(qty)}</div>
                      </div>
                      <div className="p-2 rounded-xl bg-amber-50/50 border border-amber-200/70">
                        <div className="text-[10px] text-amber-700">Đang giữ</div>
                        <div className="font-bold text-amber-700 mt-0.5">{res > 0 ? `-${formatNumber(res)}` : '0'}</div>
                      </div>
                      <div className="p-2 rounded-xl bg-[#fdf8e6] border border-[#f7e08f]">
                        <div className="text-[10px] text-[#926a09]">Khả dụng</div>
                        <div className="font-bold text-[#735309] mt-0.5">{formatNumber(avail)}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="wm-table min-w-[860px]">
              <thead>
                <tr>
                  <th>Sản phẩm</th>
                  <th>Mã SKU</th>
                  <th className="text-right">Tồn thực tế</th>
                  <th className="text-right">Đang giữ</th>
                  <th className="text-right">Khả dụng</th>
                  <th className="text-center">Ngưỡng an toàn</th>
                  <th className="text-center">Tình trạng</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
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
                    const avail = Number(item.available_quantity ?? item.availableQuantity ?? qty - res);
                    const reorder = Number(item.reorder_level || item.reorderLevel || 10);
                    const isLow = avail <= reorder;
                    const itemKey = `${item.warehouse_id || item.warehouseId || 'wh'}-${item.product_id || item.productId || item.id || idx}`;
                    const imgUrl = item.image_url || item.imageUrl;

                    return (
                      <tr key={itemKey}>
                        <td className="font-semibold text-slate-900 max-w-xs">
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
                        <td>
                          <span className="font-mono text-xs font-semibold text-[#926a09] bg-[#fdf8e6] px-2 py-0.5 rounded border border-[#f7e08f]">
                            {item.sku || '---'}
                          </span>
                        </td>
                        <td className="text-right font-bold text-slate-900">{formatNumber(qty)}</td>
                        <td className="text-right font-bold text-amber-700">
                          {res > 0 ? `-${formatNumber(res)}` : '0'}
                        </td>
                        <td className="text-right font-extrabold text-[#735309] bg-[#fdf8e6]/40">
                          {formatNumber(avail)}
                        </td>
                        <td className="text-center font-medium text-slate-600">{formatNumber(reorder)}</td>
                        <td className="text-center">
                          {isLow ? (
                            <span className="wm-badge wm-badge-danger">
                              <AlertTriangle className="w-3 h-3" /> Nguy cơ thiếu hàng
                            </span>
                          ) : (
                            <span className="wm-badge wm-badge-success">
                              <CheckCircle2 className="w-3 h-3" /> Đủ hàng
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
        </section>
      </div>

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
