import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { inventoryApi } from '../../api/inventoryApi';
import { posApi } from '../../api/posApi';
import { formatCurrency } from '../../utils/formatters';
import { DollarSign, AlertCircle } from 'lucide-react';

export const OpenShiftModal = ({ isOpen, onClose, onSuccess }) => {
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [openingCash, setOpeningCash] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      const fetchWarehouses = async () => {
        try {
          const res = await inventoryApi.getWarehouses();
          const list = res?.data || [];
          setWarehouses(list);
          if (list.length > 0) {
            setWarehouseId(list[0].id);
          }
        } catch (err) {
          setError('Không thể tải danh sách kho hàng');
        }
      };
      fetchWarehouses();
      setOpeningCash(500000); // Mặc định 500k tiền mặt đầu ca
      setError('');
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!warehouseId) {
      setError('Vui lòng chọn điểm bán hàng');
      return;
    }
    if (openingCash < 0) {
      setError('Tiền đầu ca không thể âm');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await posApi.openSession({
        warehouseId,
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
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Warehouse Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Điểm bán / Kho xuất hàng <span className="text-red-500">*</span>
          </label>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
            required
          >
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name} ({wh.code}) {wh.address ? `- ${wh.address}` : ''}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-500 mt-1">
            Giao dịch bán lẻ sẽ trừ tồn kho thực tế trực tiếp tại điểm bán này.
          </p>
        </div>

        {/* Opening Cash Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Tiền mặt đầu ca (Tiền thối ban đầu) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="number"
              min="0"
              step="1000"
              value={openingCash}
              onChange={(e) => setOpeningCash(Number(e.target.value))}
              className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
              required
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-blue-700 font-bold">
              {formatCurrency(openingCash)}
            </span>
            <div className="flex gap-1.5">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setOpeningCash(amt)}
                  className="px-2 py-1 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition"
                >
                  +{amt / 1000}k
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition shadow-2xs disabled:opacity-50"
          >
            {loading ? 'Đang kích hoạt...' : 'Bắt đầu ca bán hàng'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
