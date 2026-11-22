/**
 * Ma trận Order State Machine chuẩn theo Migration 016 và Trigger PostgreSQL backend.
 */
export const ORDER_STATE_MACHINE_RULES = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['ready_to_pack', 'cancelled'],
  ready_to_pack: ['packed', 'cancelled'],
  packed: ['handover'],
  handover: ['shipping', 'returned'],
  shipping: ['delivered', 'returned'],
  delivered: ['returned'],
  cancelled: [],
  returned: [],
};

/**
 * Chuỗi tiến trình chuẩn cho luồng đơn hàng thành công (Linear Happy Path)
 */
export const ORDER_TIMELINE_STEPS = [
  { key: 'pending', label: 'Tạo đơn' },
  { key: 'confirmed', label: 'Xác nhận' },
  { key: 'ready_to_pack', label: 'Chờ đóng gói' },
  { key: 'packed', label: 'Đã đóng gói' },
  { key: 'handover', label: 'Bàn giao Shipper' },
  { key: 'shipping', label: 'Đang vận chuyển' },
  { key: 'delivered', label: 'Hoàn tất' },
];

/**
 * Cấu hình các nút hành động (Action Buttons) cho từng trạng thái hợp lệ
 */
export const STATE_TRANSITION_ACTIONS = {
  pending: [
    {
      targetStatus: 'confirmed',
      label: 'Xác nhận đơn',
      variant: 'primary',
      description: 'Xác nhận đơn hàng trực tuyến và chuyển sang khâu xử lý lấy hàng',
      endpoint: (orderId) => `/order-processing/orders/${orderId}/confirm`,
      method: 'POST',
    },
    {
      targetStatus: 'cancelled',
      label: 'Hủy đơn hàng',
      variant: 'danger',
      description: 'Hủy đơn và hoàn trả toàn bộ số lượng hàng đã giữ (reserved stock)',
      endpoint: (orderId) => `/manager/orders/${orderId}/cancel`,
      method: 'POST',
      requireReason: true,
    },
  ],
  confirmed: [
    {
      targetStatus: 'ready_to_pack',
      label: 'Đã nhặt hàng (Sẵn sàng đóng gói)',
      variant: 'primary',
      description: 'Cập nhật tiến độ nhặt hàng xong, chuyển cho bộ phận kho đóng gói',
      endpoint: (orderId) => `/order-processing/orders/${orderId}/task`,
      method: 'PATCH',
      payload: { status: 'ready_to_pack', note: 'Đã kiểm tra và chuyển kho đóng gói' },
    },
    {
      targetStatus: 'cancelled',
      label: 'Hủy đơn hàng',
      variant: 'danger',
      description: 'Hủy đơn và giải phóng hàng giữ tồn kho',
      endpoint: (orderId) => `/manager/orders/${orderId}/cancel`,
      method: 'POST',
      requireReason: true,
    },
  ],
  ready_to_pack: [
    {
      targetStatus: 'packed',
      label: 'Đóng gói & Xuất kho',
      variant: 'primary',
      description: 'Bộ phận kho xác nhận đóng gói, trừ tồn kho thực tế và chuyển sang đã đóng gói',
      endpoint: (orderId) => `/warehouse/orders/${orderId}/pack`,
      method: 'POST',
    },
    {
      targetStatus: 'cancelled',
      label: 'Hủy đơn hàng',
      variant: 'danger',
      description: 'Hủy đơn và hoàn trả tồn kho',
      endpoint: (orderId) => `/manager/orders/${orderId}/cancel`,
      method: 'POST',
      requireReason: true,
    },
  ],
  packed: [
    {
      targetStatus: 'handover',
      label: 'Tạo vận đơn & Bàn giao',
      variant: 'primary',
      description: 'Tạo mã vận đơn và bàn giao cho nhân viên giao hàng (Shipper)',
      requiresTracking: true,
      endpoint: () => `/shipping/shipments`,
      method: 'POST',
    },
  ],
  handover: [
    {
      targetStatus: 'shipping',
      label: 'Shipper đã lấy hàng (Đang giao)',
      variant: 'info',
      description: 'Cập nhật đơn hàng đang trong hành trình vận chuyển đến người mua',
      shipmentStatus: 'picked_up',
    },
    {
      targetStatus: 'returned',
      label: 'Hàng hoàn về kho',
      variant: 'warning',
      description: 'Không thể giao hàng, tiến hành nhập hoàn lại về kho',
      requireReason: true,
    },
  ],
  shipping: [
    {
      targetStatus: 'delivered',
      label: 'Giao hàng thành công',
      variant: 'success',
      description: 'Khách hàng đã nhận đơn và thanh toán thành công',
      shipmentStatus: 'delivered',
    },
    {
      targetStatus: 'returned',
      label: 'Khách từ chối / Giao thất bại (Hoàn đơn)',
      variant: 'warning',
      description: 'Đơn hàng giao thất bại, chuyển trạng thái hoàn kho',
      requireReason: true,
    },
  ],
  delivered: [
    {
      targetStatus: 'returned',
      label: 'Trả hàng & Hoàn tiền',
      variant: 'warning',
      description: 'Khách hàng trả lại sản phẩm, thực hiện hoàn tiền và hoàn tồn kho',
      requireReason: true,
      endpoint: (orderId) => `/warehouse/orders/${orderId}/return-receipt`,
      method: 'POST',
    },
  ],
  cancelled: [],
  returned: [],
};

/**
 * Kiểm tra xem trạng thái đích có hợp lệ từ trạng thái hiện tại hay không
 */
export const isValidTransition = (currentStatus, targetStatus) => {
  const allowed = ORDER_STATE_MACHINE_RULES[currentStatus] || [];
  return allowed.includes(targetStatus);
};
