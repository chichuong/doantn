import React, { useState, useMemo } from 'react';
import { Modal } from '../common/Modal';
import { posApi } from '../../api/posApi';
import { formatCurrency } from '../../utils/formatters';
import {
  Banknote,
  QrCode,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

const DEFAULT_BANK_BIN = import.meta.env.VITE_BANK_BIN || '970436'; // Vietcombank
const DEFAULT_BANK_ACC = import.meta.env.VITE_BANK_ACCOUNT_NUMBER || '1025321052';
const DEFAULT_BANK_OWNER = import.meta.env.VITE_BANK_ACCOUNT_NAME || 'LY CHI CHUONG';

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
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'transfer'
  const [customerPaid, setCustomerPaid] = useState(finalTotal);
  const [transferRef, setTransferRef] = useState('');
  const [customerName, setCustomerName] = useState(customer?.name || '');
  const [customerPhone, setCustomerPhone] = useState(customer?.phone || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const qrOrderCode = useMemo(() => `POS${String(Date.now()).slice(-6)}`, [isOpen]);

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

      let transactionReference = `CASH-${Date.now()}`;
      if (paymentMethod === 'transfer') {
        transactionReference = transferRef.trim() || `VIETQR-${qrOrderCode}`;
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

  const qrTransferUrl = `https://img.vietqr.io/image/${DEFAULT_BANK_BIN}-${DEFAULT_BANK_ACC}-compact2.png?amount=${finalTotal}&addInfo=${encodeURIComponent(qrOrderCode)}&accountName=${encodeURIComponent(DEFAULT_BANK_OWNER)}`;

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

        {/* Phương thức thanh toán (2 Tabs: Tiền mặt & Chuyển khoản QR) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-2">
            Hình thức thanh toán
          </label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'cash', label: 'Tiền mặt tại quầy', icon: Banknote },
              { id: 'transfer', label: 'Chuyển khoản mã QR (VietQR)', icon: QrCode },
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
                  className={`flex items-center justify-center gap-2 p-3 rounded-lg border text-xs font-semibold transition ${isSelected
                    ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
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

        {paymentMethod === 'transfer' && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
              <img
                src={qrTransferUrl}
                alt="Mã QR Thanh toán"
                className="w-64 h-64 sm:w-72 sm:h-72 object-contain mx-auto"
              />
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

export default PaymentModal;

