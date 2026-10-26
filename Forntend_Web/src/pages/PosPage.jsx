import React, { useState, useEffect, useCallback, useRef } from 'react';
import { usePos } from '../context/PosContext';
import { posApi } from '../api/posApi';
import { inventoryApi } from '../api/inventoryApi';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { ProductCard } from '../components/pos/ProductCard';
import { CartItem } from '../components/pos/CartItem';
import { OpenShiftModal } from '../components/pos/OpenShiftModal';
import { CloseShiftModal } from '../components/pos/CloseShiftModal';
import { PaymentModal } from '../components/pos/PaymentModal';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { formatCurrency } from '../utils/formatters';
import { useAuth } from '../context/AuthContext';
import {
  ScanBarcode,
  ShoppingCart,
  Trash2,
  CreditCard,
  AlertCircle,
  Clock,
  Store,
  User,
} from 'lucide-react';

export const PosPage = () => {
  const { hasPermission } = useAuth();
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
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState(null); // { type: 'success' | 'error', text }

  // Modals
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
    if (!canReadManagerInventory) return;
    if (!currentSession?.warehouseId && !currentSession?.warehouse_id) return;
    const whId = currentSession.warehouseId || currentSession.warehouse_id;

    try {
      setLoadingProducts(true);
      const res = await inventoryApi.getInventory({ warehouseId: whId, limit: 100 });
      const items = res?.data || [];
      setProducts(
        items.map((item) => ({
          id: item.productId || item.product_id || item.id,
          name: item.productName || item.product_name || item.name,
          sku: item.sku,
          barcode: item.barcode,
          salePrice: item.salePrice || item.sale_price || item.price || 0,
          quantity: item.quantity,
          reservedQuantity: item.reservedQuantity || item.reserved_quantity || 0,
          availableQuantity: item.availableQuantity ?? item.available_quantity ?? (item.quantity - (item.reserved_quantity || 0)),
        }))
      );
    } catch (err) {
      console.error('Không thể tải tồn kho sản phẩm:', err);
    } finally {
      setLoadingProducts(false);
    }
  }, [currentSession, canReadManagerInventory]);

  useEffect(() => {
    if (currentSession) {
      loadWarehouseProducts();
    } else {
      setProducts([]);
    }
  }, [currentSession, loadWarehouseProducts]);

  const handleBarcodeScanned = useCallback(
    async (code) => {
      const cleanCode = code.trim();
      if (!cleanCode) return;

      if (!currentSession) {
        showFeedback('Vui lòng mở ca bán hàng trước khi quét sản phẩm', 'error');
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
          const productObj = {
            id: foundProduct.id || foundProduct.productId,
            name: foundProduct.name,
            sku: foundProduct.sku,
            barcode: foundProduct.barcode,
            salePrice: foundProduct.salePrice || foundProduct.sale_price || foundProduct.price,
            availableQuantity: foundProduct.availableQuantity ?? foundProduct.available_quantity,
          };

          const addRes = addToCart(productObj, 1);
          if (addRes.success) {
            showFeedback(`Đã thêm "${foundProduct.name}" vào giỏ`, 'success');
            setSearchQuery('');
          } else {
            showFeedback(addRes.message, 'error');
          }
        }
      } catch (err) {
        const local = products.find(
          (p) =>
            p.sku?.toLowerCase() === cleanCode.toLowerCase() ||
            p.barcode === cleanCode ||
            p.name?.toLowerCase().includes(cleanCode.toLowerCase())
        );

        if (local) {
          const addRes = addToCart(local, 1);
          if (addRes.success) {
            showFeedback(`Đã thêm "${local.name}" vào giỏ`, 'success');
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

  useBarcodeScanner(handleBarcodeScanned, !!currentSession);

  const filteredProducts = products.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.barcode?.includes(q)
    );
  });

  if (loadingSession) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-slate-500 text-sm">
        Đang đồng bộ phiên làm việc POS...
      </div>
    );
  }

  // NẾU CHƯA MỞ CA: Bắt buộc mở ca
  if (!currentSession) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 bg-[#f8fafc]">
        <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-2xs">
          <Clock className="w-7 h-7 text-blue-600" />
        </div>
        <div className="max-w-sm space-y-1">
          <h2 className="text-base font-bold text-slate-900">Chưa có ca bán hàng</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Vui lòng mở ca bán hàng để bắt đầu thực hiện giao dịch tại quầy.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsOpenShiftOpen(true)}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-2xs flex items-center gap-2 transition"
        >
          <Store className="w-4 h-4" />
          <span>Mở ca bán hàng</span>
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
    <div className="flex-1 min-h-0 flex flex-col lg:flex-row lg:h-[calc(100dvh-4rem)] overflow-y-auto lg:overflow-hidden bg-slate-50">
      {/* KHỐI TRÁI: Tìm kiếm, quét Barcode và lưới sản phẩm */}
      <div className="flex-1 min-h-[32rem] lg:min-h-0 flex flex-col p-4 sm:p-5 lg:p-6 overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-200 bg-[#f8fafc]">
        {/* Search Bar & Barcode Scanner */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mb-5">
          <div className="relative flex-1 w-full">
            <ScanBarcode className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              data-barcode-input="true"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleBarcodeScanned(searchQuery);
                }
              }}
              placeholder="Quét mã vạch hoặc nhập SKU, tên sản phẩm..."
              className="w-full bg-white border border-slate-300 rounded-lg pl-10 pr-24 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition shadow-2xs"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200">
              Enter ↵
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsCloseShiftOpen(true)}
            className="w-full sm:w-auto px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition shadow-2xs flex items-center justify-center gap-1.5 shrink-0"
          >
            <span>Đóng ca POS</span>
          </button>
        </div>

        {/* Feedback message */}
        {feedbackMessage && (
          <div
            className={`mb-3 p-2.5 rounded-lg text-xs font-medium flex items-center gap-2 transition ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{feedbackMessage.text}</span>
          </div>
        )}

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          <div className="flex items-center justify-between mb-2.5 text-xs text-slate-500 font-medium">
            <span>
              Sản phẩm tại{' '}
              <strong className="text-slate-800">
                {currentSession.warehouseName || currentSession.warehouse_name || 'Kho quầy'}
              </strong>{' '}
              ({filteredProducts.length} mặt hàng)
            </span>
          </div>

          {loadingProducts ? (
            <div className="py-20 text-center text-xs text-slate-400">
              Đang tải danh mục tồn kho...
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-20 text-center text-xs text-slate-400">
              Không tìm thấy sản phẩm nào phù hợp
            </div>
          ) : (
            <div className="grid grid-cols-1 min-[460px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5 pb-6">
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
      </div>

      {/* KHỐI PHẢI: Giỏ hàng & Thanh toán */}
      <div className="w-full lg:w-96 xl:w-[400px] min-h-[30rem] lg:min-h-0 bg-white flex flex-col justify-between p-4 sm:p-5 overflow-hidden lg:border-l border-slate-200">
        {/* Giỏ hàng Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900">
                Giỏ hàng
              </h3>
              <span className="text-[11px] text-slate-500">
                {totalItems} mặt hàng
              </span>
            </div>
          </div>

          {cart.length > 0 && (
            <button
              type="button"
              onClick={clearCart}
              className="text-slate-400 hover:text-red-600 text-xs font-medium flex items-center gap-1 transition"
              title="Xóa giỏ hàng"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa giỏ</span>
            </button>
          )}
        </div>

        {/* Danh sách món hàng trong giỏ */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-1.5">
              <ShoppingCart className="w-10 h-10 stroke-[1.2] opacity-30 text-slate-400" />
              <p className="text-xs font-medium text-slate-500">Giỏ hàng trống</p>
              <p className="text-[11px] text-slate-400">
                Quét mã vạch hoặc chọn sản phẩm
              </p>
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

        {/* Tổng kết tiền & Nút thanh toán */}
        <div className="pt-3 border-t border-slate-100 space-y-3">
          {/* Thông tin khách hàng nhanh */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={customer.name}
                onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                placeholder="Tên khách hàng"
                className="w-full bg-slate-50 border border-slate-200 rounded-md pl-7 pr-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>
            <div className="relative flex-1">
              <input
                type="text"
                value={customer.phone}
                onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                placeholder="Số điện thoại"
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
            </div>
          </div>

          {/* Chiết khấu */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Tạm tính:</span>
            <span className="font-semibold text-slate-900">{formatCurrency(subtotal)}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Chiết khấu / Giảm giá:</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                step="1000"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(Number(e.target.value))}
                className="w-20 text-right bg-slate-50 border border-slate-200 rounded-md px-2 py-0.5 text-xs text-slate-900 focus:outline-none focus:border-blue-600 focus:bg-white"
              />
              <span className="text-slate-400">₫</span>
            </div>
          </div>

          {/* Tổng tiền cần trả */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Tổng cộng
              </span>
              <span className="text-lg font-bold text-slate-900">
                {formatCurrency(finalTotal)}
              </span>
            </div>

            <button
              type="button"
              disabled={cart.length === 0 || !canCreateSale}
              onClick={() => canCreateSale && setIsPaymentOpen(true)}
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-2xs flex items-center gap-1.5 transition disabled:opacity-40 active:scale-95"
            >
              <CreditCard className="w-4 h-4" />
              <span>Thanh toán (F2)</span>
            </button>
          </div>
        </div>
      </div>

      {/* CÁC MODAL HỖ TRỢ */}
      <CloseShiftModal
        isOpen={isCloseShiftOpen}
        onClose={() => setIsCloseShiftOpen(false)}
        session={currentSession}
        onSuccess={() => {
          clearCart();
          refreshSession();
        }}
      />

      {canCreateSale && <PaymentModal
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
      />}

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
