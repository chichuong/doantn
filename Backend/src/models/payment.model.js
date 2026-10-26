import { query } from '../config/database.js';
import { withTransaction } from '../utils/transaction.js';
import { AppError } from '../utils/app-error.js';
import { recordOrderStateEvent } from '../domain/order-state-machine.js';

export const getCustomerPayment = async (orderId, userId) => {
  const order = await query(`SELECT id, order_number, total_amount, payment_status, status FROM orders
    WHERE id = $1 AND created_by = $2 AND channel IN ('web','mobile')`, [orderId, userId]);
  if (!order.rowCount) throw new AppError(404, 'Không tìm thấy đơn online của bạn');
  const requests = await query(`SELECT id, bank_reference, status, note, review_note, submitted_at, reviewed_at
    FROM bank_transfer_requests WHERE order_id = $1 ORDER BY submitted_at DESC`, [orderId]);
  return { order: order.rows[0], requests: requests.rows };
};

export const submitTransfer = (input) => withTransaction(async (client) => {
  const { orderId, userId, bankReference, note } = input;
  const order = await client.query(`SELECT id, status, payment_status, total_amount FROM orders
    WHERE id = $1 AND created_by = $2 AND channel IN ('web','mobile') FOR UPDATE`, [orderId, userId]);
  if (!order.rowCount) throw new AppError(404, 'Không tìm thấy đơn online của bạn');
  const existing = await client.query('SELECT * FROM bank_transfer_requests WHERE order_id = $1 AND bank_reference = $2', [orderId, bankReference]);
  if (existing.rowCount) return existing.rows[0];
  const header = order.rows[0];
  if (['cancelled','returned'].includes(header.status) || header.payment_status !== 'unpaid' || Number(header.total_amount) <= 0) {
    throw new AppError(409, 'Đơn không còn đủ điều kiện gửi thông tin chuyển khoản');
  }
  const pending = await client.query(`SELECT id FROM bank_transfer_requests WHERE order_id = $1 AND status = 'pending'`, [orderId]);
  if (pending.rowCount) throw new AppError(409, 'Đơn đang có yêu cầu chuyển khoản chờ đối soát');
  const result = await client.query(`INSERT INTO bank_transfer_requests (order_id, submitted_by, bank_reference, note)
    VALUES ($1,$2,$3,$4) RETURNING *`, [orderId, userId, bankReference, note || null]);
  return result.rows[0];
});

export const listTransfers = async ({ status, limit, offset }) => {
  const count = await query('SELECT COUNT(*)::int AS total FROM bank_transfer_requests WHERE ($1::text IS NULL OR status = $1)', [status || null]);
  const result = await query(`SELECT r.*, o.order_number, o.total_amount, o.status AS order_status, o.payment_status
    FROM bank_transfer_requests r JOIN orders o ON o.id = r.order_id
    WHERE ($1::text IS NULL OR r.status = $1) ORDER BY r.submitted_at, r.id LIMIT $2 OFFSET $3`, [status || null, limit, offset]);
  return { rows: result.rows, total: count.rows[0].total };
};

