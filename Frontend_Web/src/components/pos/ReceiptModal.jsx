import React from 'react';
import { Modal } from '../common/Modal';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { Printer, PlusCircle } from 'lucide-react';

export const ReceiptModal = ({ isOpen, onClose, saleData, onNewOrder }) => {
  if (!isOpen || !saleData) return null;

  const {
    order,
    items = [],
    subtotal = 0,
    discountAmount = 0,
    finalTotal = 0,
    paymentMethod = 'cash',
    customerPaid = 0,
    change = 0,
    customerName,
    customerPhone,
    session,
    createdAt,
  } = saleData;

  const orderNumber =
    order?.orderNumber || order?.order_number || order?.id || `ORD-${Date.now()}`;

  const handlePrint = () => {
    window.print();
  };

  const paymentMethodLabel = {
    cash: 'Tiền mặt',
    card: 'Thẻ ngân hàng',
    transfer: 'Chuyển khoản QR',
  }[paymentMethod] || 'Tiền mặt';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Hóa Đơn Thanh Toán Bán Lẻ"
      maxWidth="max-w-md"
    >
      <div className="space-y-5">
        {/* Printable Thermal Receipt Area */}
        <div
          id="pos-receipt-print-area"
          className="bg-white text-black p-5 rounded-lg font-mono text-xs shadow-xs leading-relaxed border border-slate-200"
        >
          {/* Header */}
          <div className="text-center pb-2.5 border-b border-dashed border-gray-400">
            <h2 className="text-sm font-extrabold tracking-wide uppercase">
              KARAT RETAIL
            </h2>
            <p className="text-[10px] text-gray-600">
              Hệ thống quản lý bán lẻ
            </p>
            <p className="text-[10px] text-gray-500">
              Đ/C: 236 Lê Văn Sỹ, P. Tân Sơn Hòa, TP.HCM
            </p>
            <p className="text-[10px] text-gray-500">Hotline: 1900 6868</p>
            <div className="text-xs font-bold uppercase mt-2">
              HÓA ĐƠN BÁN LẺ
            </div>
          </div>

          {/* Metadata */}
          <div className="py-2 border-b border-dashed border-gray-400 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>Số HĐ:</span>
              <span className="font-bold">{orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>Ngày:</span>
              <span>{formatDateTime(createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span>Thu ngân:</span>
              <span>{session?.userName || session?.user_name || 'Thu ngân quầy'}</span>
            </div>
            <div className="flex justify-between">
              <span>Điểm bán:</span>
              <span>{session?.warehouseName || session?.warehouse_name || 'Tại quầy'}</span>
            </div>
            {customerName && (
              <div className="flex justify-between">
                <span>Khách hàng:</span>
                <span>{customerName} {customerPhone ? `(${customerPhone})` : ''}</span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="py-2.5 border-b border-dashed border-gray-400">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="pb-1">Tên món</th>
                  <th className="pb-1 text-center">SL</th>
                  <th className="pb-1 text-right">Đơn giá</th>
                  <th className="pb-1 text-right">T.Tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, idx) => (
                  <tr key={idx} className="py-1">
                    <td className="py-1 pr-1 truncate max-w-[120px]">
                      {item.name}
                    </td>
                    <td className="py-1 text-center">{item.quantity}</td>
                    <td className="py-1 text-right">
                      {formatCurrency(item.price)}
                    </td>
                    <td className="py-1 text-right font-semibold">
                      {formatCurrency(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="py-2.5 border-b border-dashed border-gray-400 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span>Tiền hàng:</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Chiết khấu:</span>
                <span>-{formatCurrency(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs font-bold pt-1 border-t border-gray-300">
              <span>TỔNG CỘNG:</span>
              <span>{formatCurrency(finalTotal)}</span>
            </div>
            <div className="flex justify-between pt-0.5">
              <span>Hình thức:</span>
              <span>{paymentMethodLabel}</span>
            </div>
            <div className="flex justify-between">
              <span>Khách đưa:</span>
              <span>{formatCurrency(customerPaid)}</span>
            </div>
            <div className="flex justify-between font-bold">
              <span>Tiền thừa:</span>
              <span>{formatCurrency(change)}</span>
            </div>
          </div>

          {/* Footer Barcode & Con dấu */}
          <div className="text-center pt-3 text-[10px] text-gray-500 space-y-1.5 relative">
            <div className="inline-block px-3 py-0.5 rounded border-2 border-emerald-600 text-emerald-700 font-extrabold text-[11px] uppercase tracking-widest rotate-[-3deg] mb-1">
              ✓ ĐÃ THANH TOÁN ({paymentMethodLabel})
            </div>
            <p className="font-semibold text-gray-700">
              Cảm ơn Quý khách & Hẹn gặp lại!
            </p>
            <p>Hóa đơn điện tử đối soát trong 7 ngày</p>
            {/* Visual Barcode SVG */}
            <div className="pt-1 flex flex-col items-center">
              <svg viewBox="0 0 220 36" className="w-48 h-9">
                {[8, 13, 16, 22, 26, 30, 36, 40, 46, 50, 56, 62, 66, 72, 76, 82, 88, 92, 98, 104, 108, 114, 120, 124, 130, 136, 140, 146, 152, 156, 162, 168, 174, 178, 184, 190, 196, 202, 208].map((x, i) => (
                  <rect
                    key={x}
                    x={x}
                    y="2"
                    width={i % 3 === 0 ? '3' : i % 2 === 0 ? '2' : '1.2'}
                    height="32"
                    fill="#0f172a"
                  />
                ))}
              </svg>
              <div className="text-center font-mono text-[9px] tracking-widest text-gray-500">
                * {orderNumber} *
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-2.5 pt-1">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-2xs flex items-center justify-center gap-1.5 transition"
          >
            <Printer className="w-3.5 h-3.5" />
            In hóa đơn (K80)
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onNewOrder();
            }}
            className="flex-1 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-2xs flex items-center justify-center gap-1.5 transition"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Tạo đơn mới
          </button>
        </div>
      </div>
    </Modal>
  );
};
