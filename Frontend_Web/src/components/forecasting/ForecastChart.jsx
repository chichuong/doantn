import React, { useState, useMemo } from 'react';
import { BarChart2, Info, ChevronRight } from 'lucide-react';
import { formatNumber } from '../../utils/formatters';

export const ForecastChart = ({ products = [], selectedRun = null }) => {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [viewMode, setViewMode] = useState('comparison'); // 'comparison' | 'timeline'

  // If no product is selected yet, default to first product with shortage, or first product
  const activeProduct = useMemo(() => {
    if (!products.length) return null;
    if (selectedProductId) {
      return products.find((p) => p.productId === selectedProductId) || products[0];
    }
    const shortageItem = products.find((p) => p.status.code === 'shortage' || p.status.code === 'critical');
    return shortageItem || products[0];
  }, [products, selectedProductId]);

  // Top products for comparison (up to 6 items)
  const topProducts = useMemo(() => {
    if (!products.length) return [];
    return [...products]
      .sort((a, b) => {
        // Prioritize items with shortage, then highest forecast
        if (a.status.priority !== b.status.priority) return a.status.priority - b.status.priority;
        return b.predictedQuantity - a.predictedQuantity;
      })
      .slice(0, 6);
  }, [products]);

  // Max value for scaling bars in comparison view
  const maxComparisonVal = useMemo(() => {
    let max = 5;
    topProducts.forEach((p) => {
      if (p.availableQuantity > max) max = p.availableQuantity;
      if (p.predictedQuantity > max) max = p.predictedQuantity;
    });
    return Math.ceil(max * 1.15);
  }, [topProducts]);

  if (!products.length) {
    return (
      <div className="p-8 rounded-xl bg-white border border-slate-200 text-center text-slate-400">
        <BarChart2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        <p className="text-xs">Chưa có dữ liệu dự báo để hiển thị biểu đồ</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-2xs">
      {/* Header & Controls */}
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <BarChart2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Trực quan hóa Dự báo & Đối soát tồn kho
            </h3>
            <p className="text-[11px] text-slate-500">
              So sánh lượng hàng sẵn có với nhu cầu dự kiến trong chu kỳ {selectedRun?.horizon_days || 7} ngày
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-200/70 p-0.5 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setViewMode('comparison')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                viewMode === 'comparison'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              So sánh Top mặt hàng
            </button>
            <button
              type="button"
              onClick={() => setViewMode('timeline')}
              className={`px-2.5 py-1 rounded-md font-medium transition ${
                viewMode === 'timeline'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Phân bổ từng ngày
            </button>
          </div>

          {/* Product Selector */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 px-2.5 py-1 rounded-lg text-xs">
            <span className="text-slate-500 font-medium">Sản phẩm:</span>
            <select
              value={activeProduct?.productId || ''}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 focus:outline-none max-w-[180px] truncate"
            >
              {products.map((p) => (
                <option key={p.productId} value={p.productId}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="p-5">
        {viewMode === 'comparison' ? (
          /* View 1: Comparison between Available Stock and Forecasted Demand */
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100">
              <span className="font-semibold text-slate-700">Top mặt hàng phân tích</span>
              <div className="flex items-center gap-4 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-slate-300 inline-block" />
                  <span>Tồn khả dụng hiện tại</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-xs bg-blue-600 inline-block" />
                  <span>Dự kiến bán ({selectedRun?.horizon_days || 7} ngày)</span>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-1">
              {topProducts.map((p) => {
                const avail = p.availableQuantity ?? 0;
                const pred = p.predictedQuantity ?? 0;
                const isShortage = avail < pred || avail === 0;

                const availPercent = Math.min(100, Math.round((avail / maxComparisonVal) * 100));
                const predPercent = Math.min(100, Math.max(pred > 0 ? 3 : 0, Math.round((pred / maxComparisonVal) * 100)));

                return (
                  <div key={p.productId} className="space-y-1.5 group">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition truncate max-w-[260px]">
                          {p.name}
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {p.sku}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] shrink-0 font-medium">
                        <span className="text-slate-600">
                          Tồn: <strong className="text-slate-900">{formatNumber(avail)}</strong>
                        </span>
                        <span className="text-blue-700">
                          Dự kiến:{' '}
                          <strong>
                            {pred < 1 && pred > 0 ? `< 1 sp (~${pred.toFixed(3)})` : `~${formatNumber(Math.round(pred))} sp`}
                          </strong>
                        </span>
                        {isShortage && (
                          <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                            Thiếu: +{p.recommendedQuantity || Math.ceil(pred - avail)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Double Bar Comparison */}
                    <div className="space-y-1 bg-slate-50 p-2 rounded-lg">
                      {/* Available Stock Bar */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 w-12 text-right shrink-0">Tồn kho</span>
                        <div className="flex-1 bg-slate-200 h-2.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              avail === 0 ? 'bg-red-400' : 'bg-slate-400'
                            }`}
                            style={{ width: `${availPercent}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-slate-600 w-8 text-right">
                          {avail}
                        </span>
                      </div>

                      {/* Forecast Demand Bar */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-blue-600 font-medium w-12 text-right shrink-0">Dự kiến</span>
                        <div className="flex-1 bg-blue-100 h-2.5 rounded-full overflow-hidden">
                          <div
                            className="bg-blue-600 h-full rounded-full transition-all duration-500"
                            style={{ width: `${predPercent}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-blue-700 font-semibold w-8 text-right">
                          {pred < 1 && pred > 0 ? '~0' : Math.round(pred)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* View 2: Timeline distribution for active product */
          <div className="space-y-4">
            <div className="p-3 bg-blue-50/60 border border-blue-100 rounded-lg flex items-start gap-2.5 text-xs text-blue-900">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                <strong>Ghi chú phân bổ:</strong> Mô hình LightGBM AI ước tính tổng sản lượng bán trong{' '}
                <strong>{selectedRun?.horizon_days || 7} ngày tới</strong> (khoảng{' '}
                <strong>
                  {activeProduct?.predictedQuantity < 1 && activeProduct?.predictedQuantity > 0
                    ? `dưới 1 sản phẩm (${activeProduct.predictedQuantity.toFixed(4)} sp)`
                    : `${activeProduct?.predictedQuantity.toFixed(2)} sản phẩm`}
                </strong>
                ). Giá trị các ngày thể hiện <strong>mức phân bổ trung bình ước tính</strong> (~
                {activeProduct?.dailyValues?.length
                  ? (activeProduct.predictedQuantity / activeProduct.dailyValues.length).toFixed(3)
                  : '0'}{' '}
                sp/ngày) để cửa hàng chủ động theo dõi tiến độ xuất nhập.
              </div>
            </div>

            {/* Daily Uniform Distribution Visualization */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 pb-1">
                <span>
                  Sản phẩm: <span className="text-blue-700">{activeProduct?.name}</span> ({activeProduct?.sku})
                </span>
                <span className="text-slate-500 text-[11px]">
                  Tồn hiện tại: <strong className="text-slate-900">{activeProduct?.availableQuantity ?? '—'} sp</strong>
                </span>
              </div>

              <div className="grid grid-cols-7 gap-2 pt-2">
                {(activeProduct?.dailyValues || []).map((dayItem, idx) => (
                  <div
                    key={dayItem.date}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-blue-300 hover:shadow-xs transition text-center space-y-1.5"
                  >
                    <div className="text-[10px] font-semibold text-slate-500 uppercase">
                      Ngày {idx + 1}
                    </div>
                    <div className="text-[11px] font-mono text-slate-700">
                      {dayItem.date.slice(5)}
                    </div>
                    <div className="py-2">
                      <div className="w-full bg-blue-100 h-10 rounded flex items-end justify-center overflow-hidden pb-1">
                        <div
                          className="w-4/5 bg-blue-600 rounded-t transition-all duration-300"
                          style={{ height: '70%' }}
                        />
                      </div>
                    </div>
                    <div className="text-xs font-bold text-blue-700">
                      {Number(dayItem.quantity) < 0.01
                        ? '< 0.01'
                        : Number(dayItem.quantity).toFixed(2)}
                      <span className="text-[10px] font-normal text-slate-400 block">sp (ước tính)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <span>
          💡 Dữ liệu được tính toán dựa trên các đơn hàng đã giao hoàn tất (Delivered Orders).
        </span>
        <button
          type="button"
          onClick={() => setViewMode(viewMode === 'comparison' ? 'timeline' : 'comparison')}
          className="text-blue-600 font-semibold hover:underline flex items-center gap-0.5"
        >
          <span>{viewMode === 'comparison' ? 'Xem chi tiết 7 ngày' : 'Quay lại so sánh'}</span>
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
