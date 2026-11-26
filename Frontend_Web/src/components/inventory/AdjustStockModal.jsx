import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { inventoryApi } from '../../api/inventoryApi';
import { AlertCircle, PlusCircle, ArrowDownCircle, Sliders } from 'lucide-react';

export const AdjustStockModal = ({ isOpen, onClose, warehouses = [], products = [], onSuccess }) => {
  const [productId, setProductId] = useState('');
  const [type, setType] = useState('receipt');
  const [quantity, setQuantity] = useState(1);
  const [referenceCode, setReferenceCode] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const targetWarehouseId = warehouses[0]?.id;
    if (!targetWarehouseId) {
      setError('Không tìm thấy thông tin kho trung tâm');
      return;
    }
    if (!productId) {
      setError('Vui lòng chọn hoặc nhập sản phẩm cần điều chỉnh');
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
        warehouseId: targetWarehouseId,
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
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Kho hàng thực hiện
          </label>
          <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold flex items-center justify-between">
            <span>
              {warehouses[0]?.name || 'Kho trung tâm TP Hồ Chí Minh'} ({warehouses[0]?.code || 'WH-HCM-01'})
            </span>
            <span className="wm-badge wm-badge-gold">WH-01</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Sản phẩm cần điều chỉnh <span className="text-rose-500">*</span>
          </label>
          {products.length > 0 ? (
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="wm-field w-full"
              required
            >
              <option value="">-- Chọn sản phẩm trong kho --</option>
              {products.map((item) => {
                const pid = item.product_id || item.productId || item.id;
                const pName = item.product_name || item.productName || item.name;
                return (
                  <option key={pid} value={pid}>
                    [{item.sku}] {pName} (Tồn: {item.quantity ?? 0})
                  </option>
                );
              })}
            </select>
          ) : (
            <input
              type="text"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              placeholder="Nhập mã sản phẩm..."
              className="wm-field w-full"
              required
            />
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Loại giao dịch kho <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { id: 'receipt', label: 'Nhập kho (+)', icon: PlusCircle, color: 'text-emerald-600' },
              { id: 'issue', label: 'Xuất kho (-)', icon: ArrowDownCircle, color: 'text-rose-600' },
              { id: 'adjustment', label: 'Cân kho (±)', icon: Sliders, color: 'text-amber-600' },
            ].map((item) => {
              const Icon = item.icon;
              const isSelected = type === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setType(item.id)}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition ${
                    isSelected
                      ? 'bg-[#fdf8e6] border-[#d4af37] text-[#735309]'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-[#b8860b]' : item.color}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Số lượng điều chỉnh <span className="text-rose-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="wm-field w-full font-bold tabular-nums"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Mã chứng từ / Đơn nhập đối chiếu
          </label>
          <input
            type="text"
            value={referenceCode}
            onChange={(e) => setReferenceCode(e.target.value)}
            placeholder="VD: PO-2026-0001 hoặc KIEM-KHO-01"
            className="wm-field w-full font-mono"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Lý do điều chỉnh
          </label>
          <textarea
            rows="2"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nhập lý do kiểm kê, bổ sung hoặc hư hại..."
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <button type="button" onClick={onClose} className="wm-btn wm-btn-ghost">
            Hủy
          </button>
          <button type="submit" disabled={loading} className="wm-btn wm-btn-primary">
            {loading ? 'Đang cập nhật...' : 'Ghi nhận thẻ kho'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
