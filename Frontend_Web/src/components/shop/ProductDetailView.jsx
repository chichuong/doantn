import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ChevronDown,
  Minus,
  Package,
  Plus,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export const ProductDetailView = ({
  product,
  relatedProducts = [],
  cartQty = 0,
  onBack,
  onAddToCart,
  onSelectProduct,
  onGoToCart,
}) => {
  const stock = Number(product.available_quantity ?? product.available_stock ?? 0);
  const price = Number(product.sale_price ?? product.price ?? 0);
  const imgUrl = product.image_url || product.imageUrl;

  const [quantity, setQuantity] = useState(1);
  const [imgError, setImgError] = useState(false);
  const [openAccordion, setOpenAccordion] = useState(0);

  useEffect(() => {
    setQuantity(1);
    setImgError(false);
    setOpenAccordion(0);
  }, [product.id]);

  const maxAddable = Math.max(0, stock - cartQty);

  const handleAdd = () => {
    if (stock <= 0 || quantity <= 0) return;
    const nextQty = Math.min(stock, cartQty + quantity);
    onAddToCart(product.id, nextQty);
  };

  const accordions = [
    {
      title: 'Mô tả sản phẩm',
      content:
        product.description?.trim() ||
        'Sản phẩm được phân phối chính thức tại hệ thống Karat Retail. Tồn kho và giá bán được đồng bộ trực tiếp theo thời gian thực.',
    },
    {
      title: 'Thông tin chi tiết',
      content: (
        <dl className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs">
          <dt className="text-neutral-500">Mã SKU</dt>
          <dd className="font-mono text-neutral-900">{product.sku || '—'}</dd>
          <dt className="text-neutral-500">Mã vạch (Barcode)</dt>
          <dd className="font-mono text-neutral-900">{product.barcode || '—'}</dd>
          <dt className="text-neutral-500">Danh mục</dt>
          <dd className="text-neutral-900">{product.category_name || 'Chưa phân loại'}</dd>
          <dt className="text-neutral-500">Tình trạng kho</dt>
          <dd className="text-neutral-900">
            {stock > 0 ? `Còn ${stock} sản phẩm` : 'Tạm hết hàng'}
          </dd>
        </dl>
      ),
    },
    {
      title: 'Giao hàng & Đổi trả',
      content:
        'Hỗ trợ giao hàng tận nơi hoặc thanh toán khi nhận hàng (COD) và chuyển khoản VietQR. Đổi trả trong vòng 7 ngày nếu sản phẩm có lỗi từ nhà sản xuất.',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-10">
      {/* Breadcrumb & Back */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4">
        <nav className="text-xs text-neutral-500 flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="hover:text-neutral-900 transition-colors shrink-0"
          >
            Sản phẩm
          </button>
          {product.category_name && (
            <>
              <span>/</span>
              <span className="truncate max-w-[160px]">{product.category_name}</span>
            </>
          )}
          <span>/</span>
          <span className="text-neutral-900 font-medium truncate">{product.name}</span>
        </nav>

        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-700 hover:text-neutral-900 px-3 py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Quay lại danh sách</span>
        </button>
      </div>

      {/* Main 2-Column Product Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Left: Product Image */}
        <div className="lg:col-span-6">
          <div className="w-full aspect-square bg-neutral-50 border border-neutral-200 rounded-xl overflow-hidden flex items-center justify-center p-6">
            {imgUrl && !imgError ? (
              <img
                src={imgUrl}
                alt={product.name}
                className="w-full h-full object-contain"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-neutral-300">
                <Package className="w-16 h-16 stroke-[1.25]" />
                <span className="text-xs text-neutral-400">Chưa có hình ảnh</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Info & Purchase Panel */}
        <div className="lg:col-span-6 space-y-6">
          <div className="space-y-3 border-b border-neutral-200 pb-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-wider font-medium text-neutral-500">
                {product.category_name || 'Sản phẩm'} • SKU: {product.sku}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium border ${
                  stock > 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                }`}
              >
                {stock > 0 ? `Còn ${stock} sản phẩm` : 'Hết hàng'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-900 tracking-tight leading-snug">
              {product.name}
            </h1>

            <div className="text-2xl font-bold text-neutral-900 tabular-nums pt-1">
              {formatCurrency(price)}
            </div>
          </div>

          <p className="text-sm text-neutral-600 leading-relaxed">
            {product.description?.trim() ||
              'Sản phẩm chính hãng tại Karat Retail, đảm bảo chất lượng và cập nhật tồn kho trực tiếp từ hệ thống.'}
          </p>

          {/* Quantity & Add to Cart */}
          <div className="space-y-3 pt-1">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex items-center justify-between border border-neutral-300 rounded-lg px-2 py-1.5 w-full sm:w-36 bg-white">
                <button
                  type="button"
                  disabled={stock <= 0 || quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="p-1.5 text-neutral-600 hover:text-neutral-900 disabled:opacity-30"
                  aria-label="Giảm số lượng"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-sm font-semibold text-neutral-900 tabular-nums">
                  {stock > 0 ? quantity : 0}
                </span>
                <button
                  type="button"
                  disabled={stock <= 0 || quantity >= Math.max(1, maxAddable)}
                  onClick={() => setQuantity((q) => Math.min(Math.max(1, maxAddable), q + 1))}
                  className="p-1.5 text-neutral-600 hover:text-neutral-900 disabled:opacity-30"
                  aria-label="Tăng số lượng"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                disabled={stock <= 0 || maxAddable <= 0}
                onClick={handleAdd}
                className="flex-1 bg-neutral-900 hover:bg-neutral-800 text-white text-xs uppercase tracking-wider font-semibold py-3.5 px-6 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>
                  {stock <= 0
                    ? 'Tạm hết hàng'
                    : maxAddable <= 0
                    ? 'Đã đạt tối đa tồn kho trong giỏ'
                    : 'Thêm vào giỏ hàng'}
                </span>
              </button>
            </div>

            {cartQty > 0 && (
              <div className="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-neutral-50 border border-neutral-200 text-xs">
                <span className="text-neutral-700">
                  Hiện có <strong className="text-neutral-900">{cartQty}</strong> sản phẩm này trong giỏ hàng.
                </span>
                <button
                  type="button"
                  onClick={onGoToCart}
                  className="inline-flex items-center gap-1.5 font-semibold text-neutral-900 hover:underline"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  <span>Xem giỏ hàng</span>
                </button>
              </div>
            )}
          </div>

          {/* Trust Badges */}
          <div className="grid grid-cols-3 gap-3 py-4 border-y border-neutral-200 text-center">
            <div className="flex flex-col items-center gap-1.5 text-neutral-600">
              <Truck className="w-4 h-4 stroke-[1.5]" />
              <span className="text-[11px] font-medium">Giao hàng nhanh</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 text-neutral-600">
              <RotateCcw className="w-4 h-4 stroke-[1.5]" />
              <span className="text-[11px] font-medium">Đổi trả 7 ngày</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 text-neutral-600">
              <ShieldCheck className="w-4 h-4 stroke-[1.5]" />
              <span className="text-[11px] font-medium">Hàng chính hãng</span>
            </div>
          </div>

          {/* Accordion Details */}
          <div className="divide-y divide-neutral-200 border-b border-neutral-200">
            {accordions.map((item, idx) => {
              const isOpen = openAccordion === idx;
              return (
                <div key={item.title} className="py-3.5">
                  <button
                    type="button"
                    onClick={() => setOpenAccordion(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between text-left text-xs uppercase tracking-wider font-semibold text-neutral-900"
                  >
                    <span>{item.title}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-neutral-500 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="mt-3 text-xs text-neutral-600 leading-relaxed">
                      {item.content}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <section className="pt-6 border-t border-neutral-200 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-900">
            Sản phẩm liên quan
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {relatedProducts.map((rel) => {
              const relPrice = Number(rel.sale_price ?? rel.price ?? 0);
              const relImg = rel.image_url || rel.imageUrl;
              return (
                <button
                  key={rel.id}
                  type="button"
                  onClick={() => onSelectProduct(rel)}
                  className="group text-left bg-white border border-neutral-200 hover:border-neutral-400 rounded-xl p-3 transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="w-full aspect-square bg-neutral-50 rounded-lg overflow-hidden flex items-center justify-center mb-3 p-3">
                      {relImg ? (
                        <img
                          src={relImg}
                          alt={rel.name}
                          className="w-full h-full object-contain group-hover:scale-[1.03] transition-transform duration-300"
                        />
                      ) : (
                        <Package className="w-8 h-8 text-neutral-300" />
                      )}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-neutral-400 truncate">
                      {rel.category_name || rel.sku}
                    </div>
                    <div className="text-xs font-medium text-neutral-900 line-clamp-2 mt-0.5">
                      {rel.name}
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-neutral-900 tabular-nums mt-2">
                    {formatCurrency(relPrice)}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