export const reviewTransfer = (input) => withTransaction(async (client) => {
  const { requestId, decision, bankReference, receivedAmount, reviewNote, userId } = input;
  const reference = await client.query('SELECT order_id FROM bank_transfer_requests WHERE id = $1', [requestId]);
  if (!reference.rowCount) throw new AppError(404, 'Không tìm thấy yêu cầu chuyển khoản');
  const orderId = reference.rows[0].order_id;
  const order = await client.query(`SELECT *, reservation_expires_at <= NOW() AND status = 'pending'
    AND payment_status = 'unpaid' AS reservation_expired FROM orders WHERE id = $1 FOR UPDATE`, [orderId]);
  const request = await client.query('SELECT * FROM bank_transfer_requests WHERE id = $1 FOR UPDATE', [requestId]);
  const header = order.rows[0];
  if (request.rows[0].status === decision) {
    if (decision === 'confirmed' && (request.rows[0].confirmed_bank_reference !== bankReference
      || Number(request.rows[0].confirmed_amount) !== Number(receivedAmount))) throw new AppError(409, 'Yêu cầu đã được xác nhận với giao dịch/số tiền khác');
    return request.rows[0];
  }
  if (request.rows[0].status !== 'pending') throw new AppError(409, 'Yêu cầu đã được xử lý');
  if (decision === 'confirmed') {
    if (header.reservation_expired) throw new AppError(409, 'Reservation đã hết hạn; cần đối soát giao dịch nhận tiền riêng trước khi xử lý');
    if (['cancelled','returned'].includes(header.status) || header.payment_status !== 'unpaid') throw new AppError(409, 'Đơn không còn đủ điều kiện xác nhận thanh toán');
    if (Number(header.total_amount) <= 0) throw new AppError(409, 'Đơn không có số tiền cần thanh toán');
    const matched = await client.query('SELECT total_amount = $2::numeric AS matched FROM orders WHERE id = $1', [orderId, receivedAmount]);
    if (!matched.rows[0].matched) throw new AppError(409, 'Số tiền thực nhận chưa khớp tổng tiền đơn; cần đối soát bổ sung');
    const payment = await client.query('SELECT id FROM payments WHERE order_id = $1 AND status = $2', [orderId, 'paid']);
    if (payment.rowCount) throw new AppError(409, 'Đơn đã có giao dịch thanh toán');
    try {
      await client.query(`INSERT INTO payments (order_id, method, amount, transaction_reference, received_by, transfer_request_id)
        VALUES ($1,'transfer',$2,$3,$4,$5)`, [orderId, header.total_amount, bankReference, userId, requestId]);
    } catch (error) { if (error.code === '23505') throw new AppError(409, 'Mã giao dịch ngân hàng đã được xác nhận cho yêu cầu khác'); throw error; }
    await client.query(`UPDATE orders SET payment_status = 'paid', reservation_expires_at = NULL, updated_at = NOW() WHERE id = $1`, [orderId]);
    await client.query(`UPDATE inventory_reservations SET expires_at = NULL WHERE order_item_id IN
      (SELECT id FROM order_items WHERE order_id = $1) AND status = 'active'`, [orderId]);
    await recordOrderStateEvent(client, { orderId,
      note: 'Nhân viên đã đối soát và xác nhận chuyển khoản', changedBy: userId });
  }
  const result = await client.query(`UPDATE bank_transfer_requests SET status = $2, reviewed_by = $3,
    review_note = $4, confirmed_bank_reference = $5, confirmed_amount = $6,
    reviewed_at = NOW() WHERE id = $1 RETURNING *`, [requestId, decision, userId, reviewNote || null, bankReference, receivedAmount]);
  return result.rows[0];
});

export const confirmRefund = (input) => withTransaction(async (client) => {
  const { orderId, bankReference, note, userId } = input;
  const order = await client.query(`SELECT * FROM orders WHERE id = $1 AND channel IN ('web','mobile') FOR UPDATE`, [orderId]);
  if (!order.rowCount) throw new AppError(404, 'Không tìm thấy đơn online');
  const existing = await client.query('SELECT * FROM manual_refunds WHERE order_id = $1', [orderId]);
  if (existing.rowCount) {
    if (existing.rows[0].bank_reference !== bankReference) throw new AppError(409, 'Đơn đã có xác nhận hoàn tiền khác');
    return existing.rows[0];
  }
  const header = order.rows[0];
  if (!['cancelled','returned'].includes(header.status) || header.payment_status !== 'paid') throw new AppError(409, 'Chỉ hoàn tiền cho đơn đã thanh toán và đã hủy/hoàn');
  if (header.status === 'returned') {
    const receipt = await client.query('SELECT id FROM order_return_receipts WHERE order_id = $1', [orderId]);
    if (!receipt.rowCount) throw new AppError(409, 'Kho phải tiếp nhận hàng hoàn trước khi xác nhận hoàn tiền');
  }
  const payments = await client.query(`SELECT COALESCE(SUM(amount), 0) AS amount FROM payments WHERE order_id = $1 AND status = 'paid'`, [orderId]);
  if (Number(payments.rows[0].amount) <= 0) throw new AppError(409, 'Không có giao dịch nhận tiền để đối soát hoàn tiền');
  let refund;
  try {
    refund = await client.query(`INSERT INTO manual_refunds (order_id, amount, bank_reference, confirmed_by, note)
      VALUES ($1,$2,$3,$4,$5) RETURNING *`, [orderId, payments.rows[0].amount, bankReference, userId, note || null]);
  } catch (error) { if (error.code === '23505') throw new AppError(409, 'Mã giao dịch hoàn tiền đã được sử dụng'); throw error; }
  await client.query(`UPDATE payments SET status = 'refunded', refunded_at = NOW(), refunded_by = $2,
    refund_reference = $3 WHERE order_id = $1 AND status = 'paid'`, [orderId, userId, bankReference]);
  await client.query(`UPDATE orders SET payment_status = 'refunded', updated_at = NOW() WHERE id = $1`, [orderId]);
  await recordOrderStateEvent(client, { orderId,
    note: 'Đã xác nhận hoàn tiền thủ công sau đối soát', changedBy: userId });
  return refund.rows[0];
});
