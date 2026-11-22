import axiosClient from './axiosClient';

export const customerApi = {
  getCatalog: (params) => axiosClient.get('/customer/catalog', { params }),
  getCategories: (params) => axiosClient.get('/catalog/categories', { params }),

  getCart: () => axiosClient.get('/customer/cart'),
  upsertCartItem: (productId, quantity) =>
    axiosClient.put('/customer/cart/items', { productId, quantity }),
  removeCartItem: (productId) => axiosClient.delete(`/customer/cart/items/${productId}`),

  getAddresses: () => axiosClient.get('/customer/addresses'),
  createAddress: (data) => axiosClient.post('/customer/addresses', data),
  updateAddress: (addressId, data) => axiosClient.patch(`/customer/addresses/${addressId}`, data),
  deleteAddress: (addressId) => axiosClient.delete(`/customer/addresses/${addressId}`),

  checkout: (data, idempotencyKey) =>
    axiosClient.post('/customer/checkout', data, {
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
    }),

  getOrders: (params) => axiosClient.get('/customer/orders', { params }),
  getOrder: (orderId) => axiosClient.get(`/customer/orders/${orderId}`),
  cancelOrder: (orderId, note) =>
    axiosClient.post(`/customer/orders/${orderId}/cancel`, note ? { note } : {}),
};

