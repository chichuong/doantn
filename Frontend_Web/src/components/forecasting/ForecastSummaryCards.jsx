import React from 'react';
import { Package, TrendingUp, AlertTriangle, Calendar } from 'lucide-react';
import { formatNumber } from '../../utils/formatters';

export const ForecastSummaryCards = ({
  totalProducts = 0,
  totalForecastQty = 0,
  attentionCount = 0,
  unknownCount = 0,
  selectedRun = null,
  loading = false,
}) => {
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
    <div className="wm-card grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 overflow-hidden">
      {/* 1. Sản phẩm phân tích */}
      <div className="p-4 flex items-center justify-between gap-3">
        <div>
          <span className="text-xs font-semibold text-slate-500 block">Sản phẩm phân tích</span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {loading ? '...' : formatNumber(totalProducts)}
          </div>
          <span className="text-[11px] text-slate-400">mã SKU trong đợt chạy</span>
        </div>
        <span className="w-10 h-10 rounded-xl bg-[#fdf8e6] border border-[#f7e08f] text-[#b8860b] flex items-center justify-center shrink-0">
          <Package className="w-5 h-5" />
        </span>
      </div>

      {/* 2. Dự kiến bán */}
      <div className="p-4 flex items-center justify-between gap-3">
        <div>
          <span className="text-xs font-semibold text-slate-500 block">
            Sản lượng dự báo ({selectedRun?.horizon_days ? `${selectedRun.horizon_days}N` : '7N'})
          </span>
          <div className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">
            {loading ? '...' : formatForecastValue(totalForecastQty)}
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">Ước tính sức mua kỳ tới</span>
        </div>
        <span className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
          <TrendingUp className="w-5 h-5" />
        </span>
      </div>

      {/* 3. Cần chú ý */}
      <div className="p-4 flex items-center justify-between gap-3">
        <div>
          <span className="text-xs font-semibold text-slate-500 block">Cần xem xét nhập thêm</span>
          <div className="mt-1 tabular-nums">
            {loading ? (
              <span className="text-2xl font-extrabold text-slate-900">...</span>
            ) : (
              <span className={`text-2xl font-extrabold ${attentionCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                {formatNumber(attentionCount)}
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-400">
            {unknownCount > 0 ? `${unknownCount} mã chưa rõ tồn` : 'Mặt hàng sắp chạm ngưỡng'}
          </span>
        </div>
        <span className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </span>
      </div>

      {/* 4. Cập nhật */}
      <div className="p-4 flex items-center justify-between gap-3">
        <div>
          <span className="text-xs font-semibold text-slate-500 block">Cập nhật gần nhất</span>
          <div className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums truncate">
            {selectedRun?.created_at
              ? formatDateDisplay(selectedRun.created_at)
              : loading
                ? '...'
                : '—'}
          </div>
          <span className="text-[11px] text-slate-400">
            Mô hình: {selectedRun?.model_name || 'LightGBM'}
          </span>
        </div>
        <span className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
          <Calendar className="w-5 h-5" />
        </span>
      </div>
    </div>
  );
};
