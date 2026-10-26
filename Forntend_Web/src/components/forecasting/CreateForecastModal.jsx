import React, { useState } from 'react';
import { X, Play, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

export const CreateForecastModal = ({
  isOpen,
  onClose,
  onSubmit,
  triggering = false,
  warehouses = [],
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Form states with friendly defaults
  const [modelType, setModelType] = useState('python'); // 'python' (AI) | 'baseline'
  const [horizonDays, setHorizonDays] = useState(7);
  const [lookbackDays, setLookbackDays] = useState(30);
  const [warehouseId, setWarehouseId] = useState('');
  const [formError, setFormError] = useState('');

  if (!isOpen) return null;

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setFormError('');

    const lookback = Number(lookbackDays);
    const horizon = Number(horizonDays);

    if (modelType === 'python') {
      if (lookback < 29) {
        setFormError('Mô hình AI yêu cầu lịch sử quan sát tối thiểu 29 ngày.');
        return;
      }
      if (horizon !== 7) {
        setFormError('Mô hình AI hiện tối ưu cho chu kỳ 7 ngày.');
        return;
      }
    } else {
      if (lookback < 7 || lookback > 365) {
        setFormError('Lịch sử quan sát phải từ 7 đến 365 ngày.');
        return;
      }
      if (horizon < 1 || horizon > 30) {
        setFormError('Chu kỳ dự báo phải từ 1 đến 30 ngày.');
        return;
      }
    }

    onSubmit({
      model: modelType,
      horizonDays: horizon,
      lookbackDays: lookback,
      warehouseId: warehouseId || undefined,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-3 sm:p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-forecast-title"
        className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden max-h-[calc(100dvh-1.5rem)]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <h3 id="create-forecast-title" className="text-base font-bold text-slate-900">Tạo dự báo mới</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ tạo dự báo"
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleFormSubmit} className="p-4 sm:p-5 space-y-4 text-sm overflow-y-auto">
          {formError && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {/* Preset Info */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
            <div className="font-semibold text-slate-800">Cấu hình tiêu chuẩn:</div>
            <div className="grid grid-cols-2 gap-2 text-slate-600">
              <div>Phương pháp: <span className="font-medium text-slate-900">{modelType === 'python' ? 'AI (LightGBM)' : 'Trung bình động'}</span></div>
              <div>Chu kỳ: <span className="font-medium text-slate-900">{horizonDays} ngày</span></div>
              <div>Lịch sử: <span className="font-medium text-slate-900">{lookbackDays} ngày</span></div>
              <div>Kho: <span className="font-medium text-slate-900">{warehouseId ? (warehouses.find(w => w.id === warehouseId)?.name || 'Kho riêng') : 'Toàn hệ thống'}</span></div>
            </div>
          </div>

          {/* Advanced Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1 transition"
            >
              <span>{showAdvanced ? 'Ẩn cài đặt nâng cao' : 'Cài đặt nâng cao'}</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Collapsible Advanced Form */}
          {showAdvanced && (
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Mô hình</label>
                <select
                  value={modelType}
                  onChange={(e) => {
                    const m = e.target.value;
                    setModelType(m);
                    if (m === 'python') {
                      setHorizonDays(7);
                      setLookbackDays((prev) => Math.max(29, Number(prev) || 30));
                    }
                  }}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="python">AI LightGBM (7 ngày)</option>
                  <option value="baseline">Baseline (Trung bình động)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Chu kỳ (ngày)</label>
                  <select
                    value={horizonDays}
                    onChange={(e) => setHorizonDays(Number(e.target.value))}
                    disabled={modelType === 'python'}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value={7}>7 ngày</option>
                    {modelType !== 'python' && (
                      <>
                        <option value={14}>14 ngày</option>
                        <option value={30}>30 ngày</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Lịch sử (ngày)</label>
                  <input
                    type="number"
                    min={modelType === 'python' ? 29 : 7}
                    max={365}
                    value={lookbackDays}
                    onChange={(e) => setLookbackDays(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Kho áp dụng</label>
                <select
                  value={warehouseId}
                  onChange={(e) => setWarehouseId(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Toàn hệ thống</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.code} - {wh.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={triggering}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-50 transition"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={triggering}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition flex items-center gap-1.5"
            >
              {triggering ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang tính toán...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Bắt đầu dự báo</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
