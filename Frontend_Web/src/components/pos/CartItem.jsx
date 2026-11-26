import React from 'react';
import { formatCurrency } from '../../utils/formatters';
import { Plus, Minus, Trash2, AlertTriangle } from 'lucide-react';

export const CartItem = ({ item, onUpdateQuantity, onRemove }) => {
  const isMaxStock = item.quantity >= item.availableQuantity;

  const handleManualQuantityChange = (e) => {
    const val = parseInt(e.target.value, 10);
    if (isNaN(val)) return;
    onUpdateQuantity(item.id, val);
  };

  return (
    <div className="p-2.5 rounded-xl bg-white border border-slate-200/90 hover:border-[#e6bf4d] transition space-y-2">
      <div className="flex items-start justify-between gap-2">
        {(item.imageUrl || item.image_url) && (
          <img
            src={item.imageUrl || item.image_url}
            alt={item.name}
            className="w-9 h-9 rounded-lg object-contain bg-slate-50 border border-slate-200 p-0.5 shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-slate-900 truncate" title={item.name}>
            {item.name}
          </h4>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
            <span className="font-mono text-[#926a09] font-semibold">
              {item.sku || 'N/A'}
            </span>
            <span>·</span>
            <span className="tabular-nums">{formatCurrency(item.price)}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition"
          title="Xóa khỏi giỏ"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {isMaxStock && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
          <AlertTriangle className="w-3 h-3 shrink-0 text-amber-600" />
          <span>Chạm trần tồn khả dụng ({item.availableQuantity} SP)</span>
        </div>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
        <div className="flex items-center gap-1 bg-slate-50 p-0.5 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
            className="w-6 h-6 rounded-md flex items-center justify-center bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition"
          >
            <Minus className="w-2.5 h-2.5" />
          </button>

          <input
            type="number"
            min="1"
            max={item.availableQuantity}
            value={item.quantity}
            onChange={handleManualQuantityChange}
            className="w-9 text-center bg-transparent text-xs font-bold text-slate-900 focus:outline-none focus:shadow-none border-none tabular-nums"
          />

          <button
            type="button"
            disabled={isMaxStock}
            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
            className="w-6 h-6 rounded-md flex items-center justify-center bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition disabled:opacity-40"
            title={isMaxStock ? 'Hết tồn khả dụng' : 'Tăng số lượng'}
          >
            <Plus className="w-2.5 h-2.5" />
          </button>
        </div>

        <span className="text-xs font-extrabold text-slate-900 tabular-nums">
          {formatCurrency(item.subtotal)}
        </span>
      </div>
    </div>
  );
};
