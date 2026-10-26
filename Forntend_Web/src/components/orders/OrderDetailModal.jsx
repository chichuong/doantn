import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { OrderTimeline } from './OrderTimeline';
import { StateActions } from './StateActions';
import { orderApi } from '../../api/orderApi';
import { posApi } from '../../api/posApi';
import { formatCurrency, formatDateTime, ORDER_STATUS_META, CHANNEL_META } from '../../utils/formatters';
import { Package, User, MapPin, Warehouse, AlertCircle } from 'lucide-react';

export const OrderDetailModal = ({ isOpen, onClose, orderId, onUpdated, salesMode = false }) => {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchDetail = async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      setError('');
      const res = salesMode
        ? await posApi.getSaleDetail(orderId)
        : await orderApi.getOrderDetail(orderId);
      setOrder(res?.data || res);
    } catch (err) {
      setError(err.message || 'Không thể tải chi tiết đơn hàng');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && orderId) {
      fetchDetail();
    } else {
      setOrder(null);
    }
  }, [isOpen, orderId]);

  if (!isOpen) return null;

  const statusMeta = ORDER_STATUS_META[order?.status] || {
    label: order?.status,
    color: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const channelMeta = CHANNEL_META[order?.channel] || {
    label: order?.channel,
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chi tiết đơn hàng" maxWidth="max-w-3xl">
      {loading && (
        <div className="py-12 text-center text-xs text-slate-400">
          Đang tải dữ liệu đơn hàng...
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {order && !loading && (
        <div className="space-y-5">
          {/* Header Info */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 font-mono">
                  #{order.order_number || order.orderNumber || order.id}
                </h3>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${statusMeta.color}`}
                >
                  {statusMeta.label}
                </span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${channelMeta.badge}`}
                >
                  {channelMeta.label}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Tạo lúc: {formatDateTime(order.created_at || order.createdAt)}
              </p>
            </div>

            <div className="text-right">
              <span className="text-[11px] text-slate-500 block">Tổng thanh toán</span>
              <span className="text-xl font-bold text-slate-900">
                {formatCurrency(order.total_amount || order.totalAmount || 0)}
              </span>
            </div>
          </div>

          {/* Stepper Timeline */}
          <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Tiến trình xử lý đơn hàng
            </h4>
            <OrderTimeline
              currentStatus={order.status}
              statusHistory={order.status_history || order.statusHistory || []}
            />
          </div>

          {/* Action Buttons Hub */}
          {!salesMode && <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <StateActions
              order={order}
              onRefresh={() => {
                fetchDetail();
                if (onUpdated) onUpdated();
              }}
            />
          </div>}

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            {/* Customer Box */}
            <div className="p-3.5 rounded-lg bg-white border border-slate-200 space-y-1">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5 text-blue-600 mb-1">
                <User className="w-3.5 h-3.5" /> Khách hàng
              </div>
              <div className="font-semibold text-slate-800">
                {order.customer_name || order.customerName || 'Khách lẻ tại quầy'}
              </div>
              <div className="text-slate-500">
                SĐT: {order.customer_phone || order.customerPhone || '---'}
              </div>
            </div>

            {/* Warehouse Box */}
            <div className="p-3.5 rounded-lg bg-white border border-slate-200 space-y-1">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5 text-blue-600 mb-1">
                <Warehouse className="w-3.5 h-3.5" /> Kho xuất hàng
              </div>
              <div className="font-semibold text-slate-800">
                {order.warehouse_name || order.warehouseName || order.warehouse_id || 'Kho mặc định'}
              </div>
              <div className="text-slate-500">
                Phương thức: <span className="uppercase font-mono font-medium text-slate-700">{order.payment_method || order.paymentMethod || 'cash'}</span>
              </div>
            </div>

            {/* Shipping Box */}
            <div className="p-3.5 rounded-lg bg-white border border-slate-200 space-y-1">
              <div className="font-semibold text-slate-900 flex items-center gap-1.5 text-blue-600 mb-1">
                <MapPin className="w-3.5 h-3.5" /> Giao nhận
              </div>
              <div className="text-slate-700">
                {order.shipping_address || 'Nhận trực tiếp tại quầy POS'}
              </div>
              {order.tracking_number && (
                <div className="text-slate-500">
                  Mã vận đơn: <span className="font-mono text-slate-900 font-bold">{order.tracking_number}</span>
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-slate-500" /> Danh sách sản phẩm trong đơn
            </h4>
            <div className="rounded-lg border border-slate-200 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Sản phẩm</th>
                    <th className="py-2.5 px-3">Mã SKU</th>
                    <th className="py-2.5 px-3 text-center">Số lượng</th>
                    <th className="py-2.5 px-3 text-right">Đơn giá</th>
                    <th className="py-2.5 px-3 text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {(order.items || []).map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {item.product_name || item.productName || item.name}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">
                        {item.sku || '---'}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                        {item.quantity}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-600">
                        {formatCurrency(item.unit_price || item.unitPrice || item.price)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {formatCurrency(item.subtotal || (item.quantity * (item.unit_price || item.unitPrice || item.price)))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
