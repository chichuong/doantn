import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag,
  ShoppingCart,
  ClipboardList,
  MapPin,
  Search,
  Plus,
  Minus,
  Trash2,
  RefreshCw,
  Eye,
  Package,
} from 'lucide-react';
import { customerApi } from '../api/customerApi';
import { formatCurrency, formatDate } from '../utils/formatters';
import { Modal } from '../components/common/Modal';
import { OrderTimeline } from '../components/orders/OrderTimeline';
import { ProductDetailView } from '../components/shop/ProductDetailView';
import { useAuth } from '../context/AuthContext';

const ORDER_TABS = [
  { label: 'Tất cả', status: '' },
  { label: 'Chờ XN', status: 'pending' },
  { label: 'Đang xử lý', status: 'confirmed' },
  { label: 'Đang giao', status: 'shipping' },
  { label: 'Đã giao', status: 'delivered' },
  { label: 'Đã hủy', status: 'cancelled' },
];

const ORDER_STATUS_LABELS = {
  pending: { label: 'Chờ xác nhận', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  confirmed: { label: 'Đã xác nhận', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  ready_to_pack: { label: 'Chờ đóng gói', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  packed: { label: 'Đã đóng gói', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  handover: { label: 'Đã bàn giao vận chuyển', cls: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  shipping: { label: 'Đang giao hàng', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  delivered: { label: 'Đã giao thành công', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Đã hủy', cls: 'bg-red-50 text-red-700 border-red-200' },
  returned: { label: 'Hoàn trả', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export const ShopPage = () => {
  const { user } = useAuth();

  // 4 phân mục đồng bộ với ứng dụng Flutter Mobile: 'catalog' | 'cart' | 'orders' | 'profile'
  const [activeTab, setActiveTab] = useState('catalog');
  const [selectedProduct, setSelectedProduct] = useState(null);

  // Catalog state
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // Cart state
  const [cartItems, setCartItems] = useState([]);
  const [cartSubtotal, setCartSubtotal] = useState(0);
  const [loadingCart, setLoadingCart] = useState(false);

  // Addresses & Checkout state
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cod'); // 'cod' | 'transfer'
  const [orderNote, setOrderNote] = useState('');
  const [placingOrder, setPlacingOrder] = useState(false);

  // Add Address Modal
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [addressForm, setAddressForm] = useState({
    recipientName: '',
    phone: '',
    addressLine: '',
    ward: '',
    district: '',
    province: '',
    isDefault: true,
  });
  const [savingAddress, setSavingAddress] = useState(false);

  // Orders state
  const [orders, setOrders] = useState([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState('');
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isOrderDetailOpen, setIsOrderDetailOpen] = useState(false);

  // Alerts
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const showToast = (msg, isErr = false) => {
    if (isErr) {
      setError(msg);
      setTimeout(() => setError(''), 4000);
    } else {
      setSuccess(msg);
      setTimeout(() => setSuccess(''), 3500);
    }
  };

  // Load Catalog
  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    try {
      const params = { page: 1, limit: 40 };
      if (search.trim()) params.search = search.trim();
      if (categoryId) params.categoryId = categoryId;
      const res = await customerApi.getCatalog(params);
      setProducts(res?.data || []);
    } catch (err) {
      showToast(err.message || 'Không tải được danh mục sản phẩm.', true);
    } finally {
      setLoadingCatalog(false);
    }
  }, [search, categoryId]);

  const loadCategories = useCallback(async () => {
    try {
      const res = await customerApi.getCategories({ limit: 100 });
      setCategories(res?.data || []);
    } catch {
      // ignore
    }
  }, []);

  // Load Cart
  const loadCart = useCallback(async () => {
    setLoadingCart(true);
    try {
      const res = await customerApi.getCart();
      const data = res?.data || res;
      const items = data?.items || [];
      setCartItems(items);
      const total = items.reduce(
        (sum, item) => sum + Number(item.sale_price || item.unit_price || 0) * Number(item.quantity || 0),
        0
      );
      setCartSubtotal(Number(data?.subtotal ?? total));
    } catch {
      setCartItems([]);
      setCartSubtotal(0);
    } finally {
      setLoadingCart(false);
    }
  }, []);

  // Load Addresses
  const loadAddresses = useCallback(async () => {
    try {
      const res = await customerApi.getAddresses();
      const list = res?.data || res || [];
      setAddresses(Array.isArray(list) ? list : []);
      if (Array.isArray(list) && list.length > 0) {
        const def = list.find((a) => a.is_default) || list[0];
        setSelectedAddressId((prev) => prev || def.id);
      }
    } catch {
      setAddresses([]);
    }
  }, []);

  // Load Orders
  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const params = { page: 1, limit: 30 };
      if (orderStatusFilter) params.status = orderStatusFilter;
      const res = await customerApi.getOrders(params);
      setOrders(res?.data || []);
    } catch (err) {
      showToast(err.message || 'Không tải được đơn hàng.', true);
    } finally {
      setLoadingOrders(false);
    }
  }, [orderStatusFilter]);

  useEffect(() => {
    loadCategories();
    loadCart();
    loadAddresses();
  }, [loadCategories, loadCart, loadAddresses]);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (activeTab === 'orders') {
      loadOrders();
    }
  }, [activeTab, loadOrders]);

  const getCartQty = (productId) => {
    const found = cartItems.find((i) => i.product_id === productId);
    return found ? Number(found.quantity || 0) : 0;
  };

  const handleUpdateCartQty = async (productId, nextQty) => {
    try {
      if (nextQty <= 0) {
        await customerApi.removeCartItem(productId);
      } else {
        await customerApi.upsertCartItem(productId, nextQty);
      }
      await loadCart();
    } catch (err) {
      showToast(err.message || 'Không thể cập nhật giỏ hàng.', true);
    }
  };

  const handlePlaceOrder = async () => {
    if (cartItems.length === 0 || placingOrder) return;
    if (!selectedAddressId || addresses.length === 0) {
      showToast('Vui lòng thêm và chọn địa chỉ nhận hàng trước khi đặt hàng.', true);
      setIsAddressModalOpen(true);
      return;
    }
    setPlacingOrder(true);
    try {
      const idempotencyKey = `WEB-CHK-${Date.now()}-${Math.floor(Math.random() * 999999)}`;
      const qrOrderCode = `WEB${String(Date.now()).slice(-6)}`;
      const payload = {
        channel: 'web',
        paymentMethod,
        ...(paymentMethod === 'transfer' ? { transactionReference: `VIETQR-${qrOrderCode}` } : {}),
        ...(selectedAddressId ? { addressId: selectedAddressId } : {}),
        ...(orderNote.trim() ? { note: orderNote.trim() } : {}),
      };
      const res = await customerApi.checkout(payload, idempotencyKey);
      const created = res?.data || res;
      const orderNum = created?.order_number || '';
      showToast(orderNum ? `Đặt hàng thành công! Mã đơn: #${orderNum}` : 'Đặt hàng thành công!');
      setOrderNote('');
      await Promise.all([loadCart(), loadCatalog(), loadOrders()]);
      setActiveTab('orders');
    } catch (err) {
      showToast(err.message || 'Đặt hàng thất bại.', true);
    } finally {
      setPlacingOrder(false);
    }
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    setSavingAddress(true);
    try {
      await customerApi.createAddress({
        recipientName: addressForm.recipientName.trim(),
        phone: addressForm.phone.trim(),
        addressLine: addressForm.addressLine.trim(),
        ward: addressForm.ward.trim() || undefined,
        district: addressForm.district.trim() || undefined,
        province: addressForm.province.trim(),
        isDefault: addressForm.isDefault,
      });
      showToast('Đã thêm địa chỉ giao hàng mới!');
      setIsAddressModalOpen(false);
      setAddressForm({
        recipientName: '',
        phone: '',
        addressLine: '',
        ward: '',
        district: '',
        province: '',
        isDefault: true,
      });
      await loadAddresses();
    } catch (err) {
      showToast(err.message || 'Thêm địa chỉ thất bại.', true);
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (id) => {
    try {
      await customerApi.deleteAddress(id);
      showToast('Đã xóa địa chỉ.');
      if (selectedAddressId === id) setSelectedAddressId('');
      await loadAddresses();
    } catch (err) {
      showToast(err.message || 'Không thể xóa địa chỉ.', true);
    }
  };

  const openOrderDetail = async (orderId) => {
    try {
      const res = await customerApi.getOrder(orderId);
      setSelectedOrder(res?.data || res);
      setIsOrderDetailOpen(true);
    } catch (err) {
      showToast(err.message || 'Không tải được chi tiết đơn hàng.', true);
    }
  };

  // Tự động đồng bộ trạng thái đơn hàng thời gian thực (mỗi 4 giây) khi khách đang mở Modal Chi tiết đơn
  useEffect(() => {
    if (!isOrderDetailOpen || !selectedOrder?.id) return;
    if (['delivered', 'cancelled', 'returned'].includes(selectedOrder.status)) return;
    const timer = setInterval(async () => {
      try {
        const res = await customerApi.getOrder(selectedOrder.id);
        const updated = res?.data || res;
        if (updated) {
          setSelectedOrder((prev) => {
            if (prev && prev.status !== updated.status) {
              showToast(`Đơn hàng vừa chuyển sang: ${ORDER_STATUS_LABELS[updated.status]?.label || updated.status}`);
              loadOrders();
            }
            return updated;
          });
        }
      } catch {
        // Bỏ qua lỗi mạng tạm thời khi polling ngầm
      }
    }, 4000);
    return () => clearInterval(timer);
  }, [isOrderDetailOpen, selectedOrder?.id, selectedOrder?.status, loadOrders]);

  const handleCancelOrder = async (orderId) => {
    if (!window.confirm('Bạn chắc chắn muốn hủy đơn hàng này?')) return;
    try {
      await customerApi.cancelOrder(orderId, 'Khách hàng hủy đơn từ Kênh Web');
      showToast('Đã hủy đơn hàng thành công.');
      await Promise.all([loadOrders(), loadCatalog()]);
      if (selectedOrder?.id === orderId) {
        const res = await customerApi.getOrder(orderId);
        setSelectedOrder(res?.data || res);
      }
    } catch (err) {
      showToast(err.message || 'Không thể hủy đơn hàng.', true);
    }
  };

  const totalCartItems = cartItems.reduce((s, i) => s + Number(i.quantity || 0), 0);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Top Navigation Bar (Đồng bộ 4 tab như BottomNavigationBar trên Mobile) */}
      <div className="bg-white border-b border-neutral-200 px-4 sm:px-8 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-neutral-900 flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-neutral-900 stroke-[1.75]" />
            <span>Karat Retail — Cửa hàng Trực tuyến</span>
          </h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Sản phẩm chính hãng • Đồng bộ giỏ hàng &amp; tồn kho thời gian thực
          </p>
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1 bg-neutral-100 p-1 rounded-lg text-xs font-medium w-full md:w-auto border border-neutral-200/80">
          <button
            type="button"
            onClick={() => {
              setActiveTab('catalog');
              setSelectedProduct(null);
            }}
            className={`justify-center px-3.5 py-2 rounded-md flex items-center gap-1.5 transition-colors ${
              activeTab === 'catalog'
                ? 'bg-white text-neutral-900 border border-neutral-200/80 font-semibold'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <Package className="w-4 h-4 shrink-0" />
            <span className="truncate">Sản phẩm</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('cart');
              setSelectedProduct(null);
            }}
            className={`justify-center px-3.5 py-2 rounded-md flex items-center gap-1.5 transition-colors ${
              activeTab === 'cart'
                ? 'bg-white text-neutral-900 border border-neutral-200/80 font-semibold'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <ShoppingCart className="w-4 h-4 shrink-0" />
            <span className="truncate">Giỏ hàng</span>
            {totalCartItems > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-neutral-900 text-white text-[10px] font-semibold tabular-nums">
                {totalCartItems}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('orders');
              setSelectedProduct(null);
            }}
            className={`justify-center px-3.5 py-2 rounded-md flex items-center gap-1.5 transition-colors ${
              activeTab === 'orders'
                ? 'bg-white text-neutral-900 border border-neutral-200/80 font-semibold'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <ClipboardList className="w-4 h-4 shrink-0" />
            <span className="truncate">Đơn hàng</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('profile');
              setSelectedProduct(null);
            }}
            className={`justify-center px-3.5 py-2 rounded-md flex items-center gap-1.5 transition-colors ${
              activeTab === 'profile'
                ? 'bg-white text-neutral-900 border border-neutral-200/80 font-semibold'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <MapPin className="w-4 h-4 shrink-0" />
            <span className="truncate">Địa chỉ ({addresses.length})</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-white p-4 sm:p-8 space-y-6">
        {error && (
          <div className="max-w-7xl mx-auto p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}
        {success && (
          <div className="max-w-7xl mx-auto p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
            {success}
          </div>
        )}

        {/* TAB 1: KHÁM PHÁ SẢN PHẨM & CHI TIẾT SẢN PHẨM */}
        {activeTab === 'catalog' && (
          selectedProduct ? (
            <ProductDetailView
              product={selectedProduct}
              relatedProducts={products
                .filter(
                  (item) =>
                    item.id !== selectedProduct.id &&
                    (!selectedProduct.category_id || item.category_id === selectedProduct.category_id)
                )
                .slice(0, 4)}
              cartQty={getCartQty(selectedProduct.id)}
              onBack={() => setSelectedProduct(null)}
              onAddToCart={handleUpdateCartQty}
              onSelectProduct={(prod) => setSelectedProduct(prod)}
              onGoToCart={() => {
                setSelectedProduct(null);
                setActiveTab('cart');
              }}
            />
          ) : (
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Search & Category Filter Bar */}
              <div className="space-y-4 border-b border-neutral-200 pb-5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 min-w-[240px]">
                    <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Tìm kiếm sản phẩm theo tên hoặc mã SKU..."
                      className="w-full pl-10 pr-4 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:bg-white focus:border-neutral-900 transition-colors"
                    />
                  </div>

                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="text-xs border border-neutral-200 rounded-lg px-3.5 py-2.5 bg-white text-neutral-700 focus:outline-none focus:border-neutral-900"
                  >
                    <option value="">Tất cả danh mục</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={loadCatalog}
                    title="Làm mới danh sách"
                    className="p-2.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600 transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingCatalog ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                {categories.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setCategoryId('')}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap border transition-colors ${
                        categoryId === ''
                          ? 'bg-neutral-900 text-white border-neutral-900'
                          : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                      }`}
                    >
                      Tất cả
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setCategoryId(c.id)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap border transition-colors ${
                          categoryId === c.id
                            ? 'bg-neutral-900 text-white border-neutral-900'
                            : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {loadingCatalog ? (
                <div className="py-20 text-center text-xs text-neutral-400">Đang tải sản phẩm...</div>
              ) : products.length === 0 ? (
                <div className="py-20 text-center text-xs text-neutral-500 bg-neutral-50 rounded-xl border border-neutral-200">
                  Không tìm thấy sản phẩm phù hợp.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                  {products.map((p) => {
                    const stock = Number(p.available_quantity ?? p.available_stock ?? 0);
                    const inCart = getCartQty(p.id);
                    const price = Number(p.sale_price ?? 0);
                    const imgUrl = p.image_url || p.imageUrl;

                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedProduct(p)}
                        className="group cursor-pointer bg-white rounded-xl border border-neutral-200 hover:border-neutral-400 transition-colors flex flex-col justify-between overflow-hidden"
                      >
                        <div>
                          <div className="relative w-full aspect-[4/3] bg-neutral-50 border-b border-neutral-100 overflow-hidden flex items-center justify-center p-4">
                            {imgUrl ? (
                              <img
                                src={imgUrl}
                                alt={p.name}
                                className="w-full h-full object-contain group-hover:scale-[1.03] transition-transform duration-300"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <Package className="w-10 h-10 text-neutral-300" />
                            )}
                            <span
                              className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded text-[10px] font-medium border ${
                                stock > 0
                                  ? 'bg-white text-neutral-700 border-neutral-200'
                                  : 'bg-red-50 text-red-700 border-red-200'
                              }`}
                            >
                              {stock > 0 ? `Còn ${stock}` : 'Hết hàng'}
                            </span>
                          </div>

                          <div className="p-4 pb-2 space-y-1">
                            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-neutral-400">
                              <span className="truncate">{p.category_name || 'Sản phẩm'}</span>
                              <span className="font-mono shrink-0 ml-2">{p.sku}</span>
                            </div>
                            <h3 className="text-sm font-medium text-neutral-900 line-clamp-2 group-hover:underline">
                              {p.name}
                            </h3>
                          </div>
                        </div>

                        <div
                          className="px-4 pb-4 pt-2 flex items-center justify-between gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="text-sm font-semibold text-neutral-900 tabular-nums">
                            {formatCurrency(price)}
                          </div>

                          {inCart > 0 ? (
                            <div className="flex items-center gap-1 bg-neutral-100 border border-neutral-200 rounded-lg px-1.5 py-1">
                              <button
                                type="button"
                                onClick={() => handleUpdateCartQty(p.id, inCart - 1)}
                                className="p-1 rounded hover:bg-white text-neutral-700"
                              >
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="text-xs font-semibold text-neutral-900 px-1.5 tabular-nums">
                                {inCart}
                              </span>
                              <button
                                type="button"
                                disabled={inCart >= stock}
                                onClick={() => handleUpdateCartQty(p.id, inCart + 1)}
                                className="p-1 rounded hover:bg-white text-neutral-700 disabled:opacity-40"
                              >
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={stock <= 0}
                              onClick={() => handleUpdateCartQty(p.id, 1)}
                              className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Thêm</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )
        )}

        {/* TAB 2: GIỎ HÀNG & ĐẶT HÀNG (Giống CartScreen + CheckoutScreen trên Mobile) */}
        {activeTab === 'cart' && (
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-neutral-900">
                Sản phẩm trong giỏ ({totalCartItems})
              </h2>

              {loadingCart ? (
                <div className="py-12 text-center text-xs text-neutral-400">Đang tải giỏ hàng...</div>
              ) : cartItems.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <p className="text-xs text-neutral-400">Giỏ hàng của bạn đang trống.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('catalog')}
                    className="px-4 py-2 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium transition-colors"
                  >
                    Khám phá sản phẩm ngay
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {cartItems.map((item) => {
                    const price = Number(item.sale_price ?? item.unit_price ?? 0);
                    const qty = Number(item.quantity ?? 1);
                    const imgUrl = item.image_url || item.imageUrl;
                    return (
                      <div key={item.product_id} className="py-3.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-12 h-12 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                            {imgUrl ? (
                              <img
                                src={imgUrl}
                                alt={item.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : (
                              <Package className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-slate-900 line-clamp-2">{item.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {item.sku} • {formatCurrency(price)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto pl-15 sm:pl-0">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateCartQty(item.product_id, qty - 1)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs font-bold w-6 text-center tabular-nums">{qty}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateCartQty(item.product_id, qty + 1)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="text-xs font-bold text-blue-600 sm:w-24 text-right tabular-nums">
                            {formatCurrency(price * qty)}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleUpdateCartQty(item.product_id, 0)}
                            className="p-1.5 text-slate-400 hover:text-red-600"
                            title="Xóa khỏi giỏ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cột Xác nhận Đặt hàng */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 h-fit">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Xác nhận Đặt hàng</h2>
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(true)}
                  className="text-xs text-blue-600 hover:underline font-medium"
                >
                  + Thêm địa chỉ
                </button>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">Địa chỉ giao hàng *</label>
                {addresses.length === 0 ? (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-2">
                    <p>Bạn chưa có địa chỉ giao hàng. Vui lòng thêm địa chỉ nhận hàng để tiếp tục đặt hàng.</p>
                    <button
                      type="button"
                      onClick={() => setIsAddressModalOpen(true)}
                      className="w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition"
                    >
                      + Thêm địa chỉ nhận hàng ngay
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {addresses.map((addr) => (
                      <label
                        key={addr.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                          selectedAddressId === addr.id
                            ? 'border-blue-600 bg-blue-50/50'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="shippingAddress"
                          checked={selectedAddressId === addr.id}
                          onChange={() => setSelectedAddressId(addr.id)}
                          className="mt-0.5 text-blue-600"
                        />
                        <div>
                          <div className="font-semibold text-slate-900">
                            {addr.recipient_name} • {addr.phone}
                          </div>
                          <div className="text-[11px] text-slate-600">
                            {[addr.address_line, addr.ward, addr.district, addr.province]
                              .filter(Boolean)
                              .join(', ')}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">Phương thức thanh toán</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cod')}
                    className={`p-2.5 rounded-lg border text-xs font-semibold transition ${
                      paymentMethod === 'cod'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Tiền mặt (COD)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('transfer')}
                    className={`p-2.5 rounded-lg border text-xs font-semibold transition ${
                      paymentMethod === 'transfer'
                        ? 'border-blue-600 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Chuyển khoản QR
                  </button>
                </div>

                {paymentMethod === 'transfer' && cartSubtotal > 0 && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center">
                    <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
                      <img
                        src={`https://img.vietqr.io/image/970436-1025321052-compact2.png?amount=${Math.round(cartSubtotal)}&addInfo=${encodeURIComponent(`WEB${String(Date.now()).slice(-6)}`)}&accountName=${encodeURIComponent('LY CHI CHUONG')}`}
                        alt="VietQR"
                        className="w-56 h-56 object-contain mx-auto"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ghi chú đơn hàng
                </label>
                <textarea
                  rows={2}
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value)}
                  placeholder="Ghi chú giao hàng (tùy chọn)..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-neutral-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-600">Tổng thanh toán:</span>
                <span className="text-lg font-bold text-neutral-900 tabular-nums">{formatCurrency(cartSubtotal)}</span>
              </div>

              <button
                type="button"
                disabled={cartItems.length === 0 || placingOrder || !selectedAddressId}
                onClick={handlePlaceOrder}
                className="w-full py-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-semibold transition-colors disabled:opacity-40"
              >
                {placingOrder
                  ? 'Đang xử lý đặt hàng...'
                  : !selectedAddressId
                  ? 'Vui lòng thêm địa chỉ giao hàng'
                  : 'Đặt hàng ngay'}
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: ĐƠN HÀNG CỦA TÔI (Giống OrdersScreen + OrderDetailScreen trên Mobile) */}
        {activeTab === 'orders' && (
          <div className="max-w-7xl mx-auto space-y-4">
            <div className="bg-white p-2 rounded-xl border border-neutral-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1">
                {ORDER_TABS.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => setOrderStatusFilter(t.status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      orderStatusFilter === t.status
                        ? 'bg-neutral-900 text-white font-semibold'
                        : 'text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={loadOrders}
                className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600"
              >
                <RefreshCw className={`w-4 h-4 ${loadingOrders ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              {loadingOrders ? (
                <div className="py-12 text-center text-xs text-slate-400">Đang tải đơn hàng...</div>
              ) : orders.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Chưa có đơn hàng nào ở trạng thái này.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {orders.map((o) => {
                    const st = ORDER_STATUS_LABELS[o.status] || {
                      label: o.status,
                      cls: 'bg-slate-100 text-slate-700 border-slate-200',
                    };
                    const canCancel = ['pending', 'confirmed'].includes(o.status);

                    return (
                      <div
                        key={o.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                              #{o.order_number}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${st.cls}`}>
                              {st.label}
                            </span>
                            <span className="text-[11px] text-slate-400 uppercase">
                              Kênh: {o.channel}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1">
                            Ngày đặt: {formatDate(o.created_at)}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-sm font-bold text-blue-600">
                              {formatCurrency(o.total_amount)}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => openOrderDetail(o.id)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-white text-xs font-medium text-slate-700 flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Chi tiết</span>
                          </button>

                          {canCancel && (
                            <button
                              type="button"
                              onClick={() => handleCancelOrder(o.id)}
                              className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-medium text-red-700"
                            >
                              Hủy đơn
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: SỔ ĐỊA CHỈ & TÀI KHOẢN (Giống ProfileScreen trên Mobile) */}
        {activeTab === 'profile' && (
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 h-fit">
              <h2 className="text-sm font-bold text-slate-900">Thông tin Tài khoản</h2>
              <div className="text-xs space-y-2 text-slate-600">
                <div>
                  <span className="text-slate-400 block">Họ và tên:</span>
                  <span className="font-semibold text-slate-900">{user?.full_name || 'Khách hàng'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Email:</span>
                  <span className="font-semibold text-slate-900">{user?.email}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Vai trò:</span>
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                    {user?.role_name || 'Khách hàng'}
                  </span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Sổ địa chỉ nhận hàng</h2>
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm địa chỉ mới</span>
                </button>
              </div>

              {addresses.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  Chưa có địa chỉ giao hàng nào được lưu.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {addresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="p-3.5 rounded-lg border border-slate-200 flex items-center justify-between gap-3"
                    >
                      <div className="text-xs">
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                          <span>
                            {addr.recipient_name} • {addr.phone}
                          </span>
                          {addr.is_default && (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold">
                              Mặc định
                            </span>
                          )}
                        </div>
                        <div className="text-slate-600 mt-0.5">
                          {[addr.address_line, addr.ward, addr.district, addr.province]
                            .filter(Boolean)
                            .join(', ')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600"
                        title="Xóa địa chỉ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Thêm địa chỉ */}
      <Modal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        title="Thêm địa chỉ giao hàng mới"
      >
        <form onSubmit={handleSaveAddress} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Người nhận *</label>
              <input
                type="text"
                value={addressForm.recipientName}
                onChange={(e) => setAddressForm({ ...addressForm, recipientName: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Số điện thoại *</label>
              <input
                type="text"
                value={addressForm.phone}
                onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                required
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Địa chỉ số nhà, tên đường *</label>
            <input
              type="text"
              value={addressForm.addressLine}
              onChange={(e) => setAddressForm({ ...addressForm, addressLine: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2"
              required
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phường / Xã</label>
              <input
                type="text"
                value={addressForm.ward}
                onChange={(e) => setAddressForm({ ...addressForm, ward: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Quận / Huyện</label>
              <input
                type="text"
                value={addressForm.district}
                onChange={(e) => setAddressForm({ ...addressForm, district: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Tỉnh / Thành phố *</label>
              <input
                type="text"
                value={addressForm.province}
                onChange={(e) => setAddressForm({ ...addressForm, province: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2"
                required
              />
            </div>
          </div>
          <label className="flex items-center gap-2 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={addressForm.isDefault}
              onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
              className="rounded border-slate-300 text-blue-600"
            />
            <span className="font-medium text-slate-700">Đặt làm địa chỉ mặc định</span>
          </label>
          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddressModalOpen(false)}
              className="px-3 py-2 rounded-lg border border-slate-300 text-slate-700"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={savingAddress}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
            >
              {savingAddress ? 'Đang lưu...' : 'Lưu địa chỉ'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Chi tiết Đơn hàng */}
      <Modal
        isOpen={isOrderDetailOpen}
        onClose={() => setIsOrderDetailOpen(false)}
        title={selectedOrder ? `Chi tiết đơn hàng #${selectedOrder.order_number}` : 'Chi tiết đơn hàng'}
        maxWidth="max-w-2xl"
      >
        {selectedOrder && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <div className="text-slate-500">Ngày đặt: {formatDate(selectedOrder.created_at)}</div>
                <div className="text-slate-500 mt-0.5">
                  Kênh đặt: <span className="font-semibold uppercase">{selectedOrder.channel}</span>
                </div>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full font-semibold border ${
                  ORDER_STATUS_LABELS[selectedOrder.status]?.cls || 'bg-slate-100 text-slate-700'
                }`}
              >
                {ORDER_STATUS_LABELS[selectedOrder.status]?.label || selectedOrder.status}
              </span>
            </div>

            {/* Animated Order Timeline */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <OrderTimeline
                currentStatus={selectedOrder.status}
                statusHistory={selectedOrder.status_history || selectedOrder.history || []}
              />
            </div>

            <div>
              <div className="font-bold text-slate-800 mb-2">Danh sách sản phẩm</div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg px-3">
                {(selectedOrder.items || []).map((item, idx) => {
                  const imgUrl = item.image_url || item.imageUrl;
                  return (
                    <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt={item.name || item.product_name}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <Package className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">
                            {item.name || item.product_name}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">SKU: {item.sku}</div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-slate-600 mr-3">x{item.quantity}</span>
                        <span className="font-bold text-blue-600">
                          {formatCurrency(Number(item.unit_price || 0) * Number(item.quantity || 1))}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-800">Tổng cộng:</span>
              <span className="text-base font-bold text-blue-600">
                {formatCurrency(selectedOrder.total_amount)}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
