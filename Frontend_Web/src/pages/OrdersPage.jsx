import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { orderApi } from '../api/orderApi';
import { posApi } from '../api/posApi';
import { OrderDetailModal } from '../components/orders/OrderDetailModal';
import { formatCurrency, formatDateTime, ORDER_STATUS_META, CHANNEL_META } from '../utils/formatters';
import {
  ClipboardList,
  Search,
  Eye,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  RotateCcw,
  ArrowUpDown,
  Calendar,
} from 'lucide-react';

export const OrdersPage = () => {
  const { hasPermission } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters & Sort
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [sortOrder, setSortOrder] = useState('date_desc'); // 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'
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
        if (selectedDate) {
          params.from = selectedDate;
          params.to = selectedDate;
        }
        const res = await posApi.listSales(params);
        const list = res?.data?.rows || res?.rows || res?.data || [];
        setOrders(list);
        setTotalCount(res?.data?.total || res?.total || list.length);
      } else {
        const params = { page, limit };
        if (statusFilter) params.status = statusFilter;
        if (channelFilter) params.channel = channelFilter;
        if (selectedDate) {
          params.from = selectedDate;
          params.to = selectedDate;
        }

        const res = await orderApi.getOrders(params);
        const list = res?.data || res?.rows || [];
        setOrders(list);
        setTotalCount(res?.pagination?.total || res?.total || list.length);
      }
    } catch (err) {
      if (err.status === 403) {
        setError(
          'Tài khoản hiện tại không có quyền xem đơn hàng toàn hệ thống. Vui lòng liên hệ Quản lý cửa hàng hoặc Quản trị viên để được cấp quyền.'
        );
      } else {
        setError(err.message || 'Không thể tải danh sách đơn hàng');
      }
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, channelFilter, selectedDate, isSalesOnly]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const filteredOrders = orders
    .filter((o) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const orderNum = (o.order_number || o.orderNumber || o.id || '').toLowerCase();
        const custName = (o.customer_name || o.customerName || '').toLowerCase();
        const custPhone = (o.customer_phone || o.customerPhone || '').toLowerCase();
        if (!orderNum.includes(q) && !custName.includes(q) && !custPhone.includes(q)) {
          return false;
        }
      }
      const rawDate = o.created_at || o.createdAt;
      if (rawDate && selectedDate) {
        const d = new Date(rawDate);
        const yyyyMmDd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (yyyyMmDd !== selectedDate) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const timeA = new Date(a.created_at || a.createdAt || 0).getTime();
      const timeB = new Date(b.created_at || b.createdAt || 0).getTime();
      const amtA = Number(a.total_amount || a.totalAmount || 0);
      const amtB = Number(b.total_amount || b.totalAmount || 0);

      if (sortOrder === 'date_asc') return timeA - timeB;
      if (sortOrder === 'amount_desc') return amtB - amtA;
      if (sortOrder === 'amount_asc') return amtA - amtB;
      return timeB - timeA; // default 'date_desc'
    });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Unified Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="app-page-title flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-600 shrink-0" />
            <span>{isSalesOnly ? 'Lịch sử hóa đơn tại quầy' : 'Quản lý Đơn hàng'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isSalesOnly
              ? 'Tra cứu lịch sử giao dịch bán lẻ tại quầy trong ca làm việc'
              : 'Theo dõi và xử lý đơn đặt hàng từ quầy thu ngân, website và ứng dụng di động'}
          </p>
        </div>

        <button
          type="button"
          onClick={fetchOrders}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition shadow-2xs flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {error && (
          <div role="alert" className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Filter Bar (Gọn 1 hàng) */}
        <div
          className={`p-4 rounded-xl bg-white border border-slate-200 grid grid-cols-1 sm:grid-cols-2 ${
            isSalesOnly ? 'lg:grid-cols-5' : 'lg:grid-cols-6'
          } gap-3 shadow-2xs`}
        >
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo mã đơn, khách hàng, SĐT..."
              className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400"
            />
          </div>

          {/* Chọn 1 ngày cụ thể */}
          <div className="relative">
            <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setPage(1);
              }}
              aria-label="Chọn ngày bán hàng"
              className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-800"
            />
          </div>

          {/* Channel Filter (Dành cho Quản lý / Admin) */}
          {!isSalesOnly && (
            <div>
              <select
                value={channelFilter}
                onChange={(e) => {
                  setChannelFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Lọc theo kênh bán hàng"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800"
              >
                <option value="">Tất cả các kênh</option>
                <option value="pos">Bán lẻ POS</option>
                <option value="web">Website</option>
                <option value="mobile">App Di động</option>
              </select>
            </div>
          )}

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Lọc theo trạng thái đơn hàng"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800"
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

          {/* Sort By Date / Amount */}
          <div className="relative">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              aria-label="Sắp xếp đơn hàng"
              className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-800 font-medium"
            >
              <option value="date_desc">Mới nhất → Cũ nhất</option>
              <option value="date_asc">Cũ nhất → Mới nhất</option>
              <option value="amount_desc">Tổng tiền: Cao → Thấp</option>
              <option value="amount_asc">Tổng tiền: Thấp → Cao</option>
            </select>
          </div>

          {/* Reset Filter Button */}
          <div>
            <button
              type="button"
              onClick={() => {
                setStatusFilter('');
                setChannelFilter('');
                setSearchQuery('');
                setSelectedDate('');
                setSortOrder('date_desc');
                setPage(1);
              }}
              className="w-full py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition flex items-center justify-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Đặt lại bộ lọc</span>
            </button>
          </div>
        </div>

        {/* Orders Table */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-xs border-collapse">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Mã đơn</th>
                  <th
                    className="py-3 px-4 cursor-pointer select-none hover:text-blue-600 transition"
                    onClick={() =>
                      setSortOrder((prev) => (prev === 'date_desc' ? 'date_asc' : 'date_desc'))
                    }
                    title="Nhấn để đảo chiều sắp xếp theo ngày"
                  >
                    <span className="inline-flex items-center gap-1">
                      <span>Thời gian</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </span>
                  </th>
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
                    const displayOrderCode =
                      fullOrderCode.length > 20
                        ? `${fullOrderCode.slice(0, 12)}…${fullOrderCode.slice(-6)}`
                        : fullOrderCode;

                    return (
                      <tr
                        key={order.id || `order-${idx}`}
                        className="hover:bg-slate-50/80 cursor-pointer transition"
                        onClick={() => canViewDetail && setSelectedOrderId(order.id)}
                      >
                        <td
                          className="py-3.5 px-4 font-mono font-semibold text-blue-700 whitespace-nowrap"
                          title={`Mã đơn đầy đủ: ${fullOrderCode}`}
                          aria-label={`Mã đơn ${fullOrderCode}`}
                        >
                          #{displayOrderCode}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap tabular-nums">
                          {formatDateTime(order.created_at || order.createdAt)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold border ${channelMeta.badge}`}
                          >
                            {channelMeta.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {order.customer_name || order.customerName || 'Khách lẻ'}
                          {order.customer_phone && (
                            <span className="block text-[11px] font-normal text-slate-500 font-mono">
                              {order.customer_phone}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {order.warehouse_name || order.warehouseName || (order.channel === 'pos' ? 'Tại quầy POS' : 'Kho trung tâm TP Ho Chi Minh')}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900 whitespace-nowrap tabular-nums">
                          {formatCurrency(order.total_amount || order.totalAmount || 0)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusMeta.color}`}
                          >
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          {canViewDetail && (
                            <button
                              type="button"
                              onClick={() => setSelectedOrderId(order.id)}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium transition inline-flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Chi tiết</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Bar */}
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 bg-white">
            <div className="tabular-nums">
              Hiển thị <strong>{filteredOrders.length}</strong> / {totalCount} đơn hàng
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Trang trước"
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-semibold text-slate-700 px-2 tabular-nums">Trang {page}</span>
              <button
                type="button"
                disabled={filteredOrders.length < limit}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Trang sau"
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 disabled:opacity-40 transition"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
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
