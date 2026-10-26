import React from 'react';
import { formatCurrency } from '../../utils/formatters';
import { Plus, Check } from 'lucide-react';

export const ProductCard = ({ product, inCartQuantity = 0, onSelect }) => {
  const available = Number(product.available_quantity ?? product.availableQuantity ?? 0);
  const isOutOfStock = available <= 0;
  const price = Number(product.sale_price ?? product.salePrice ?? product.price ?? 0);

  return (
    <button
      type="button"
      disabled={isOutOfStock}
      onClick={() => {
        if (!isOutOfStock) onSelect(product);
      }}
      className={`group min-h-44 flex flex-col justify-between p-4 rounded-lg border text-left transition select-none ${
        isOutOfStock
          ? 'bg-slate-50/60 border-slate-200 opacity-60 cursor-not-allowed'
          : 'bg-white border-slate-200 hover:border-blue-500 hover:shadow-2xs cursor-pointer active:scale-[0.99]'
      }`}
    >
      {/* Top Details */}
      <div>
        <div className="flex items-center justify-between gap-1.5 mb-1.5">
          <span className="font-mono text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
            {product.sku || 'SKU'}
          </span>

          <span
            className={`text-xs font-semibold px-2 py-0.5 rounded border ${
              isOutOfStock
                ? 'bg-red-50 text-red-700 border-red-200'
                : available <= 5
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            {isOutOfStock ? 'Hết hàng' : `Còn ${available}`}
          </span>
        </div>

        <h4 className="mt-2 text-sm font-semibold text-slate-900 line-clamp-2 leading-snug group-hover:text-blue-700 transition-colors">
          {product.name}
        </h4>
        {product.barcode && (
          <p className="text-xs text-slate-500 mt-1 font-mono truncate" title={product.barcode}>
            {product.barcode}
          </p>
        )}
      </div>

      {/* Price & Add */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-end justify-between gap-3">
        <div>
          <span className="text-xs text-slate-500 block">Đơn giá</span>
          <span className="text-base font-bold text-slate-900">
            {formatCurrency(price)}
          </span>
        </div>

        <div>
          {inCartQuantity > 0 ? (
            <div className="flex items-center gap-1.5 bg-blue-600 text-white px-2.5 py-1.5 rounded-md text-xs font-semibold shadow-2xs">
              <Check className="w-3 h-3" />
              <span>x{inCartQuantity}</span>
            </div>
          ) : (
            <div className="h-8 px-2.5 rounded-md bg-blue-50 border border-blue-200 group-hover:bg-blue-600 group-hover:border-blue-600 group-hover:text-white flex items-center justify-center gap-1 text-blue-700 text-xs font-semibold transition-colors">
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
};
