import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { orderApi } from '../api/orderApi';
import { posApi } from '../api/posApi';
import { OrderDetailModal } from '../components/orders/OrderDetailModal';
import { formatCurrency, formatDateTime, ORDER_STATUS_META, CHANNEL_META } from '../utils/formatters';
import {
  Search,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

export const OrdersPage = () => {
  const { hasPermission } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalCount, setTotalCount] = useState(0);

  // Selected Order for Detail Modal
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const isManagerFlow = hasPermission('manager.orders.read');
  const isSalesOnly = !isManagerFlow && hasPermission('pos.sales.read');
  const canViewDetail = isSalesOnly
    ? hasPermission('pos.sales.read')
    : hasPermission('order_processing.orders.read');

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      if (isSalesOnly) {
        const params = { page, limit };
        if (statusFilter) params.status = statusFilter;
        const res = await posApi.listSales(params);
        const list = res?.data?.rows || res?.rows || res?.data || [];
        setOrders(list);
        setTotalCount(res?.data?.total || res?.total || list.length);
      } else {
        const params = { page, limit };
        if (statusFilter) params.status = statusFilter;
        if (channelFilter) params.channel = channelFilter;

        const res = await orderApi.getOrders(params);
        const list = res?.data || res?.rows || [];
        setOrders(list);
        setTotalCount(res?.pagination?.total || res?.total || list.length);
      }
    } catch (err) {
      if (err.status === 403) {
        setError(
          'Tài khoản hiện tại (Thu ngân) không có quyền Quản lý đơn hàng đa kênh. Vui lòng đăng nhập tài khoản Quản lý (manager@example.com) để thao tác toàn bộ kênh.'
        );
      } else {
        setError(err.message || 'Không thể tải danh sách đơn hàng');
      }
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, channelFilter, isSalesOnly]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filteredOrders = orders.filter((o) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const orderNum = (o.order_number || o.orderNumber || o.id || '').toLowerCase();
    const custName = (o.customer_name || o.customerName || '').toLowerCase();
    const custPhone = (o.customer_phone || o.customerPhone || '').toLowerCase();
    return orderNum.includes(q) || custName.includes(q) || custPhone.includes(q);
  });

  return (
    <div className="flex-1 p-4 sm:p-5 lg:p-6 space-y-4 lg:space-y-5 bg-[#f8fafc] overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="app-page-title">
            {isSalesOnly ? 'Lịch sử đơn hàng POS' : 'Quản lý đơn hàng'}
          </h2>
        </div>

        <button
          type="button"
          onClick={fetchOrders}
          className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-2xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="p-3.5 rounded-lg bg-white border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 shadow-2xs">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo mã đơn, khách hàng, SĐT..."
            className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600"
          />
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Chờ xác nhận</option>
            <option value="confirmed">Đã xác nhận</option>
            <option value="ready_to_pack">Chờ đóng gói</option>
            <option value="packed">Đã đóng gói</option>
            <option value="handover">Đã bàn giao</option>
            <option value="shipping">Đang vận chuyển</option>
            <option value="delivered">Đã giao hàng</option>
            <option value="cancelled">Đã hủy</option>
            <option value="returned">Đã trả hàng</option>
          </select>
        </div>

        {/* Channel Filter (Chỉ Manager/Admin) */}
        {!isSalesOnly && (
          <div>
            <select
              value={channelFilter}
              onChange={(e) => {
                setChannelFilter(e.target.value);
                setPage(1);
              }}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
            >
              <option value="">Tất cả kênh bán</option>
              <option value="pos">Bán lẻ tại quầy (POS)</option>
              <option value="web">Website trực tuyến</option>
              <option value="mobile">Ứng dụng di động</option>
            </select>
          </div>
        )}

        {/* Reset Filter Button */}
        <div>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('');
              setChannelFilter('');
              setSearchQuery('');
              setPage(1);
            }}
            className="w-full py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition"
          >
            Đặt lại bộ lọc
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-xs">
            <thead className="bg-slate-50/70 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Mã đơn</th>
                <th className="py-3 px-4">Thời gian</th>
                <th className="py-3 px-4">Kênh</th>
                <th className="py-3 px-4">Khách hàng</th>
                <th className="py-3 px-4">Điểm bán / Kho</th>
                <th className="py-3 px-4 text-right">Tổng tiền</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    Đang tải danh sách đơn hàng...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    Không tìm thấy đơn hàng nào phù hợp
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, idx) => {
                  const statusMeta = ORDER_STATUS_META[order.status] || {
                    label: order.status,
                    color: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  const channel = order.channel || (isSalesOnly ? 'pos' : 'web');
                  const channelMeta = CHANNEL_META[channel] || {
                    label: channel,
                    badge: 'bg-slate-100 text-slate-700 border-slate-200',
                  };
                  const fullOrderCode = String(
                    order.order_number || order.orderNumber || order.id || '---'
                  );
                  const displayOrderCode = fullOrderCode.length > 20
                    ? `${fullOrderCode.slice(0, 12)}…${fullOrderCode.slice(-6)}`
                    : fullOrderCode;

                  return (
                    <tr
                      key={order.id || `order-${idx}`}
                      className="hover:bg-slate-50/80 cursor-pointer transition"
                      onClick={() => canViewDetail && setSelectedOrderId(order.id)}
                    >
                      <td
                        className="py-3.5 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap"
                        title={`Mã đơn đầy đủ: ${fullOrderCode}`}
                        aria-label={`Mã đơn ${fullOrderCode}`}
                      >
                        #{displayOrderCode}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {formatDateTime(order.created_at || order.createdAt)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border ${channelMeta.badge}`}
                        >
                          {channelMeta.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {order.customer_name || order.customerName || 'Khách lẻ'}
                        {order.customer_phone && (
                          <span className="block text-[11px] text-slate-400">
                            {order.customer_phone}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {order.warehouse_name || order.warehouseName || 'Tại quầy POS'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 whitespace-nowrap">
                        {formatCurrency(order.total_amount || order.totalAmount || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${statusMeta.color}`}
                        >
                          {statusMeta.label}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        {canViewDetail && <button
                          type="button"
                          onClick={() => setSelectedOrderId(order.id)}
                          className="px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium transition flex items-center gap-1 mx-auto"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Chi tiết</span>
                        </button>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-white">
          <div>
            Hiển thị <strong>{filteredOrders.length}</strong> / {totalCount} đơn hàng
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="font-medium text-slate-700 px-1.5">Trang {page}</span>
            <button
              type="button"
              disabled={filteredOrders.length < limit}
              onClick={() => setPage((p) => p + 1)}
              className="p-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Chi tiết đơn hàng */}
      <OrderDetailModal
        isOpen={!!selectedOrderId}
        onClose={() => setSelectedOrderId(null)}
        orderId={selectedOrderId}
        onUpdated={fetchOrders}
        salesMode={isSalesOnly}
      />
    </div>
  );
};
