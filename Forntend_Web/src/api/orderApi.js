import axiosClient from './axiosClient';

export const orderApi = {
  // Lấy danh sách đơn hàng đa kênh (Manager View)
  getOrders: (params = {}) => {
    return axiosClient.get('/manager/orders', { params });
  },

  // Lấy chi tiết đơn hàng (bao gồm order items, customer, status history)
  getOrderDetail: (orderId) => {
    return axiosClient.get(`/order-processing/orders/${orderId}`);
  },

  // 1. Bước xác nhận đơn (pending -> confirmed)
  confirmOrder: (orderId, { note } = {}) => {
    return axiosClient.post(`/order-processing/orders/${orderId}/confirm`, { note });
  },

  // Phân công nhân viên xử lý đơn
  assignOrder: (orderId, { assignedTo, note }) => {
    return axiosClient.post(`/order-processing/orders/${orderId}/assign`, { assignedTo, note });
  },

  // 2. Cập nhật tác vụ xử lý đơn (confirmed -> ready_to_pack)
  updateTask: (orderId, { status, note }) => {
    return axiosClient.patch(`/order-processing/orders/${orderId}/task`, { status, note });
  },

  // 3. Đóng gói đơn hàng và trừ tồn kho (ready_to_pack -> packed)
  packOrder: (orderId, { warehouseId }) => {
    return axiosClient.post(`/warehouse/orders/${orderId}/pack`, { warehouseId });
  },

  // 4. Tạo vận đơn bàn giao cho Shipper (packed -> handover)
  createShipment: ({ orderId, trackingNumber, carrier, assignedTo, note }) => {
    return axiosClient.post('/shipping/shipments', {
      orderId,
      trackingNumber,
      carrier: carrier || 'Internal Delivery',
      assignedTo,
      note,
    });
  },

  // 5. Cập nhật trạng thái vận đơn (handover -> shipping / delivered / returned)
  updateShipmentStatus: (shipmentId, { status, note }) => {
    return axiosClient.patch(`/shipping/shipments/${shipmentId}/status`, { status, note });
  },

  // Hủy đơn hàng (pending / confirmed / ready_to_pack -> cancelled)
  cancelOrder: (orderId, { reason }) => {
    return axiosClient.post(`/manager/orders/${orderId}/cancel`, { reason });
  },

  // Nhận trả hàng tại kho (delivered -> returned)
  returnOrder: (orderId, { reason, note }) => {
    return axiosClient.post(`/warehouse/orders/${orderId}/return-receipt`, { reason, note });
  },
};
