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

  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [sortOrder, setSortOrder] = useState('date_desc');
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalCount, setTotalCount] = useState(0);

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
      return timeB - timeA;
    });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1680px] mx-auto p-4 sm:p-6 space-y-5">
        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Trang chủ</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span>Bán hàng & Đơn</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-700">
                {isSalesOnly ? 'Lịch sử POS' : 'Đơn hàng'}
              </span>
            </nav>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 mt-1 flex items-center gap-2.5">
              <ClipboardList className="w-6 h-6 text-[#b8860b] shrink-0" />
              <span>{isSalesOnly ? 'Lịch sử Hóa đơn tại Quầy' : 'Quản lý Đơn hàng Đa kênh'}</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isSalesOnly
                ? 'Tra cứu lịch sử giao dịch bán lẻ tại quầy trong ca làm việc'
                : 'Theo dõi và xử lý đơn đặt hàng từ quầy thu ngân POS, website và ứng dụng di động'}
            </p>
          </div>

          <button
            type="button"
            onClick={fetchOrders}
            disabled={loading}
            className="wm-btn wm-btn-primary self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </header>

        {error && (
          <div role="alert" className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Unified Table Card with Filter Toolbar */}
        <section className="wm-card overflow-hidden">
          <div
            className={`p-4 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 ${
              isSalesOnly ? 'lg:grid-cols-5' : 'lg:grid-cols-6'
            } gap-2.5`}
          >
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Mã đơn, khách hàng, SĐT..."
                className="wm-field w-full pl-9"
              />
            </div>

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
                className="wm-field w-full pl-8"
              />
            </div>

            {!isSalesOnly && (
              <select
                value={channelFilter}
                onChange={(e) => {
                  setChannelFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Lọc theo kênh bán hàng"
                className="wm-field w-full"
              >
                <option value="">Tất cả kênh bán</option>
                <option value="pos">Bán lẻ POS</option>
                <option value="web">Website</option>
                <option value="mobile">App Di động</option>
              </select>
            )}

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Lọc theo trạng thái đơn hàng"
              className="wm-field w-full"
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

            <div className="relative">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                aria-label="Sắp xếp đơn hàng"
                className="wm-field w-full pl-8 font-medium"
              >
                <option value="date_desc">Mới nhất → Cũ nhất</option>
                <option value="date_asc">Cũ nhất → Mới nhất</option>
                <option value="amount_desc">Tổng tiền: Cao → Thấp</option>
                <option value="amount_asc">Tổng tiền: Thấp → Cao</option>
              </select>
            </div>

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
              className="wm-btn wm-btn-ghost !h-[38px] w-full"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Đặt lại</span>
            </button>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">Đang tải danh sách đơn hàng...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">Không tìm thấy đơn hàng nào phù hợp</div>
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
                const fullOrderCode = String(order.order_number || order.orderNumber || order.id || '---');
                const displayOrderCode =
                  fullOrderCode.length > 18
                    ? `${fullOrderCode.slice(0, 10)}…${fullOrderCode.slice(-5)}`
                    : fullOrderCode;

                return (
                  <div
                    key={order.id || `m-order-${idx}`}
                    onClick={() => canViewDetail && setSelectedOrderId(order.id)}
                    className="p-3.5 space-y-2 hover:bg-[#fdf8e6]/40 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-xs text-[#926a09]">#{displayOrderCode}</span>
                      <span className={`wm-badge ${statusMeta.color}`}>{statusMeta.label}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="font-semibold text-slate-900 truncate">
                        {order.customer_name || order.customerName || 'Khách lẻ'}
                        {order.customer_phone && (
                          <span className="text-slate-500 font-normal"> • {order.customer_phone}</span>
                        )}
                      </div>
                      <span className={`wm-badge shrink-0 ${channelMeta.badge}`}>{channelMeta.label}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-xs">
                      <span className="text-[11px] text-slate-500 tabular-nums">
                        {formatDateTime(order.created_at || order.createdAt)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 tabular-nums">
                          {formatCurrency(order.total_amount || order.totalAmount || 0)}
                        </span>
                        {canViewDetail && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrderId(order.id);
                            }}
                            className="wm-btn wm-btn-ghost !h-7 !px-2.5 text-[11px]"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Chi tiết</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="wm-table min-w-[920px]">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th
                    className="cursor-pointer select-none hover:text-[#926a09] transition"
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
                  <th>Kênh bán</th>
                  <th>Khách hàng</th>
                  <th>Điểm bán / Kho</th>
                  <th className="text-right">Tổng tiền</th>
                  <th className="text-center">Trạng thái</th>
                  <th className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
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
                        className="cursor-pointer"
                        onClick={() => canViewDetail && setSelectedOrderId(order.id)}
                      >
                        <td
                          className="font-mono font-bold text-[#926a09] whitespace-nowrap"
                          title={`Mã đơn đầy đủ: ${fullOrderCode}`}
                        >
                          #{displayOrderCode}
                        </td>
                        <td className="text-slate-600 whitespace-nowrap tabular-nums">
                          {formatDateTime(order.created_at || order.createdAt)}
                        </td>
                        <td>
                          <span className={`wm-badge ${channelMeta.badge}`}>{channelMeta.label}</span>
                        </td>
                        <td className="font-semibold text-slate-900">
                          {order.customer_name || order.customerName || 'Khách lẻ'}
                          {order.customer_phone && (
                            <span className="block text-[11px] font-normal text-slate-500 font-mono">
                              {order.customer_phone}
                            </span>
                          )}
                        </td>
                        <td className="text-slate-600">
                          {order.warehouse_name ||
                            order.warehouseName ||
                            (order.channel === 'pos' ? 'Tại quầy POS' : 'Kho trung tâm TP.HCM')}
                        </td>
                        <td className="text-right font-extrabold text-slate-900 whitespace-nowrap tabular-nums">
                          {formatCurrency(order.total_amount || order.totalAmount || 0)}
                        </td>
                        <td className="text-center">
                          <span className={`wm-badge ${statusMeta.color}`}>{statusMeta.label}</span>
                        </td>
                        <td className="text-right" onClick={(e) => e.stopPropagation()}>
                          {canViewDetail && (
                            <button
                              type="button"
                              onClick={() => setSelectedOrderId(order.id)}
                              className="wm-btn wm-btn-ghost !h-8 !px-2.5 text-xs"
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

          {/* Pagination */}
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 bg-white">
            <div className="tabular-nums">
              Hiển thị <strong>{filteredOrders.length}</strong> / {totalCount} đơn hàng
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Trang trước"
                className="wm-act border border-slate-200 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-bold text-slate-800 px-2 tabular-nums">Trang {page}</span>
              <button
                type="button"
                disabled={filteredOrders.length < limit}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Trang sau"
                className="wm-act border border-slate-200 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      </div>

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
