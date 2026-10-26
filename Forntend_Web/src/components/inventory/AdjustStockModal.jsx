import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { inventoryApi } from '../../api/inventoryApi';
import { AlertCircle, PlusCircle, ArrowDownCircle, Sliders } from 'lucide-react';

export const AdjustStockModal = ({ isOpen, onClose, warehouses = [], onSuccess }) => {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '');
  const [productId, setProductId] = useState('');
  const [type, setType] = useState('receipt'); // receipt | issue | adjustment
  const [quantity, setQuantity] = useState(1);
  const [referenceCode, setReferenceCode] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!warehouseId) {
      setError('Vui lòng chọn kho');
      return;
    }
    if (!productId) {
      setError('Vui lòng nhập Product UUID');
      return;
    }
    if (quantity <= 0) {
      setError('Số lượng điều chỉnh phải lớn hơn 0');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await inventoryApi.adjustInventory({
        warehouseId,
        productId,
        type,
        quantity,
        referenceCode: referenceCode.trim() || `ADJ-${Date.now()}`,
        note: note.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Điều chỉnh tồn kho thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Lập Phiếu Điều Chỉnh & Cân Tồn Kho">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Warehouse */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Kho hàng thực hiện <span className="text-red-500">*</span>
          </label>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
            required
          >
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name} ({wh.code})
              </option>
            ))}
          </select>
        </div>

        {/* Product UUID */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Mã định danh sản phẩm (Product UUID) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            placeholder="Dán mã UUID sản phẩm..."
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-mono"
            required
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Loại giao dịch kho <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { id: 'receipt', label: 'Nhập kho (+)', icon: PlusCircle, color: 'text-emerald-700' },
              { id: 'issue', label: 'Xuất kho (-)', icon: ArrowDownCircle, color: 'text-red-700' },
              { id: 'adjustment', label: 'Cân kho (±)', icon: Sliders, color: 'text-amber-700' },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = type === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setType(item.id)}
                  className={`p-2 rounded-lg border text-xs font-semibold flex flex-col items-center gap-1 transition ${
                    isSelected
                      ? 'bg-blue-50 border-blue-600 text-blue-700'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-700' : item.color}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Số lượng điều chỉnh <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-bold focus:outline-none focus:border-blue-600"
            required
          />
        </div>

        {/* Reference Code */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Mã chứng từ / Đơn nhập đối chiếu
          </label>
          <input
            type="text"
            value={referenceCode}
            onChange={(e) => setReferenceCode(e.target.value)}
            placeholder="VD: PO-2026-0001 hoặc KIEM-KHO-01"
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
          />
        </div>

        {/* Note */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Lý do điều chỉnh
          </label>
          <textarea
            rows="2"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nhập lý do kiểm kê, bổ sung hoặc hư hại..."
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition disabled:opacity-50"
          >
            {loading ? 'Đang cập nhật...' : 'Ghi nhận thẻ kho'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
