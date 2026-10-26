import React from 'react';
import { X } from 'lucide-react';
import { formatNumber } from '../../utils/formatters';

export const ForecastDetailModal = ({ isOpen, onClose, product, selectedRun }) => {
  if (!isOpen || !product) return null;

  const avail = product.availableQuantity;
  const pred = Number(product.predictedQuantity || 0);

  // Formatting forecast value
  const isSmall = pred > 0 && pred < 1;
  const forecastText = isSmall
    ? 'Dưới 1 SP'
    : `~${formatNumber(Math.round(pred))} SP`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-3 sm:p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="forecast-detail-title"
        className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden max-h-[calc(100dvh-1.5rem)] sm:max-h-[90vh] flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-start justify-between bg-slate-50/60">
          <div className="space-y-0.5">
            <div className="text-xs font-mono text-slate-500">{product.sku}</div>
            <h3 id="forecast-detail-title" className="text-base font-bold text-slate-900 leading-snug">
              {product.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng chi tiết dự báo"
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 text-sm">
          {/* Key Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block">Tồn kho hiện tại</span>
              <div className="text-lg font-bold text-slate-900 mt-0.5">
                {avail === null || avail === undefined ? (
                  <span className="text-slate-400 font-normal">Chưa rõ</span>
                ) : (
                  formatNumber(avail)
                )}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block">
                Dự báo {selectedRun?.horizon_days || 7} ngày
              </span>
              <div className="text-lg font-bold text-slate-900 mt-0.5">
                {forecastText}
              </div>
              <span className="text-[11px] text-slate-500 block font-mono mt-0.5">
                Chính xác: {pred.toFixed(6)}
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block">Trạng thái</span>
              <div className="mt-1">
                <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-medium border ${product.status?.badgeClass}`}>
                  {product.status?.label}
                </span>
              </div>
            </div>
          </div>

          {/* Gợi ý kinh doanh ngắn gọn */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 space-y-1">
            <div className="font-semibold text-slate-800">Đánh giá:</div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {avail === null || avail === undefined ? (
                <>
                  Chưa có dữ liệu tồn kho để đối soát. Cần kiểm tra tồn khả dụng trước khi ra quyết định.
                </>
              ) : isSmall ? (
                <>
                  Dự báo ở mức rất nhỏ (<strong>{pred.toFixed(6)} SP</strong> trong 7 ngày); chưa có cơ sở để tự động đề xuất nhập hàng.
                </>
              ) : avail < pred ? (
                <>
                  Dự kiến bán <strong>~{Math.round(pred)} SP</strong>, cao hơn tồn hiện tại <strong>{avail} SP</strong>. Cần xem xét bổ sung hàng.
                </>
              ) : (
                <>
                  Tồn khả dụng <strong>{avail} SP</strong> đáp ứng dự kiến bán <strong>~{Math.round(pred)} SP</strong>.
                </>
              )}
            </p>
          </div>

          {/* Biểu đồ phân bổ 7 ngày mini */}
          {product.dailyValues && product.dailyValues.length > 0 && (
            <div className="space-y-2 pt-1 overflow-x-auto">
              <div className="flex items-center justify-between text-slate-600">
                <span className="font-semibold text-slate-800">
                  Phân bổ dự báo theo ngày ({product.dailyValues.length} ngày)
                </span>
                <span className="text-[11px] text-slate-400">
                  Trung bình: ~{(pred / product.dailyValues.length).toFixed(3)} SP/ngày
                </span>
              </div>

              {/* Visual 7-day bar chart */}
              <div className="grid grid-cols-7 gap-1.5 pt-1 min-w-[480px]">
                {product.dailyValues.map((dayItem, idx) => {
                  const qty = Number(dayItem.quantity || 0);
                  return (
                    <div
                      key={dayItem.date}
                      className="p-2 rounded border border-slate-200 bg-slate-50/60 text-center space-y-1"
                    >
                      <div className="text-[10px] text-slate-400">N{idx + 1}</div>
                      <div className="text-[10px] font-mono text-slate-600">
                        {dayItem.date.slice(5)}
                      </div>
                      <div className="h-8 bg-blue-50 rounded flex items-end justify-center pb-0.5">
                        <div
                          className="w-3 bg-blue-600 rounded-t"
                          style={{ height: '70%' }}
                        />
                      </div>
                      <div className="text-[10px] font-bold text-slate-700">
                        {qty < 0.01 ? '<0.01' : qty.toFixed(2)}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-slate-500">
                Tổng dự báo 7 ngày được phân bổ đều theo ngày.
              </p>
            </div>
          )}

          {/* Bảng chi tiết từng ngày */}
          {product.dailyValues && product.dailyValues.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full min-w-[520px] text-left">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-medium">
                  <tr>
                    <th className="py-2 px-3">Ngày</th>
                    <th className="py-2 px-3 text-right">Dự kiến</th>
                    <th className="py-2 px-3 text-right">Giá trị gốc (6 số thập phân)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {product.dailyValues.map((day) => {
                    const q = Number(day.quantity || 0);
                    return (
                      <tr key={day.date} className="hover:bg-slate-50">
                        <td className="py-1.5 px-3 font-mono text-slate-600">{day.date}</td>
                        <td className="py-1.5 px-3 text-right font-medium text-slate-900">
                          {q < 0.01 ? '< 0.01' : q.toFixed(2)}
                        </td>
                        <td className="py-1.5 px-3 text-right font-mono text-slate-500 text-[11px]">
                          {q.toFixed(6)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng chi tiết dự báo"
            className="px-3.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
