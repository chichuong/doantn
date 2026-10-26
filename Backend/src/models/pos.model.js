import { pool, query } from '../config/database.js';
import { changeStock } from './inventory.model.js';
import { directDeductStock } from '../services/inventory.service.js';
import { startIdempotency, finishIdempotency } from '../utils/idempotency.js';
import { AppError } from '../utils/app-error.js';
import { ORDER_STATUS, recordInitialOrderState, transitionOrder } from '../domain/order-state-machine.js';

export const findSaleProduct = async (identifier, warehouseId) => {
  const result = await query(
    `SELECT p.id, p.sku, p.barcode, p.name, p.sale_price,
       i.warehouse_id, i.quantity, i.reserved_quantity,
       (i.quantity - i.reserved_quantity)::int AS available_quantity
     FROM products p
     JOIN inventory i ON i.product_id = p.id AND i.warehouse_id = $2
     WHERE p.is_active = TRUE AND (p.sku = $1 OR p.barcode = $1)`,
    [identifier, warehouseId]
  );
  if (result.rowCount > 1) throw new AppError(409, 'Mã trùng giữa SKU và barcode của các sản phẩm; cần sửa định danh');
  return result.rows[0] || null;
};

export const getCurrentSession = async (userId) => {
  const result = await query(
    `SELECT s.id, s.warehouse_id, w.code AS warehouse_code, w.name AS warehouse_name,
       s.status, s.opening_cash, s.opened_at, s.updated_at,
       COALESCE(SUM(p.amount) FILTER (WHERE p.status = 'paid'), 0)::numeric(14,2) AS paid_sales
     FROM pos_sessions s JOIN warehouses w ON w.id = s.warehouse_id
     LEFT JOIN orders o ON o.pos_session_id = s.id AND o.channel = 'pos' AND o.status = 'delivered'
     LEFT JOIN payments p ON p.order_id = o.id
     WHERE s.opened_by = $1 AND s.status = 'open'
     GROUP BY s.id, w.id`,
    [userId]
  );
  return result.rows[0] || null;
};

export const openSession = async ({ warehouseId, userId, openingCash }) => {
  const result = await query(
    `INSERT INTO pos_sessions (warehouse_id, opened_by, opening_cash)
     VALUES ($1, $2, $3)
     RETURNING id, warehouse_id, opened_by, status, opening_cash, opened_at, updated_at`,
    [warehouseId, userId, openingCash]
  );
  return result.rows[0];
};

export const closeSession = async ({ sessionId, userId, closingCash }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const session = await client.query(
      `SELECT id, opened_by, status FROM pos_sessions WHERE id = $1 FOR UPDATE`,
      [sessionId]
    );
    if (!session.rows[0]) { const error = new Error('SESSION_NOT_FOUND'); error.code = 'SESSION_NOT_FOUND'; throw error; }
    if (session.rows[0].opened_by !== userId) { const error = new Error('SESSION_OWNER_REQUIRED'); error.code = 'SESSION_OWNER_REQUIRED'; throw error; }
    if (session.rows[0].status !== 'open') { const error = new Error('SESSION_NOT_OPEN'); error.code = 'SESSION_NOT_OPEN'; throw error; }
    const result = await client.query(
      `UPDATE pos_sessions SET status = 'closed', closing_cash = $2, closed_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING id, warehouse_id, opened_by, status, opening_cash, closing_cash, opened_at, closed_at, updated_at`,
      [sessionId, closingCash]
    );
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
};

const saleSelect = `
  o.id, o.order_number, o.channel, o.status, o.payment_status,
  o.customer_name, o.customer_phone, o.total_amount, o.created_by, o.warehouse_id, o.pos_session_id,
  o.created_at, o.updated_at
`;

