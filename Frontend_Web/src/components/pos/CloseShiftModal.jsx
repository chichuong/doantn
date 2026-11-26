import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { posApi } from '../../api/posApi';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { AlertCircle, Lock, DollarSign } from 'lucide-react';

export const CloseShiftModal = ({ isOpen, onClose, session, onSuccess }) => {
  const [closingCash, setClosingCash] = useState(0);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!session) return null;

  const openingCash = Number(session.openingCash || session.opening_cash || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (closingCash < 0) {
      setError('Tiền kết ca không thể âm');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await posApi.closeSession(session.id, {
        closingCash,
        note,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message || 'Không thể đóng ca bán hàng. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const cashDiff = closingCash - openingCash;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chốt Ca & Bàn Giao Quầy POS">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Kho bán lẻ:</span>
            <span className="font-semibold text-slate-900">
              {session.warehouseName || session.warehouse_name || session.warehouseId}
            </span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Thời gian mở ca:</span>
            <span className="text-slate-800 tabular-nums">
              {formatDateTime(session.openedAt || session.opened_at || session.createdAt)}
            </span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Tiền mặt ban đầu:</span>
            <span className="font-bold text-[#926a09] tabular-nums">
              {formatCurrency(openingCash)}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Tổng tiền mặt kiểm đếm thực tế trong két <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <DollarSign className="w-4 h-4 text-[#b8860b] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="number"
              min="0"
              step="1000"
              value={closingCash}
              onChange={(e) => setClosingCash(Number(e.target.value))}
              className="wm-field w-full pl-9 font-bold tabular-nums"
              required
            />
          </div>
          <div className="flex items-center justify-between mt-2 tabular-nums">
            <span className="text-xs text-[#926a09] font-extrabold">
              {formatCurrency(closingCash)}
            </span>
            <span className={`text-xs font-semibold ${cashDiff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              Chênh lệch đầu ca: {cashDiff >= 0 ? '+' : ''}
              {formatCurrency(cashDiff)}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Ghi chú bàn giao ca
          </label>
          <textarea
            rows="2"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
            placeholder="Nhập ghi chú nếu có chênh lệch tiền mặt..."
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <button type="button" onClick={onClose} className="wm-btn wm-btn-ghost">
            Tiếp tục bán hàng
          </button>
          <button
            type="submit"
            disabled={loading}
            className="wm-btn bg-rose-600 hover:bg-rose-700 text-white"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{loading ? 'Đang chốt ca...' : 'Xác nhận đóng ca'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
