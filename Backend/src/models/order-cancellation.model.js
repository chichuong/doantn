import { withTransaction } from '../utils/transaction.js';
import { releaseReservation } from '../services/inventory.service.js';
import { AppError } from '../utils/app-error.js';
import { ORDER_STATUS, transitionOrder } from '../domain/order-state-machine.js';

export const cancelOnlineOrder = ({ orderId, userId, customerOnly, note }) => withTransaction(async (client) => {
  const order = await client.query(`SELECT id, warehouse_id, status, payment_status, created_by FROM orders
    WHERE id = $1 AND channel IN ('web','mobile') AND (NOT $2::boolean OR created_by = $3) FOR UPDATE`, [orderId, customerOnly, userId]);
  if (!order.rowCount) throw new AppError(404, 'Không tìm thấy đơn online được phép hủy');
  const header = order.rows[0];
  if (header.status === 'cancelled') return header;
  if (!(customerOnly ? [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED]
    : [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED, ORDER_STATUS.READY_TO_PACK]).includes(header.status)) {
    throw new AppError(409, 'Đơn đã xuất kho hoặc không còn đủ điều kiện hủy');
  }
  await releaseReservation(client, { orderId, userId });
  await client.query(`UPDATE order_processing_tasks SET status = 'cancelled', updated_at = NOW() WHERE order_id = $1`, [orderId]);
  await client.query(`UPDATE bank_transfer_requests SET status = 'rejected', reviewed_by = $2,
    review_note = 'Đơn đã hủy trước khi xác nhận thanh toán', reviewed_at = NOW() WHERE order_id = $1 AND status = 'pending'`, [orderId, userId]);
  // Paid orders keep payment_status=paid until a real manual refund is confirmed.
  return transitionOrder(client, { orderId, toStatus: ORDER_STATUS.CANCELLED,
    expectedFrom: customerOnly ? [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED]
      : [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED, ORDER_STATUS.READY_TO_PACK],
    note: note || 'Hủy đơn và giải phóng lượng giữ', changedBy: userId });
});
