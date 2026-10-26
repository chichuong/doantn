import React, { useState } from 'react';
import { STATE_TRANSITION_ACTIONS } from '../../utils/stateMachine';
import { orderApi } from '../../api/orderApi';
import { useAuth } from '../../context/AuthContext';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  AlertTriangle,
  Lock,
} from 'lucide-react';

export const StateActions = ({ order, onRefresh }) => {
  const { hasPermission, hasAllPermissions } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [modalAction, setModalAction] = useState(null);
  const [reasonInput, setReasonInput] = useState('');
  const [trackingNumberInput, setTrackingNumberInput] = useState('');

  if (!order) return null;

  const currentStatus = order.status;
  const requiredPermission = {
    confirmed: () => hasPermission('order_processing.orders.confirm'),
    ready_to_pack: () => hasPermission('order_processing.tasks.update'),
    packed: () => hasPermission('warehouse.orders.pack'),
    handover: () => hasAllPermissions('shipping.shipments.create', 'shipping.shipments.assign'),
    cancelled: () => hasPermission('manager.orders.cancel'),
    returned: () => hasPermission('warehouse.orders.returns'),
  };
  const allowedActions = (STATE_TRANSITION_ACTIONS[currentStatus] || [])
    .filter((action) => requiredPermission[action.targetStatus]?.() === true);

  const handleActionClick = (action) => {
    setError('');
    if (action.requireReason || action.requiresTracking) {
      setModalAction(action);
      setReasonInput('');
      setTrackingNumberInput(`TRK-${Date.now().toString().slice(-6)}`);
      return;
    }
    executeTransition(action);
  };

  const executeTransition = async (action, note = '', tracking = '') => {
    try {
      setLoading(true);
      setError('');

      if (action.targetStatus === 'confirmed') {
        await orderApi.confirmOrder(order.id, { note: note || 'Quản lý xác nhận đơn' });
      } else if (action.targetStatus === 'ready_to_pack') {
        await orderApi.updateTask(order.id, {
          status: 'ready_to_pack',
          note: note || 'Đã kiểm tra & sẵn sàng đóng gói',
        });
      } else if (action.targetStatus === 'packed') {
        await orderApi.packOrder(order.id, {
          warehouseId: order.warehouse_id || order.warehouseId,
        });
      } else if (action.targetStatus === 'handover') {
        await orderApi.createShipment({
          orderId: order.id,
          trackingNumber: tracking || `TRK-${Date.now()}`,
          carrier: 'Internal Delivery',
          note: note || 'Bàn giao cho đơn vị vận chuyển',
        });
      } else if (action.targetStatus === 'cancelled') {
        await orderApi.cancelOrder(order.id, {
          reason: note || 'Quản lý hủy đơn theo yêu cầu',
        });
      } else if (action.targetStatus === 'returned') {
        await orderApi.returnOrder(order.id, {
          reason: note || 'Khách hoàn trả đơn hàng',
        });
      }

      setModalAction(null);
      onRefresh();
    } catch (err) {
      setError(err.message || 'Chuyển trạng thái không thành công. Vui lòng kiểm tra lại quy trình.');
    } finally {
      setLoading(false);
    }
  };

  if (allowedActions.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
        <Lock className="w-3.5 h-3.5 text-slate-400" />
        <span>
          Đơn hàng đang ở trạng thái cuối (<strong>{currentStatus}</strong>). Không có thao tác chuyển trạng thái tiếp theo.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {error && (
        <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 mr-1 uppercase tracking-wider">
          Thao tác xử lý:
        </span>
        {allowedActions.map((action, idx) => {
          const isDanger = action.variant === 'danger';
          const isWarning = action.variant === 'warning';
          const isPrimary = action.variant === 'primary';

          let btnClass = 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50';
          if (isPrimary) {
            btnClass =
              'bg-blue-600 text-white border-blue-600 shadow-2xs hover:bg-blue-700';
          } else if (isDanger) {
            btnClass =
              'bg-white text-red-700 border-red-300 hover:bg-red-50';
          } else if (isWarning) {
            btnClass =
              'bg-white text-amber-700 border-amber-300 hover:bg-amber-50';
          }

          return (
            <button
              key={idx}
              type="button"
              disabled={loading}
              onClick={() => handleActionClick(action)}
              className={`px-3 py-1.5 rounded-md border text-xs font-semibold transition flex items-center gap-1.5 disabled:opacity-50 ${btnClass}`}
            >
              {isDanger ? (
                <XCircle className="w-3.5 h-3.5" />
              ) : isWarning ? (
                <RotateCcw className="w-3.5 h-3.5" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>

      {/* Modal xác nhận lý do hoặc mã vận đơn */}
      {modalAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-2xs">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-xl p-5 space-y-3.5 shadow-xl">
            <h4 className="text-sm font-bold text-slate-900">
              {modalAction.label}
            </h4>
            <p className="text-xs text-slate-500">
              {modalAction.description}
            </p>

            {modalAction.requiresTracking && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mã vận đơn (Tracking Number)
                </label>
                <input
                  type="text"
                  value={trackingNumberInput}
                  onChange={(e) => setTrackingNumberInput(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ghi chú / Lý do thực hiện
              </label>
              <textarea
                rows="2"
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder="Nhập lý do thao tác này..."
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                required={modalAction.requireReason}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalAction(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={loading || (modalAction.requireReason && !reasonInput.trim())}
                onClick={() =>
                  executeTransition(modalAction, reasonInput, trackingNumberInput)
                }
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-2xs transition disabled:opacity-50"
              >
                {loading ? 'Đang thực hiện...' : 'Xác nhận ngay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
