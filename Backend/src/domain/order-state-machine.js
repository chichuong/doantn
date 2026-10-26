import { AppError } from '../utils/app-error.js';

export const ORDER_STATUS = Object.freeze({
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  READY_TO_PACK: 'ready_to_pack',
  PACKED: 'packed',
  HANDOVER: 'handover',
  SHIPPING: 'shipping',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURNED: 'returned'
});

export const ORDER_TRANSITIONS = Object.freeze({
  [ORDER_STATUS.PENDING]: Object.freeze([ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED]),
  [ORDER_STATUS.CONFIRMED]: Object.freeze([ORDER_STATUS.READY_TO_PACK, ORDER_STATUS.CANCELLED]),
  [ORDER_STATUS.READY_TO_PACK]: Object.freeze([ORDER_STATUS.PACKED, ORDER_STATUS.CANCELLED]),
  [ORDER_STATUS.PACKED]: Object.freeze([ORDER_STATUS.HANDOVER]),
  [ORDER_STATUS.HANDOVER]: Object.freeze([ORDER_STATUS.SHIPPING, ORDER_STATUS.RETURNED]),
  [ORDER_STATUS.SHIPPING]: Object.freeze([ORDER_STATUS.DELIVERED, ORDER_STATUS.RETURNED]),
  [ORDER_STATUS.DELIVERED]: Object.freeze([ORDER_STATUS.RETURNED]),
  [ORDER_STATUS.CANCELLED]: Object.freeze([]),
  [ORDER_STATUS.RETURNED]: Object.freeze([])
});

const knownStatuses = new Set(Object.values(ORDER_STATUS));

export const assertOrderTransition = (fromStatus, toStatus) => {
  if (!knownStatuses.has(fromStatus) || !knownStatuses.has(toStatus)) {
    throw new AppError(500, 'Order state machine nhận trạng thái không được định nghĩa', { fromStatus, toStatus });
  }
  if (!ORDER_TRANSITIONS[fromStatus].includes(toStatus)) {
    throw new AppError(409, `Không thể chuyển trạng thái đơn từ ${fromStatus} sang ${toStatus}`, {
      fromStatus,
      toStatus,
      allowedTransitions: ORDER_TRANSITIONS[fromStatus]
    });
  }
};

export const recordInitialOrderState = async (client, { orderId, status, note, changedBy }) => {
  if (!knownStatuses.has(status)) throw new AppError(500, `Trạng thái khởi tạo đơn không hợp lệ: ${status}`);
  await client.query(
    `INSERT INTO order_status_history (order_id, from_status, status, note, changed_by)
     VALUES ($1, NULL, $2, $3, $4)`,
    [orderId, status, note || null, changedBy || null]
  );
};

export const recordOrderStateEvent = async (client, { orderId, note, changedBy }) => {
  const current = await client.query('SELECT status FROM orders WHERE id = $1', [orderId]);
  if (!current.rowCount) throw new AppError(404, 'Không tìm thấy đơn hàng');
  const status = current.rows[0].status;
  if (!knownStatuses.has(status)) throw new AppError(500, `Trạng thái đơn không hợp lệ: ${status}`);
  await client.query(
    `INSERT INTO order_status_history (order_id, from_status, status, note, changed_by)
     VALUES ($1, $2, $2, $3, $4)`,
    [orderId, status, note || null, changedBy || null]
  );
};

export const transitionOrder = async (client, { orderId, toStatus, note, changedBy, expectedFrom }) => {
  const locked = await client.query(
    `SELECT id, status, order_number, channel, payment_status, total_amount, warehouse_id
     FROM orders WHERE id = $1 FOR UPDATE`,
    [orderId]
  );
  if (!locked.rowCount) throw new AppError(404, 'Không tìm thấy đơn hàng');
  const order = locked.rows[0];
  if (order.status === toStatus) return { ...order, changed: false };
  if (expectedFrom) {
    const expected = Array.isArray(expectedFrom) ? expectedFrom : [expectedFrom];
    if (!expected.includes(order.status)) {
      throw new AppError(409, `Đơn đang ở trạng thái ${order.status}, không phải trạng thái mong đợi`, {
        currentStatus: order.status,
        expectedStatuses: expected
      });
    }
  }
  assertOrderTransition(order.status, toStatus);
  const updated = await client.query(
    `UPDATE orders SET status = $2, updated_at = NOW()
     WHERE id = $1 AND status = $3
     RETURNING id, order_number, channel, status, payment_status, total_amount, warehouse_id, updated_at`,
    [orderId, toStatus, order.status]
  );
  if (!updated.rowCount) throw new AppError(409, 'Trạng thái đơn vừa thay đổi bởi một giao dịch khác');
  await client.query(
    `INSERT INTO order_status_history (order_id, from_status, status, note, changed_by)
     VALUES ($1, $2, $3, $4, $5)`,
    [orderId, order.status, toStatus, note || null, changedBy || null]
  );
  return { ...updated.rows[0], changed: true };
};
