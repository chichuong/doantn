import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { posApi } from '../../api/posApi';
import { formatCurrency } from '../../utils/formatters';
import {
  Banknote,
  CreditCard,
  QrCode,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export const PaymentModal = ({
  isOpen,
  onClose,
  session,
  cart,
  subtotal,
  discountAmount,
  finalTotal,
  customer,
  onSuccess,
}) => {
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'card' | 'transfer'
  const [customerPaid, setCustomerPaid] = useState(finalTotal);
  const [cardRef, setCardRef] = useState('');
  const [customerName, setCustomerName] = useState(customer?.name || '');
  const [customerPhone, setCustomerPhone] = useState(customer?.phone || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const change = Math.max(0, customerPaid - finalTotal);
  const isPaidEnough = paymentMethod !== 'cash' || customerPaid >= finalTotal;

  const handlePayment = async () => {
    if (!session?.id) {
      setError('Chưa có ca bán hàng hợp lệ. Vui lòng mở ca trước.');
      return;
    }
    if (cart.length === 0) {
      setError('Giỏ hàng trống');
      return;
    }
    if (!isPaidEnough) {
      setError('Số tiền khách đưa chưa đủ');
      return;
    }

    try {
      setLoading(true);
      setError('');

      let transactionReference = `POS-${Date.now()}`;
      if (paymentMethod === 'card') {
        transactionReference = cardRef.trim() || `CARD-${Date.now()}`;
      } else if (paymentMethod === 'transfer') {
        transactionReference = `QR-${Date.now()}`;
      }

      const salePayload = {
        sessionId: session.id,
        paymentMethod,
        transactionReference,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        items: cart.map((item) => ({
          productId: item.id,
          quantity: item.quantity,
        })),
      };

      const res = await posApi.createSale(salePayload);
      const createdOrder = res?.data || res;

      onSuccess({
        order: createdOrder,
        items: [...cart],
        subtotal,
        discountAmount,
        finalTotal,
        paymentMethod,
        customerPaid: paymentMethod === 'cash' ? customerPaid : finalTotal,
        change: paymentMethod === 'cash' ? change : 0,
        customerName,
        customerPhone,
        session,
        createdAt: new Date().toISOString(),
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Thanh toán thất bại. Kiểm tra lại tồn kho hoặc phiên làm việc.');
    } finally {
      setLoading(false);
    }
  };

  const quickCashOptions = [
    { label: 'Đưa đủ', value: finalTotal },
    { label: '100.000 ₫', value: 100000 },
    { label: '200.000 ₫', value: 200000 },
    { label: '500.000 ₫', value: 500000 },
    { label: '1.000.000 ₫', value: 1000000 },
  ].filter((opt) => opt.value >= finalTotal || opt.label === 'Đưa đủ');

  const qrTransferUrl = `https://img.vietqr.io/image/970422-0901234567-compact2.png?amount=${finalTotal}&addInfo=POS%20THANH%20TOAN&accountName=KARAT%20RETAIL`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Thanh Toán Đơn Bán Lẻ" maxWidth="max-w-xl">
      <div className="space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Tổng tiền cần thanh toán */}
        <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium block">
              Tổng tiền cần thanh toán
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">
              {formatCurrency(finalTotal)}
            </div>
            {discountAmount > 0 && (
              <span className="text-xs text-emerald-700">
                (Đã giảm {formatCurrency(discountAmount)})
              </span>
            )}
          </div>

          <div className="text-right text-xs text-slate-500">
            <div>Số lượng: <strong className="text-slate-800">{cart.length} món</strong></div>
            <div>Kho xuất: <strong className="text-slate-800">{session?.warehouseName || 'Tại quầy'}</strong></div>
          </div>
        </div>

        {/* Phương thức thanh toán (3 Tabs) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Hình thức thanh toán
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              { id: 'cash', label: 'Tiền mặt', icon: Banknote },
              { id: 'card', label: 'Quẹt thẻ POS', icon: CreditCard },
              { id: 'transfer', label: 'Chuyển khoản QR', icon: QrCode },
            ].map((method) => {
              const Icon = method.icon;
              const isSelected = paymentMethod === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => {
                    setPaymentMethod(method.id);
                    if (method.id === 'cash') setCustomerPaid(finalTotal);
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-semibold transition ${
                    isSelected
                      ? 'bg-blue-50 border-blue-600 text-blue-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4 mb-1" />
                  <span>{method.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Chi tiết theo phương thức */}
        {paymentMethod === 'cash' && (
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Tiền khách đưa (VND)
              </label>
              <input
                type="number"
                min={finalTotal}
                step="1000"
                value={customerPaid}
                onChange={(e) => setCustomerPaid(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-base font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            {/* Quick buttons */}
            <div className="flex flex-wrap gap-1.5">
              {quickCashOptions.map((opt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCustomerPaid(opt.value)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition"
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Tiền thừa */}
            <div className="p-3 rounded-lg bg-white border border-slate-200 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">
                Tiền thừa trả khách:
              </span>
              <span className="text-base font-bold text-emerald-700">
                {formatCurrency(change)}
              </span>
            </div>
          </div>
        )}

        {paymentMethod === 'card' && (
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
            <label className="block text-xs font-semibold text-slate-700">
              Mã giao dịch / Mã chuẩn chi thẻ
            </label>
            <input
              type="text"
              value={cardRef}
              onChange={(e) => setCardRef(e.target.value)}
              placeholder="VD: TXN-8822 hoặc mã phê duyệt máy POS"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
            />
            <p className="text-[11px] text-slate-500">
              Thao tác quẹt thẻ qua máy POS ngân hàng, sau khi thành công nhấn Hoàn tất.
            </p>
          </div>
        )}

        {paymentMethod === 'transfer' && (
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
            <div className="bg-white p-2 rounded-lg border border-slate-200 shrink-0">
              <img
                src={qrTransferUrl}
                alt="VietQR Chuyển khoản"
                className="w-28 h-28 object-contain"
              />
            </div>
            <div className="space-y-1 text-xs text-slate-600">
              <div className="font-semibold text-slate-900">
                Quét mã VietQR chuyển khoản
              </div>
              <div>Số tiền: <strong className="text-slate-900">{formatCurrency(finalTotal)}</strong></div>
              <div>Nội dung: <strong className="text-blue-700 font-mono">POS THANH TOAN</strong></div>
              <p className="text-[11px] text-slate-500 pt-0.5">
                Khách dùng app ngân hàng quét mã QR trên để chuyển khoản tự động.
              </p>
            </div>
          </div>
        )}

        {/* Khách hàng (Tùy chọn) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Tên khách hàng
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Khách lẻ tại quầy"
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Số điện thoại
            </label>
            <input
              type="text"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="09..."
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
          >
            Quay lại
          </button>
          <button
            type="button"
            disabled={loading || !isPaidEnough}
            onClick={handlePayment}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition shadow-2xs flex items-center gap-1.5 disabled:opacity-40"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{loading ? 'Đang thanh toán...' : 'Hoàn tất & In hóa đơn'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