export const listSales = async ({ userId, status, from, to, limit, offset }) => {
  const values = [userId, from, to];
  const conditions = ["o.channel = 'pos'", 'o.created_by = $1', 'o.created_at >= $2::date', "o.created_at < ($3::date + INTERVAL '1 day')"];
  if (status) { values.push(status); conditions.push(`o.status = $${values.length}`); }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const count = await query(`SELECT COUNT(*)::int AS total FROM orders o ${where}`, values);
  values.push(limit, offset);
  const result = await query(
    `SELECT ${saleSelect}, COUNT(oi.id)::int AS item_lines
     FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
     ${where} GROUP BY o.id ORDER BY o.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return { rows: result.rows, total: count.rows[0].total };
};

export const getSale = async (saleId, userId) => {
  const header = await query(
    `SELECT ${saleSelect} FROM orders o
     WHERE o.id = $1 AND o.created_by = $2 AND o.channel = 'pos'`,
    [saleId, userId]
  );
  if (!header.rows[0]) return null;
  const [items, payments] = await Promise.all([
    query(`SELECT oi.product_id, p.sku, p.barcode, p.name, oi.quantity, oi.unit_price, oi.line_total
           FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1`, [saleId]),
    query(`SELECT id, method, amount, status, transaction_reference, refund_reference, paid_at, refunded_at
           FROM payments WHERE order_id = $1 ORDER BY paid_at`, [saleId])
  ]);
  return { ...header.rows[0], items: items.rows, payments: payments.rows };
};

export const createSale = async ({ sessionId, userId, customerName, customerPhone, paymentMethod, transactionReference, items, orderNumber, idempotencyKey }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const operation = 'pos.sale';
    const orderedItems = [...items].sort((a, b) => a.productId.localeCompare(b.productId));
    const replay = await startIdempotency(client, { userId, operation, key: idempotencyKey,
      payload: { sessionId, customerName: customerName || null, customerPhone: customerPhone || null,
        paymentMethod, transactionReference: transactionReference || null, items: orderedItems } });
    if (replay) { await client.query('COMMIT'); return replay; }
    const session = await client.query(
      `SELECT id, warehouse_id, status FROM pos_sessions WHERE id = $1 AND opened_by = $2 FOR UPDATE`,
      [sessionId, userId]
    );
    if (!session.rows[0]) { const error = new Error('SESSION_NOT_FOUND'); error.code = 'SESSION_NOT_FOUND'; throw error; }
    if (session.rows[0].status !== 'open') { const error = new Error('SESSION_NOT_OPEN'); error.code = 'SESSION_NOT_OPEN'; throw error; }
    const warehouseId = session.rows[0].warehouse_id;
    const warehouse = await client.query('SELECT id FROM warehouses WHERE id = $1 AND is_active = TRUE FOR SHARE', [warehouseId]);
    if (!warehouse.rowCount) throw new AppError(409, 'Kho của ca POS đã ngừng hoạt động');

    const order = await client.query(
      `INSERT INTO orders (order_number, channel, status, payment_status, customer_name, customer_phone,
       created_by, warehouse_id, pos_session_id, idempotency_key)
       VALUES ($1, 'pos', 'delivered', 'paid', $2, $3, $4, $5, $6, $7) RETURNING id`,
      [orderNumber, customerName || null, customerPhone || null, userId, warehouseId, sessionId, idempotencyKey || null]
    );
    const deductionItems = [];
    for (const item of orderedItems) {
      const product = await client.query(
        `SELECT p.id, p.sale_price, i.quantity, i.reserved_quantity
         FROM products p JOIN inventory i ON i.product_id = p.id AND i.warehouse_id = $1
         WHERE p.id = $2 AND p.is_active = TRUE FOR SHARE OF p`,
        [session.rows[0].warehouse_id, item.productId]
      );
      const row = product.rows[0];
      if (!row) { const error = new Error('PRODUCT_NOT_AVAILABLE'); error.code = 'PRODUCT_NOT_AVAILABLE'; throw error; }
      if (Number(row.quantity) - Number(row.reserved_quantity) < item.quantity) { const error = new Error('INSUFFICIENT_STOCK'); error.code = 'INSUFFICIENT_STOCK'; throw error; }
      const line = await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4) RETURNING id`,
        [order.rows[0].id, item.productId, item.quantity, row.sale_price]
      );
      deductionItems.push({ productId: item.productId, quantity: item.quantity, orderItemId: line.rows[0].id });
    }
    await directDeductStock(client, { warehouseId, items: deductionItems, userId,
      posOrderId: order.rows[0].id, orderNumber });
    await client.query(`UPDATE orders SET total_amount = (
      SELECT COALESCE(SUM(line_total), 0) FROM order_items WHERE order_id = $1) WHERE id = $1`, [order.rows[0].id]);
    await client.query(
      `INSERT INTO payments (order_id, method, amount, transaction_reference, received_by)
       SELECT id, $2, total_amount, $3, $4 FROM orders WHERE id = $1 AND total_amount > 0`,
      [order.rows[0].id, paymentMethod, transactionReference || null, userId]
    );
    await recordInitialOrderState(client, { orderId: order.rows[0].id, status: ORDER_STATUS.DELIVERED,
      note: 'Bán và thanh toán tại POS', changedBy: userId });
    await finishIdempotency(client, { userId, operation, key: idempotencyKey, orderId: order.rows[0].id });
    await client.query('COMMIT');
    return order.rows[0].id;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
};

