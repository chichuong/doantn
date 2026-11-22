import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../common/Modal';
import { OrderTimeline } from './OrderTimeline';
import { StateActions } from './StateActions';
import { orderApi } from '../../api/orderApi';
import { posApi } from '../../api/posApi';
import { formatCurrency, formatDateTime, ORDER_STATUS_META, CHANNEL_META } from '../../utils/formatters';
import { Package, User, MapPin, Warehouse, AlertCircle, FileText, Radio } from 'lucide-react';

export const OrderDetailModal = ({ isOpen, onClose, orderId, onUpdated, salesMode = false }) => {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDigitalSlip, setShowDigitalSlip] = useState(false);

  const fetchDetail = useCallback(async (silent = false) => {
    if (!orderId) return;
    try {
      if (!silent) setLoading(true);
      setError('');
      const res = salesMode
        ? await posApi.getSaleDetail(orderId)
        : await orderApi.getOrderDetail(orderId);
      setOrder(res?.data || res);
    } catch (err) {
      if (!silent) setError(err.message || 'Không thể tải chi tiết đơn hàng');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [orderId, salesMode]);

  useEffect(() => {
    if (isOpen && orderId) {
      setShowDigitalSlip(false);
      fetchDetail(false);
    } else {
      setOrder(null);
    }
  }, [isOpen, orderId, fetchDetail]);

  // Live Auto-Polling mỗi 4 giây khi đơn hàng đang xử lý để tự động chuyển cảnh Video
  useEffect(() => {
    if (!isOpen || !orderId || !order) return;
    if (['delivered', 'cancelled', 'returned'].includes(order.status)) return;
    const timer = setInterval(() => {
      fetchDetail(true);
    }, 4000);
    return () => clearInterval(timer);
  }, [isOpen, orderId, order?.status, fetchDetail]);

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

            <div className="text-right flex flex-col items-end gap-1.5">
              <div>
                <span className="text-[11px] text-slate-500 block">Tổng thanh toán</span>
                <span className="text-xl font-bold text-slate-900">
                  {formatCurrency(order.total_amount || order.totalAmount || 0)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowDigitalSlip((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 ${
                  showDigitalSlip
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{showDigitalSlip ? 'Ẩn Phiếu điện tử' : 'Xem Phiếu Vận Đơn / Hóa đơn điện tử'}</span>
              </button>
            </div>
          </div>

          {/* Digital E-Receipt / E-Shipping Label On-Screen Preview (Không cần máy in vật lý) */}
          {showDigitalSlip && (
            <div className="p-5 rounded-xl bg-amber-50/40 border-2 border-dashed border-slate-400 font-mono text-xs text-slate-900 space-y-3 shadow-inner">
              <div className="flex items-start justify-between border-b-2 border-slate-800 pb-3">
                <div>
                  <div className="text-sm font-extrabold tracking-wider uppercase text-slate-900">
                    KARAT RETAIL OMNICHANNEL
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {order.channel === 'pos' ? 'PHIẾU HÓA ĐƠN BÁN LẺ ĐIỆN TỬ (K80)' : 'PHIẾU VẬN ĐƠN & KIỂM HÀNG ĐIỆN TỬ (E-AWB)'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Kho xuất: {order.warehouse_name || order.warehouseName || 'Kho trung tâm TP. Hồ Chí Minh'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="inline-block px-2.5 py-0.5 rounded border-2 border-emerald-700 text-emerald-800 font-extrabold text-[11px] uppercase">
                    {(order.payment_method || order.paymentMethod) === 'transfer'
                      ? 'ĐÃ THU TIỀN VIETQR'
                      : order.channel === 'pos'
                      ? 'ĐÃ THU TIỀN TẠI QUẦY'
                      : `THU HỘ COD: ${formatCurrency(order.total_amount || order.totalAmount || 0)}`}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {formatDateTime(order.created_at || order.createdAt)}
                  </div>
                </div>
              </div>

              {/* Barcode SVG của Mã đơn / Mã vận đơn */}
              <div className="py-2 bg-white rounded-lg border border-slate-300 flex flex-col items-center justify-center">
                <svg viewBox="0 0 280 42" className="w-64 h-10">
                  {[10, 15, 19, 25, 31, 35, 42, 48, 52, 59, 65, 70, 77, 83, 88, 95, 100, 106, 112, 118, 124, 130, 136, 142, 148, 154, 160, 166, 172, 178, 184, 190, 196, 202, 208, 214, 220, 226, 232, 238, 244, 250, 256, 262, 268].map((x, i) => (
                    <rect
                      key={x}
                      x={x}
                      y="3"
                      width={i % 3 === 0 ? '3.5' : i % 2 === 0 ? '2.2' : '1.2'}
                      height="36"
                      fill="#0f172a"
                    />
                  ))}
                </svg>
                <div className="text-[11px] font-bold tracking-widest text-slate-800 mt-0.5">
                  {order.tracking_number || order.order_number || order.orderNumber || order.id}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] border-b border-dashed border-slate-400 pb-3">
                <div className="p-2.5 rounded bg-white border border-slate-200">
                  <div className="font-bold text-slate-500 uppercase text-[10px]">Người gửi (Kho xuất)</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {order.warehouse_name || order.warehouseName || 'Kho trung tâm TP. Hồ Chí Minh'}
                  </div>
                  <div className="text-slate-600">Hotline CSKH: 1900 6868</div>
                </div>
                <div className="p-2.5 rounded bg-white border border-slate-200">
                  <div className="font-bold text-slate-500 uppercase text-[10px]">Người nhận</div>
                  <div className="font-bold text-slate-900 mt-0.5">
                    {order.customer_name || order.customerName || 'Khách lẻ tại quầy'} ({order.customer_phone || order.customerPhone || '---'})
                  </div>
                  <div className="text-slate-600">
                    {order.shipping_address || 'Nhận hàng trực tiếp tại quầy POS'}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-bold pt-1">
                <span>TỔNG SỐ MÓN: {(order.items || []).reduce((s, i) => s + Number(i.quantity || 0), 0)} SP</span>
                <span className="text-sm text-blue-700">
                  TỔNG THANH TOÁN: {formatCurrency(order.total_amount || order.totalAmount || 0)}
                </span>
              </div>
            </div>
          )}

          {/* Stepper Timeline */}
          <div className="p-4 rounded-lg bg-white border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Tiến trình xử lý đơn hàng
              </h4>
              {!['delivered', 'cancelled', 'returned'].includes(order.status) && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <Radio className="w-3 h-3 animate-pulse text-emerald-600" />
                  <span>Đồng bộ trực tiếp (Live)</span>
                </span>
              )}
            </div>
            <OrderTimeline
              currentStatus={order.status}
              statusHistory={order.status_history || order.statusHistory || []}
            />
          </div>

          {/* Action Buttons Hub */}
          {!salesMode && order.channel !== 'pos' && (
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
              <StateActions
                order={order}
                onRefresh={() => {
                  fetchDetail();
                  if (onUpdated) onUpdated();
                }}
              />
            </div>
          )}

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
                <Warehouse className="w-3.5 h-3.5" /> Kho xuất & Thanh toán
              </div>
              <div className="font-semibold text-slate-800">
                {order.warehouse_name || order.warehouseName || 'Kho trung tâm TP. Hồ Chí Minh'}
              </div>
              <div className="text-slate-500">
                Hình thức:{' '}
                <span className="font-semibold text-slate-800">
                  {(order.payment_method || order.paymentMethod) === 'transfer'
                    ? 'Chuyển khoản QR (VietQR)'
                    : (order.payment_method || order.paymentMethod) === 'cod'
                      ? 'Thanh toán khi nhận hàng (COD)'
                      : 'Tiền mặt tại quầy'}
                </span>
              </div>
              {order.transaction_reference && (
                <div className="text-[11px] text-slate-400 font-mono truncate" title={order.transaction_reference}>
                  Mã GD: {order.transaction_reference}
                </div>
              )}
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
                  {(order.items || []).map((item, idx) => {
                    const imgUrl = item.image_url || item.imageUrl;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/70">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          <div className="flex items-center gap-2.5">
                            {imgUrl ? (
                              <img
                                src={imgUrl}
                                alt={item.product_name || item.productName || item.name}
                                className="w-9 h-9 rounded-md object-contain bg-white border border-slate-200 p-0.5 shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                                <Package className="w-4 h-4 text-slate-400" />
                              </div>
                            )}
                            <span>{item.product_name || item.productName || item.name}</span>
                          </div>
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
                          {formatCurrency(item.line_total || item.subtotal || (item.quantity * (item.unit_price || item.unitPrice || item.price)))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
};
