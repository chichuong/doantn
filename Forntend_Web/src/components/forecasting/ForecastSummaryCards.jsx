import React from 'react';
import { formatNumber } from '../../utils/formatters';

/**
 * 4 Thẻ KPI Tối giản:
 * - Sản phẩm: 9
 * - Dự kiến bán: Dưới 1 SP
 * - Cần chú ý: 0 (hoặc số lượng cần xem xét, kèm chú thích nếu có SP chưa rõ tồn)
 * - Cập nhật: 21/10/2026
 */
export const ForecastSummaryCards = ({
  totalProducts = 0,
  totalForecastQty = 0,
  attentionCount = 0,
  unknownCount = 0,
  selectedRun = null,
  loading = false,
}) => {
  // Format total forecast quantity
  const formatForecastValue = (qty) => {
    const num = Number(qty || 0);
    if (!Number.isFinite(num) || num === 0) return '0 SP';
    if (num < 1) return 'Dưới 1 SP';
    return `~${formatNumber(Math.round(num))} SP`;
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr.slice(0, 10);
      return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(d);
    } catch {
      return dateStr.slice(0, 10);
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* 1. Sản phẩm */}
      <div className="px-4 py-3 rounded-lg bg-white border border-slate-200">
        <span className="text-xs text-slate-500 font-medium block">Sản phẩm</span>
        <div className="text-xl font-bold text-slate-900 mt-0.5">
          {loading ? '...' : formatNumber(totalProducts)}
        </div>
      </div>

      {/* 2. Dự kiến bán */}
      <div className="px-4 py-3 rounded-lg bg-white border border-slate-200">
        <span className="text-xs text-slate-500 font-medium block">
          Dự kiến bán ({selectedRun?.horizon_days ? `${selectedRun.horizon_days}N` : '7N'})
        </span>
        <div className="text-xl font-bold text-slate-900 mt-0.5">
          {loading ? '...' : formatForecastValue(totalForecastQty)}
        </div>
      </div>

      {/* 3. Cần chú ý */}
      <div className="px-4 py-3 rounded-lg bg-white border border-slate-200">
        <span className="text-xs text-slate-500 font-medium block">Cần chú ý</span>
        <div className="mt-0.5">
          {loading ? (
            <div className="text-xl font-bold text-slate-900">...</div>
          ) : attentionCount > 0 ? (
            <div className="text-xl font-bold text-amber-600">
              {formatNumber(attentionCount)}
              {unknownCount > 0 && (
                <span className="text-[11px] font-normal text-slate-400 ml-1.5">
                  ({unknownCount} chưa rõ tồn)
                </span>
              )}
            </div>
          ) : unknownCount > 0 ? (
            <div className="text-xl font-bold text-slate-700">
              0
              <span className="text-[11px] font-normal text-slate-400 ml-1.5">
                ({unknownCount} chưa rõ tồn)
              </span>
            </div>
          ) : (
            <div className="text-xl font-bold text-slate-900">0</div>
          )}
        </div>
      </div>

      {/* 4. Cập nhật */}
      <div className="px-4 py-3 rounded-lg bg-white border border-slate-200">
        <span className="text-xs text-slate-500 font-medium block">Cập nhật</span>
        <div className="text-xl font-bold text-slate-900 mt-0.5 truncate">
          {selectedRun?.created_at
            ? formatDateDisplay(selectedRun.created_at)
            : loading
            ? '...'
            : '—'}
        </div>
      </div>
    </div>
  );
};
