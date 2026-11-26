import React, { useState, useEffect, useCallback, useRef } from 'react';
import { usePos } from '../context/PosContext';
import { posApi } from '../api/posApi';
import { inventoryApi } from '../api/inventoryApi';
import { ProductCard } from '../components/pos/ProductCard';
import { CartItem } from '../components/pos/CartItem';
import { OpenShiftModal } from '../components/pos/OpenShiftModal';
import { CloseShiftModal } from '../components/pos/CloseShiftModal';
import { PaymentModal } from '../components/pos/PaymentModal';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { formatCurrency } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import {
  Search,
  Trash2,
  AlertCircle,
  Clock,
  Store,
  User,
  Receipt,
  ArrowRight,
  Lock,
} from 'lucide-react';

export const PosPage = () => {
  const { hasPermission } = useAuth();
  const canReadPosProducts = hasPermission('pos.products.read');
  const canReadManagerInventory = hasPermission('manager.inventory.read');
  const canCreateSale = hasPermission('pos.sales.create');
  const {
    currentSession,
    loadingSession,
    refreshSession,
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    customer,
    setCustomer,
    discountAmount,
    setDiscountAmount,
    subtotal,
    totalItems,
    finalTotal,
  } = usePos();

  const [products, setProducts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState('all'); // 'all' | 'in' | 'low' | 'out'
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null);

  const [isOpenShiftOpen, setIsOpenShiftOpen] = useState(false);
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  const searchInputRef = useRef(null);

  const showFeedback = (text, type = 'error') => {
    setFeedbackMessage({ text, type });
    setTimeout(() => setFeedbackMessage(null), 3500);
  };

  const loadWarehouseProducts = useCallback(async () => {
    if (!canReadPosProducts && !canReadManagerInventory) return;
    if (!currentSession?.warehouseId && !currentSession?.warehouse_id) return;
    const whId = currentSession.warehouseId || currentSession.warehouse_id;

    try {
      setLoadingProducts(true);
      const res = canReadPosProducts
        ? await posApi.listProducts({ warehouseId: whId, limit: 100 })
        : await inventoryApi.getInventory({ warehouseId: whId, limit: 100 });
      const items = res?.data || [];
      setProducts(
        items.map((item) => {
          const price = Number(item.sale_price ?? item.salePrice ?? item.price ?? 0);
          const qty = Number(item.quantity ?? 0);
          const reserved = Number(item.reserved_quantity ?? item.reservedQuantity ?? 0);
          const avail = Number(item.available_quantity ?? item.availableQuantity ?? qty - reserved);
          return {
            id: item.productId || item.product_id || item.id,
            name: item.productName || item.product_name || item.name,
            sku: item.sku,
            barcode: item.barcode,
            imageUrl: item.image_url || item.imageUrl || null,
            image_url: item.image_url || item.imageUrl || null,
            salePrice: price,
            sale_price: price,
            price: price,
            quantity: qty,
            reservedQuantity: reserved,
            availableQuantity: avail,
            available_quantity: avail,
          };
        })
      );
    } catch (err) {
      console.error('Không thể tải tồn kho sản phẩm:', err);
    } finally {
      setLoadingProducts(false);
    }
  }, [currentSession, canReadPosProducts, canReadManagerInventory]);

  useEffect(() => {
    if (currentSession) {
      loadWarehouseProducts();
    } else {
      setProducts([]);
    }
  }, [currentSession, loadWarehouseProducts]);

  const handleSkuSearch = useCallback(
    async (code) => {
      const cleanCode = code.trim();
      if (!cleanCode) return;

      if (!currentSession) {
        showFeedback('Vui lòng mở ca bán hàng trước khi tìm sản phẩm', 'error');
        setIsOpenShiftOpen(true);
        return;
      }

      const whId = currentSession.warehouseId || currentSession.warehouse_id;

      try {
        const res = await posApi.lookupProduct({
          identifier: cleanCode,
          warehouseId: whId,
        });

        const foundProduct = res?.data || res;
        if (foundProduct) {
          const unitPrice = Number(
            foundProduct.sale_price ?? foundProduct.salePrice ?? foundProduct.price ?? 0
          );
          const avail = Number(
            foundProduct.available_quantity ?? foundProduct.availableQuantity ?? 0
          );
          const productObj = {
            id: foundProduct.id || foundProduct.productId,
            name: foundProduct.name,
            sku: foundProduct.sku,
            salePrice: unitPrice,
            sale_price: unitPrice,
            price: unitPrice,
            availableQuantity: avail,
            available_quantity: avail,
          };

          const addRes = addToCart(productObj, 1);
          if (addRes.success) {
            showFeedback(`Đã thêm "${foundProduct.name}" vào hóa đơn`, 'success');
            setSearchQuery('');
          } else {
            showFeedback(addRes.message, 'error');
          }
        }
      } catch {
        const local = products.find(
          (p) =>
            p.sku?.toLowerCase() === cleanCode.toLowerCase() ||
            p.name?.toLowerCase().includes(cleanCode.toLowerCase())
        );

        if (local) {
          const addRes = addToCart(local, 1);
          if (addRes.success) {
            showFeedback(`Đã thêm "${local.name}" vào hóa đơn`, 'success');
            setSearchQuery('');
          } else {
            showFeedback(addRes.message, 'error');
          }
        } else {
          showFeedback(`Không tìm thấy sản phẩm mã "${cleanCode}" tại kho này`, 'error');
        }
      }
    },
    [currentSession, addToCart, products]
  );

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F2' && currentSession && cart.length > 0 && canCreateSale) {
        e.preventDefault();
        setIsPaymentOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSession, cart.length, canCreateSale]);

  const counts = {
    in: products.filter((p) => Number(p.availableQuantity ?? 0) > 5).length,
    low: products.filter((p) => {
      const a = Number(p.availableQuantity ?? 0);
      return a > 0 && a <= 5;
    }).length,
    out: products.filter((p) => Number(p.availableQuantity ?? 0) <= 0).length,
  };

  const filteredProducts = products.filter((p) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!p.name?.toLowerCase().includes(q) && !p.sku?.toLowerCase().includes(q)) {
        return false;
      }
    }
    const avail = Number(p.availableQuantity ?? 0);
    if (stockFilter === 'in') return avail > 5;
    if (stockFilter === 'low') return avail > 0 && avail <= 5;
    if (stockFilter === 'out') return avail <= 0;
    return true;
  });

  if (loadingSession) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-slate-500 text-sm">
        Đang đồng bộ phiên làm việc POS...
      </div>
    );
  }

  if (!currentSession) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-[#fdf8e6] border border-[#f7e08f] flex items-center justify-center text-[#b8860b] shadow-xs">
          <Clock className="w-8 h-8" />
        </div>
        <div className="max-w-sm space-y-1.5">
          <h2 className="text-lg font-extrabold text-slate-900">Chưa mở ca thu ngân POS</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Khai báo tiền mặt đầu ca để kích hoạt quầy bán lẻ trực tiếp và trừ kho tự động.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsOpenShiftOpen(true)}
          className="wm-btn wm-btn-primary !h-10 !px-5 shadow-md"
        >
          <Store className="w-4 h-4" />
          <span>Mở ca bán hàng ngay</span>
        </button>

        <OpenShiftModal
          isOpen={isOpenShiftOpen}
          onClose={() => setIsOpenShiftOpen(false)}
          onSuccess={refreshSession}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row h-full overflow-y-auto lg:overflow-hidden max-w-[1680px] w-full mx-auto p-3 sm:p-5 gap-4">
      {/* ============ LEFT PANE: Product Search, Stock Filter Bar & Catalogue ============ */}
      <section className="flex-1 min-h-[380px] lg:min-h-0 flex flex-col lg:overflow-hidden">
        {/* Search + Shift Close Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 mb-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-[#b8860b] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSkuSearch(searchQuery);
                }
              }}
              placeholder="Quét mã vạch, nhập SKU hoặc tên sản phẩm rồi nhấn Enter..."
              className="wm-field !h-10 w-full pl-10 pr-24 shadow-2xs"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#fdf8e6] text-[#926a09] border border-[#f7e08f]">
              Enter ↵
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsCloseShiftOpen(true)}
            className="wm-btn wm-btn-ghost !h-10 w-full sm:w-auto"
          >
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>Chốt & Đóng ca</span>
          </button>
        </div>

        {/* Stock Status Sub-Bar (modeled after pos-terminal.html .bq-sub-bar) */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-2 border-b border-slate-200/80 text-xs">
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Lọc theo tồn kho">
            {[
              { key: 'all', label: `Tất cả (${products.length})`, dot: 'bg-slate-400' },
              { key: 'in', label: `${counts.in} sẵn hàng`, dot: 'bg-emerald-500' },
              { key: 'low', label: `${counts.low} sắp hết`, dot: 'bg-amber-500' },
              { key: 'out', label: `${counts.out} hết hàng`, dot: 'bg-rose-500' },
            ].map((f) => {
              const active = stockFilter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setStockFilter(f.key)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
                    active
                      ? 'bg-[#0f172a] text-white border-[#0f172a]'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${f.dot}`} />
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>

          <span className="text-[11px] text-slate-500 font-medium">
            Điểm xuất:{' '}
            <strong className="text-slate-800">
              {currentSession.warehouseName || currentSession.warehouse_name || 'Kho quầy'}
            </strong>
          </span>
        </div>

        {feedbackMessage && (
          <div
            className={`mb-3 p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 transition ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border border-rose-200 text-rose-700'
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          {loadingProducts ? (
            <div className="py-20 text-center text-xs text-slate-400">
              Đang tải danh mục hàng hóa tại quầy...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-20 text-center text-xs text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
              Không tìm thấy sản phẩm phù hợp với bộ lọc
            </div>
          ) : (
            <div className="grid grid-cols-1 min-[460px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 pb-4">
              {filteredProducts.map((prod) => {
                const inCart = cart.find((i) => i.id === prod.id)?.quantity || 0;
                return (
                  <ProductCard
                    key={prod.id}
                    product={prod}
                    inCartQuantity={inCart}
                    onSelect={(selected) => {
                      const res = addToCart(selected, 1);
                      if (!res.success) {
                        showFeedback(res.message, 'error');
                      }
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ============ RIGHT PANE: Signature Serrated Thermal Paper Receipt (bq-paper) ============ */}
      <aside
        className="w-full lg:w-96 xl:w-[400px] shrink-0 bq-receipt-wrap flex flex-col max-h-full"
        aria-label="Hóa đơn hiện tại"
      >
        <div className="bq-paper flex flex-col max-h-full overflow-hidden">
          {/* Receipt Header */}
          <div className="px-5 pt-5 pb-3.5 border-b border-dashed border-slate-200 flex items-center gap-3 shrink-0">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f7d268] to-[#b8860b] text-[#0f172a] flex items-center justify-center shadow-xs shrink-0">
              <Store className="w-5 h-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-slate-900 tracking-tight truncate">
                Karat POS Store
              </p>
              <p className="text-[11px] text-slate-500">
                Phiếu bán lẻ <b className="font-mono text-[#926a09]">#POS-LIVE</b>
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold tabular-nums">
              {totalItems} món
            </span>
          </div>

          {/* Customer Quick Strip */}
          <div className="px-5 py-2.5 bg-slate-50/70 border-b border-slate-100 grid grid-cols-2 gap-2 shrink-0">
            <div className="relative">
              <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={customer.name}
                onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                placeholder="Khách lẻ tại quầy"
                className="w-full bg-white border border-slate-200 rounded-lg pl-7.5 pr-2 py-1.5 text-xs text-slate-900"
              />
            </div>
            <input
              type="text"
              value={customer.phone}
              onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
              placeholder="SĐT tích điểm..."
              className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-mono"
            />
          </div>

          {/* Receipt Lines */}
          <div className="px-4 py-3 overflow-y-auto space-y-2 min-h-[150px] max-h-[38vh]">
            {cart.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center space-y-2">
                <span className="w-11 h-11 rounded-2xl bg-[#fdf8e6] border border-[#f7e08f] text-[#b8860b] flex items-center justify-center">
                  <Receipt className="w-5 h-5" />
                </span>
                <p className="text-xs font-bold text-slate-800">Hóa đơn mới sẵn sàng</p>
                <p className="text-[11px] text-slate-400 max-w-[230px]">
                  Chọn mặt hàng bên trái hoặc quét mã SKU để thêm vào phiếu thu ngân
                </p>
                <div className="flex items-center gap-2 pt-1 text-[10px] text-slate-500">
                  <span className="px-2 py-0.5 rounded bg-slate-100 font-mono font-semibold">F2 Thanh toán</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 font-mono font-semibold">Enter Quét mã</span>
                </div>
              </div>
            ) : (
              cart.map((item) => (
                <CartItem
                  key={item.id}
                  item={item}
                  onUpdateQuantity={(id, qty) => {
                    const res = updateQuantity(id, qty);
                    if (!res.success) {
                      showFeedback(res.message, 'error');
                    }
                  }}
                  onRemove={removeFromCart}
                />
              ))
            )}
          </div>

          {/* Receipt Summary & Charge Action */}
          <div className="px-5 pt-3 pb-4 border-t border-dashed border-slate-200 bg-slate-50/40 space-y-2.5 shrink-0">
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-500">
                <span>Tạm tính</span>
                <span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(subtotal)}</span>
              </div>

              <div className="flex items-center justify-between text-slate-500">
                <span>Chiết khấu trực tiếp</span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Number(e.target.value))}
                    className="w-24 text-right bg-white border border-slate-200 rounded-md px-2 py-0.5 text-xs font-semibold text-slate-900 tabular-nums"
                  />
                  <span className="text-slate-400">₫</span>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/80 flex items-baseline justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Khách cần trả
              </span>
              <strong className="text-xl font-extrabold text-slate-900 tabular-nums">
                {formatCurrency(finalTotal)}
              </strong>
            </div>

            {/* Action Row */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={cart.length === 0}
                onClick={clearCart}
                title="Xóa toàn bộ giỏ"
                aria-label="Xóa toàn bộ giỏ hàng"
                className="w-10 h-10 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-slate-500 hover:text-rose-600 flex items-center justify-center transition disabled:opacity-40 shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                disabled={cart.length === 0 || !canCreateSale}
                onClick={() => canCreateSale && setIsPaymentOpen(true)}
                className="flex-1 h-10 px-4 rounded-xl wm-btn-primary font-bold text-xs flex items-center justify-between shadow-sm disabled:opacity-40 active:scale-[0.99] transition"
              >
                <span>Thanh toán (F2)</span>
                <span className="inline-flex items-center gap-1.5 font-mono">
                  <span>{formatCurrency(finalTotal)}</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              </button>
            </div>

            <p className="text-center text-[10px] text-slate-400 font-mono pt-1 tracking-wide">
              ||| || |||| ||| · CẢM ƠN QUÝ KHÁCH
            </p>
          </div>
        </div>
      </aside>

      <CloseShiftModal
        isOpen={isCloseShiftOpen}
        onClose={() => setIsCloseShiftOpen(false)}
        session={currentSession}
        onSuccess={() => {
          clearCart();
          refreshSession();
        }}
      />

      {canCreateSale && (
        <PaymentModal
          isOpen={isPaymentOpen}
          onClose={() => setIsPaymentOpen(false)}
          session={currentSession}
          cart={cart}
          subtotal={subtotal}
          discountAmount={discountAmount}
          finalTotal={finalTotal}
          customer={customer}
          onSuccess={(completedSaleData) => {
            clearCart();
            setReceiptData(completedSaleData);
            loadWarehouseProducts();
          }}
        />
      )}

      <ReceiptModal
        isOpen={!!receiptData}
        onClose={() => setReceiptData(null)}
        saleData={receiptData}
        onNewOrder={() => {
          clearCart();
          setReceiptData(null);
        }}
      />
    </div>
  );
};