export const voidSale = async ({ saleId, userId, reason, refundConfirmed, refundReference }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await client.query(
      `SELECT id, order_number, status, warehouse_id, pos_session_id, payment_status, total_amount, updated_at
       FROM orders WHERE id = $1 AND created_by = $2 AND channel = 'pos' FOR UPDATE`,
      [saleId, userId]
    );
    if (!order.rows[0]) { const error = new Error('SALE_NOT_FOUND'); error.code = 'SALE_NOT_FOUND'; throw error; }
    if (order.rows[0].status === ORDER_STATUS.RETURNED && order.rows[0].payment_status === 'refunded') {
      await client.query('COMMIT'); return order.rows[0];
    }
    if (order.rows[0].status !== ORDER_STATUS.DELIVERED) { const error = new Error('SALE_NOT_COMPLETED'); error.code = 'SALE_NOT_COMPLETED'; throw error; }
    const payments = await client.query(`SELECT method, amount FROM payments WHERE order_id = $1 AND status = 'paid' FOR UPDATE`, [saleId]);
    if (payments.rowCount && refundConfirmed !== true) throw new AppError(409, 'Cần xác nhận đã hoàn tiền thực tế trước khi hủy giao dịch POS');
    if (payments.rows.some(payment => payment.method !== 'cash') && !refundReference) {
      throw new AppError(400, 'Giao dịch thẻ/chuyển khoản cần refundReference của lần hoàn tiền thực tế');
    }
    const warehouseId = order.rows[0].warehouse_id;
    if (!warehouseId || !order.rows[0].pos_session_id) {
      throw new AppError(409, 'Đơn POS cũ chưa xác định được kho/ca bán; cần đối soát trước khi hoàn tồn');
    }
    const items = await client.query('SELECT id, product_id, quantity FROM order_items WHERE order_id = $1 ORDER BY product_id', [saleId]);
    for (const item of items.rows) {
      await changeStock(client, { warehouseId, productId: item.product_id, delta: Number(item.quantity), type: 'receipt',
        referenceCode: order.rows[0].order_number, note: reason, userId, posOrderId: saleId,
        orderItemId: item.id, operationKey: `pos-void:${item.id}` });
    }
    await client.query(`UPDATE payments SET status = 'refunded', refunded_at = NOW(), refunded_by = $2,
      refund_reference = $3 WHERE order_id = $1 AND status = 'paid'`, [saleId, userId, refundReference || null]);
    await client.query(`UPDATE orders SET payment_status = 'refunded', updated_at = NOW() WHERE id = $1`, [saleId]);
    const updated = await transitionOrder(client, { orderId: saleId, toStatus: ORDER_STATUS.RETURNED,
      expectedFrom: ORDER_STATUS.DELIVERED, note: reason, changedBy: userId });
    await client.query('COMMIT');
    return updated;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
};
