import React from 'react';
import { formatCurrency } from '../../utils/formatters';
import { Plus, Check, Package } from 'lucide-react';

export const ProductCard = ({ product, inCartQuantity = 0, onSelect }) => {
  const available = Number(product.available_quantity ?? product.availableQuantity ?? 0);
  const isOutOfStock = available <= 0;
  const price = Number(product.sale_price ?? product.salePrice ?? product.price ?? 0);
  const imgUrl = product.image_url || product.imageUrl;

  return (
    <button
      type="button"
      disabled={isOutOfStock}
      onClick={() => {
        if (!isOutOfStock) onSelect(product);
      }}
      className={`group flex flex-col justify-between p-3.5 rounded-2xl border text-left transition select-none ${
        isOutOfStock
          ? 'bg-slate-50/70 border-slate-200 opacity-60 cursor-not-allowed'
          : inCartQuantity > 0
            ? 'bg-[#fffdf7] border-[#d4af37] ring-1 ring-[#f7e08f] shadow-xs cursor-pointer active:scale-[0.99]'
            : 'bg-white border-slate-200 hover:border-[#d4af37] hover:shadow-xs cursor-pointer active:scale-[0.99]'
      }`}
    >
      <div>
        <div className="w-full h-24 mb-2.5 rounded-xl bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center">
          {imgUrl ? (
            <img
              src={imgUrl}
              alt={product.name}
              className="w-full h-full object-contain p-1.5 group-hover:scale-105 transition-transform"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <Package className="w-7 h-7 text-slate-300" />
          )}
        </div>

        <div className="flex items-center justify-between gap-1.5 mb-1">
          <span className="font-mono text-[10.5px] font-semibold text-[#926a09] bg-[#fdf8e6] px-2 py-0.5 rounded border border-[#f7e08f]">
            {product.sku || 'SKU'}
          </span>

          <span
            className={`text-[10.5px] font-semibold px-2 py-0.5 rounded-full border ${
              isOutOfStock
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : available <= 5
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            {isOutOfStock ? 'Hết hàng' : `Tồn ${available}`}
          </span>
        </div>

        <h4 className="mt-1.5 text-xs font-bold text-slate-900 line-clamp-2 leading-snug group-hover:text-[#926a09] transition-colors">
          {product.name}
        </h4>
      </div>

      <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-end justify-between gap-2">
        <div>
          <span className="text-[10.5px] text-slate-400 block">Đơn giá</span>
          <span className="text-sm font-extrabold text-slate-900 tabular-nums">
            {formatCurrency(price)}
          </span>
        </div>

        <div>
          {inCartQuantity > 0 ? (
            <div className="flex items-center gap-1 bg-[#b8860b] text-white px-2.5 py-1 rounded-lg text-xs font-bold shadow-2xs">
              <Check className="w-3 h-3" />
              <span>x{inCartQuantity}</span>
            </div>
          ) : (
            <div className="h-7 px-2.5 rounded-lg bg-slate-100 group-hover:bg-[#b8860b] group-hover:text-white flex items-center justify-center gap-1 text-slate-700 text-xs font-semibold transition-colors">
              <Plus className="w-3.5 h-3.5" />
              <span>Chọn</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
};
