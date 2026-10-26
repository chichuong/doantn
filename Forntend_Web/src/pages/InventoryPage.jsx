import React, { useState, useEffect, useCallback } from 'react';
import { inventoryApi } from '../api/inventoryApi';
import { AdjustStockModal } from '../components/inventory/AdjustStockModal';
import { formatNumber } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import {
  Warehouse,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Search,
  RefreshCw,
  TrendingDown,
  AlertCircle,
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
      } catch (err) {
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
        setError('Tài khoản hiện tại không có quyền Quản lý tồn kho (yêu cầu quyền manager.inventory.read). Vui lòng đăng nhập tài khoản Quản lý (manager@example.com).');
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
    const barcode = (item.barcode || '').toLowerCase();
    return name.includes(q) || sku.includes(q) || barcode.includes(q);
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
    <div className="flex-1 p-4 sm:p-5 lg:p-6 space-y-4 lg:space-y-5 bg-[#f8fafc] overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="app-page-title">
            Quản lý tồn kho
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canAdjustInventory && <button
            type="button"
            onClick={fetchInventory}
            className="p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-2xs"
            title="Làm mới"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>}

          <button
            type="button"
            onClick={() => setIsAdjustModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs flex items-center gap-1.5 transition"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Điều chỉnh tồn kho</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 4 Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* On-hand Stock */}
        <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-1 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 block">
            Tồn thực tế
          </span>
          <div className="text-2xl font-bold text-slate-900">
            {formatNumber(totalQuantity)}
          </div>
          <p className="text-[11px] text-slate-400">
            Hàng vật lý tại kho
          </p>
        </div>

        {/* Reserved Stock */}
        <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-1 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 block">
            Đang giữ
          </span>
          <div className="text-2xl font-bold text-amber-700">
            {formatNumber(totalReserved)}
          </div>
          <p className="text-[11px] text-slate-400">
            Khóa theo đơn hàng đang xử lý
          </p>
        </div>

        {/* Available Stock */}
        <div className="p-4 rounded-lg bg-blue-50/30 border border-blue-200 space-y-1 shadow-2xs">
          <span className="text-xs font-medium text-blue-700 block">
            Khả dụng
          </span>
          <div className="text-2xl font-bold text-blue-700">
            {formatNumber(totalAvailable)}
          </div>
          <p className="text-[11px] text-slate-500">
            Số lượng có thể bán
          </p>
        </div>

        {/* Low Stock Warning */}
        <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-1 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 block flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5 text-red-600" />
            Cảnh báo thiếu hàng
          </span>
          <div className="text-2xl font-bold text-red-700">
            {lowStockCount} <span className="text-xs font-normal text-slate-500">sản phẩm</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Dưới ngưỡng an toàn
          </p>
        </div>
      </div>

      {/* Control & Filter Bar */}
      <div className="p-3.5 rounded-lg bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
        {/* Kho selector */}
        <div className="flex flex-wrap items-center gap-2">
          <Warehouse className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-medium text-slate-600">Kho hàng:</span>
          <select
            value={selectedWarehouseId}
            onChange={(e) => setSelectedWarehouseId(e.target.value)}
            className="bg-white border border-slate-300 rounded-md px-2.5 py-1 text-xs text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
          >
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name} ({wh.code})
              </option>
            ))}
          </select>
        </div>

        {/* Filter low stock & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:flex-1 sm:justify-end sm:max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo Tên SP, SKU, Barcode..."
              className="w-full bg-white border border-slate-300 rounded-md pl-8 pr-2.5 py-1 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600"
            />
          </div>

          <button
            type="button"
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`px-2.5 py-1 rounded-md border text-xs font-medium transition flex items-center gap-1 shrink-0 ${
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

      {/* Inventory Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="bg-slate-50/70 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5">Sản phẩm</th>
                <th className="py-3 px-3.5">Mã SKU</th>
                <th className="py-3 px-3.5">Mã vạch</th>
                <th className="py-3 px-3.5 text-right font-bold text-slate-700 bg-slate-50/50">
                  Tồn thực tế
                </th>
                <th className="py-3 px-3.5 text-right font-bold text-amber-700 bg-amber-50/30">
                  Đang giữ
                </th>
                <th className="py-3 px-3.5 text-right font-bold text-blue-700 bg-blue-50/40">
                  Khả dụng
                </th>
                <th className="py-3 px-3.5 text-center">Ngưỡng an toàn</th>
                <th className="py-3 px-3.5 text-center">Tình trạng cảnh báo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    Đang tải dữ liệu tồn kho...
                  </td>
                </tr>
              ) : filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
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

                  return (
                    <tr key={itemKey} className="hover:bg-slate-50/80 transition">
                      <td
                        className="py-3.5 px-3.5 font-semibold text-slate-900 max-w-xs truncate"
                        title={item.product_name || item.productName || item.name}
                      >
                        {item.product_name || item.productName || item.name}
                      </td>
                      <td className="py-3.5 px-3.5 font-mono text-slate-600">
                        {item.sku || '---'}
                      </td>
                      <td className="py-3.5 px-3.5 font-mono text-slate-600">
                        {item.barcode || '---'}
                      </td>

                      {/* 1. Tồn thực tế */}
                      <td className="py-3.5 px-3.5 text-right font-bold text-slate-900 bg-slate-50/40">
                        {formatNumber(qty)}
                      </td>

                      {/* 2. Đang giữ */}
                      <td className="py-3.5 px-3.5 text-right font-bold text-amber-700 bg-amber-50/20">
                        {res > 0 ? `-${formatNumber(res)}` : '0'}
                      </td>

                      {/* 3. Khả dụng */}
                      <td className="py-3.5 px-3.5 text-right font-bold text-blue-700 bg-blue-50/30">
                        {formatNumber(avail)}
                      </td>

                      {/* Ngưỡng an toàn */}
                      <td className="py-3.5 px-3.5 text-center font-medium text-slate-600">
                        {formatNumber(reorder)}
                      </td>

                      {/* Cảnh báo */}
                      <td className="py-3.5 px-3.5 text-center">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Nguy cơ thiếu hàng</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
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

      {/* Modal điều chỉnh tồn kho */}
      {canAdjustInventory && <AdjustStockModal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        warehouses={warehouses}
        onSuccess={fetchInventory}
      />}
    </div>
  );
};
