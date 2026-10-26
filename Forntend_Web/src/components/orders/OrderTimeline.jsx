import React from 'react';
import { ORDER_TIMELINE_STEPS } from '../../utils/stateMachine';
import { ORDER_STATUS_META } from '../../utils/formatters';
import {
  CheckCircle2,
  Clock,
  Package,
  Truck,
  CheckCheck,
  XCircle,
  RotateCcw,
} from 'lucide-react';

export const OrderTimeline = ({ currentStatus, statusHistory = [] }) => {
  const isCancelled = currentStatus === 'cancelled';
  const isReturned = currentStatus === 'returned';

  const currentStepIdx = ORDER_TIMELINE_STEPS.findIndex(
    (step) => step.key === currentStatus
  );

  const stepIcons = {
    pending: Clock,
    confirmed: CheckCircle2,
    ready_to_pack: Package,
    packed: Package,
    handover: Truck,
    shipping: Truck,
    delivered: CheckCheck,
  };

  return (
    <div className="space-y-5">
      {/* Visual Stepper Bar */}
      <div className="relative pt-2 pb-1 overflow-x-auto">
        {/* Connecting Line */}
        <div className="absolute top-6 left-6 right-6 h-0.5 bg-slate-200 -z-0" />

        <div className="grid grid-cols-7 gap-1 relative z-10 min-w-[620px]">
          {ORDER_TIMELINE_STEPS.map((step, idx) => {
            const Icon = stepIcons[step.key] || CheckCircle2;
            const isCompleted = !isCancelled && !isReturned && idx < currentStepIdx;
            const isCurrent = !isCancelled && !isReturned && idx === currentStepIdx;

            return (
              <div key={step.key} className="flex flex-col items-center text-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition shadow-2xs ${
                    isCurrent
                      ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white border border-slate-300 text-slate-400'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span
                  className={`text-[11px] font-medium mt-1.5 leading-tight ${
                    isCurrent
                      ? 'text-blue-700 font-bold'
                      : isCompleted
                      ? 'text-slate-700'
                      : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Exception Alert for Cancelled or Returned */}
      {(isCancelled || isReturned) && (
        <div
          className={`p-3 rounded-lg border flex items-center gap-2.5 text-xs font-medium ${
            isCancelled
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-orange-50 border-orange-200 text-orange-700'
          }`}
        >
          {isCancelled ? (
            <XCircle className="w-4 h-4 shrink-0 text-red-600" />
          ) : (
            <RotateCcw className="w-4 h-4 shrink-0 text-orange-600" />
          )}
          <div>
            <span>Đơn hàng kết thúc ở trạng thái: </span>
            <strong className="uppercase font-semibold">
              {ORDER_STATUS_META[currentStatus]?.label || currentStatus}
            </strong>
            <p className="text-[11px] font-normal opacity-90 mt-0.5">
              {isCancelled
                ? 'Đơn đã hủy và toàn bộ tồn kho đang giữ đã được hoàn trả.'
                : 'Đơn hàng được ghi nhận hoàn trả về kho và tạo chứng từ hoàn hàng.'}
            </p>
          </div>
        </div>
      )}

      {/* Lịch sử trạng thái */}
      {statusHistory.length > 0 && (
        <div className="pt-2">
          <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
            Lịch sử chuyển đổi trạng thái
          </h4>
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {statusHistory.map((hist, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                  <span className="text-slate-600">
                    <strong className="text-slate-700">
                      {ORDER_STATUS_META[hist.from_status || hist.fromStatus]?.label || hist.from_status || 'Khởi tạo'}
                    </strong>{' '}
                    →{' '}
                    <strong className="text-slate-900">
                      {ORDER_STATUS_META[hist.to_status || hist.toStatus]?.label || hist.to_status}
                    </strong>
                  </span>
                  {hist.note && (
                    <span className="text-slate-400 italic">"{hist.note}"</span>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {hist.created_at || hist.createdAt}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
