import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { posApi } from '../api/posApi';
import { useAuth } from './AuthContext';

const PosContext = createContext(null);

export const PosProvider = ({ children }) => {
  const { hasPermission } = useAuth();
  const canManageSession = hasPermission('pos.sessions.manage');
  const [currentSession, setCurrentSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState({ name: '', phone: '' });
  const [discountAmount, setDiscountAmount] = useState(0);

  // Tải thông tin ca bán hàng hiện tại của nhân viên
  const refreshSession = useCallback(async () => {
    if (!canManageSession) {
      setCurrentSession(null);
      setLoadingSession(false);
      return;
    }
    const token = localStorage.getItem('token');
    if (!token) {
      setCurrentSession(null);
      setLoadingSession(false);
      return;
    }

    try {
      setLoadingSession(true);
      const res = await posApi.getCurrentSession();
      if (res?.data) {
        setCurrentSession(res.data);
      } else {
        setCurrentSession(null);
      }
    } catch (err) {
      setCurrentSession(null);
    } finally {
      setLoadingSession(false);
    }
  }, [canManageSession]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  /**
   * Thêm sản phẩm vào giỏ hàng
   * BẮT BUỘC KIỂM TRA TỒN KHẢ DỤNG (available_quantity).
   * Không cho thêm nếu vượt quá tồn.
   */
  const addToCart = (product, quantityToAdd = 1) => {
    const available = Number(product.available_quantity ?? product.availableQuantity ?? 0);
    const existingIndex = cart.findIndex((item) => item.id === product.id);

    const currentQtyInCart = existingIndex > -1 ? cart[existingIndex].quantity : 0;
    const requestedTotal = currentQtyInCart + quantityToAdd;

    if (requestedTotal > available) {
      return {
        success: false,
        message: `Không thể thêm! Tồn khả dụng của "${product.name}" chỉ còn ${available} (Trong giỏ đã có ${currentQtyInCart}).`,
        available,
      };
    }

    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity = requestedTotal;
      updated[existingIndex].subtotal = requestedTotal * updated[existingIndex].price;
      setCart(updated);
    } else {
      const unitPrice = Number(product.sale_price ?? product.salePrice ?? product.price ?? 0);
      setCart([
        ...cart,
        {
          id: product.id,
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          price: unitPrice,
          availableQuantity: available,
          quantity: quantityToAdd,
          subtotal: unitPrice * quantityToAdd,
        },
      ]);
    }

    return { success: true };
  };

  /**
   * Cập nhật số lượng sản phẩm trong giỏ
   */
  const updateQuantity = (productId, newQuantity) => {
    const qty = Number(newQuantity);
    if (qty <= 0) {
      removeFromCart(productId);
      return { success: true };
    }

    const item = cart.find((i) => i.id === productId);
    if (!item) return { success: false, message: 'Sản phẩm không có trong giỏ' };

    if (qty > item.availableQuantity) {
      return {
        success: false,
        message: `Số lượng yêu cầu (${qty}) vượt tồn khả dụng (${item.availableQuantity})`,
      };
    }

    setCart((prev) =>
      prev.map((i) =>
        i.id === productId
          ? {
              ...i,
              quantity: qty,
              subtotal: qty * i.price,
            }
          : i
      )
    );
    return { success: true };
  };

  /**
   * Xóa một sản phẩm khỏi giỏ
   */
  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  };

  /**
   * Làm rỗng giỏ hàng sau khi hoàn tất giao dịch
   */
  const clearCart = () => {
    setCart([]);
    setCustomer({ name: '', phone: '' });
    setDiscountAmount(0);
  };

  // Tính toán tổng giỏ hàng
  const subtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const finalTotal = Math.max(0, subtotal - discountAmount);

  return (
    <PosContext.Provider
      value={{
        currentSession,
        loadingSession,
        refreshSession,
        setCurrentSession,
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
      }}
    >
      {children}
    </PosContext.Provider>
  );
};

export const usePos = () => {
  const context = useContext(PosContext);
  if (!context) throw new Error('usePos must be used within a PosProvider');
  return context;
};
