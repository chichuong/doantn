import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { formatNumber } from '../../utils/formatters';

export const ModelTechSection = ({ selectedRun = null }) => {
  const [isOpen, setIsOpen] = useState(false);

  const metadata = selectedRun?.metadata || {};
  const isPython = selectedRun?.model_name?.includes('python') || metadata.model_id === 'karat-demand-forecast-v1';

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden text-xs">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-slate-50 transition"
      >
        <span className="font-semibold text-slate-700">Thông tin kỹ thuật & Đánh giá mô hình</span>
        <div className="flex items-center gap-1 text-slate-400">
          <span className="text-[11px]">{isOpen ? 'Thu gọn' : 'Xem thêm'}</span>
          {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-3">
          <div className="text-xs text-slate-700 bg-amber-50/80 p-2.5 rounded border border-amber-200/80 leading-relaxed">
            <strong>Lưu ý:</strong> Sai số mô hình chưa được đo trên dữ liệu vận hành thực tế của KARAT.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded bg-white border border-slate-200 space-y-1">
              <div className="text-slate-400 text-[11px]">Mô hình & Phiên bản</div>
              <div className="font-semibold text-slate-800">
                {isPython ? 'LightGBM L1 (v1.0.0)' : 'Baseline 7D'}
              </div>
              <div className="text-slate-500 text-[11px]">
                Mã: {metadata.model_id || (isPython ? 'karat-demand-forecast-v1' : 'baseline')}
              </div>
            </div>

            <div className="p-3 rounded bg-white border border-slate-200 space-y-1">
              <div className="text-slate-400 text-[11px]">Nguồn huấn luyện</div>
              <div className="font-semibold text-slate-800">
                {metadata.training_dataset || (isPython ? 'UCI Online Retail II' : 'PostgreSQL')}
              </div>
              <div className="text-slate-500 text-[11px]">
                Ngày: {metadata.created_at_utc ? metadata.created_at_utc.slice(0, 10) : '20/10/2026'}
              </div>
            </div>

            <div className="p-3 rounded bg-white border border-slate-200 space-y-1">
              <div className="text-slate-400 text-[11px]">Đánh giá tập kiểm thử UCI</div>
              <div className="font-semibold text-slate-800">
                {isPython ? 'MAE: 29.25 | RMSE: 101.39' : (selectedRun?.mae !== null ? `MAE: ${formatNumber(selectedRun?.mae)}` : 'Chưa có')}
              </div>
              <div className="text-slate-400 text-[10px]">
                Chỉ số đối soát trên test UCI
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-600 pt-1">
            Dự báo thể hiện lượng bán dự kiến và cần lịch sử bán hàng liên tục để đối soát.
          </div>
        </div>
      )}
    </div>
  );
};
