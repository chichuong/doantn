import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { inventoryApi } from '../../api/inventoryApi';
import { posApi } from '../../api/posApi';
import { formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { DollarSign, AlertCircle } from 'lucide-react';

export const OpenShiftModal = ({ isOpen, onClose, onSuccess }) => {
  const { hasPermission } = useAuth();
  const canReadWarehouses = hasPermission('manager.warehouses.read');
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [openingCash, setOpeningCash] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (canReadWarehouses) {
        const fetchWarehouses = async () => {
          try {
            const res = await inventoryApi.getWarehouses();
            const list = res?.data || [];
            setWarehouses(list);
            if (list.length > 0) {
              setWarehouseId(list[0].id);
            }
          } catch {
            // Backend auto-assigns central warehouse WH-HCM-01
          }
        };
        fetchWarehouses();
      }
      setOpeningCash(500000);
      setError('');
    }
  }, [isOpen, canReadWarehouses]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (openingCash < 0) {
      setError('Tiền đầu ca không thể âm');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await posApi.openSession({
        warehouseId: warehouseId || undefined,
        openingCash,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Mở ca thất bại. Bạn có thể đã có một ca đang hoạt động.');
    } finally {
      setLoading(false);
    }
  };

  const quickAmounts = [200000, 500000, 1000000, 2000000];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mở Ca Bán Hàng POS">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Điểm bán / Kho trung tâm
          </label>
          <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-semibold flex items-center justify-between">
            <span>
              {warehouses[0]?.name || 'Kho trung tâm TP Hồ Chí Minh'} ({warehouses[0]?.code || 'WH-HCM-01'})
            </span>
            <span className="wm-badge wm-badge-gold">WH-01</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Giao dịch bán lẻ tại quầy sẽ trừ tồn kho thực tế trực tiếp tại kho vận hành.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Tiền mặt đầu ca (Tiền lẻ ban đầu) <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <DollarSign className="w-4 h-4 text-[#b8860b] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="number"
              min="0"
              step="1000"
              value={openingCash}
              onChange={(e) => setOpeningCash(Number(e.target.value))}
              className="wm-field w-full pl-9 font-bold tabular-nums"
              required
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-[#926a09] font-extrabold tabular-nums">
              {formatCurrency(openingCash)}
            </span>
            <div className="flex gap-1.5">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setOpeningCash(amt)}
                  className="px-2 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-[#fdf8e6] hover:text-[#926a09] text-slate-700 rounded-md transition tabular-nums"
                >
                  {amt / 1000}k
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="wm-btn wm-btn-ghost">
            Hủy bỏ
          </button>
          <button type="submit" disabled={loading} className="wm-btn wm-btn-primary">
            {loading ? 'Đang kích hoạt...' : 'Bắt đầu ca bán hàng'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
