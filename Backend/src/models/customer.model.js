import { pool, query } from '../config/database.js';
import { reserveStock } from '../services/inventory.service.js';
import { ORDER_STATUS, recordInitialOrderState } from '../domain/order-state-machine.js';
import { cancelOnlineOrder } from './order-cancellation.model.js';
import { startIdempotency, finishIdempotency } from '../utils/idempotency.js';
import { withTransaction } from '../utils/transaction.js';
import { env } from '../config/env.js';

export const listCatalog = async ({ search, categoryId, limit, offset }) => {
  const values = [];
  const conditions = ['p.is_active = TRUE'];
  if (search) { values.push(`%${search}%`); conditions.push(`(p.name ILIKE $${values.length} OR p.sku ILIKE $${values.length} OR COALESCE(p.barcode, '') ILIKE $${values.length})`); }
  if (categoryId) { values.push(categoryId); conditions.push(`p.category_id = $${values.length}`); }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const count = await query(`SELECT COUNT(*)::int AS total FROM products p ${where}`, values);
  values.push(limit, offset);
  const result = await query(
    `SELECT p.id, p.sku, p.barcode, p.name, p.description, p.category_id,
       c.name AS category_name, p.sale_price, p.sale_price AS price, p.reorder_level,
       p.image_url, p.image_url AS "imageUrl",
       COALESCE(SUM(i.quantity - i.reserved_quantity), 0) AS available_quantity,
       COALESCE(SUM(i.quantity - i.reserved_quantity), 0) AS available_stock
     FROM products p LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN inventory i ON i.product_id = p.id AND i.warehouse_id IN (SELECT id FROM warehouses WHERE is_active = 1)
     ${where}
     GROUP BY p.id, p.sku, p.barcode, p.name, p.description, p.category_id, c.name, p.sale_price, p.reorder_level, p.image_url
     ORDER BY p.name ASC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return { rows: result.rows, total: count.rows[0].total };
};

const cartSelect = `
  ci.id AS cart_item_id, ci.product_id, p.sku, p.barcode, p.name, p.name AS product_name,
  p.image_url, p.image_url AS "imageUrl",
  p.sale_price, p.sale_price AS price, ci.quantity,
  COALESCE((SELECT SUM(i.quantity - i.reserved_quantity) FROM inventory i JOIN warehouses w ON w.id = i.warehouse_id WHERE i.product_id = p.id AND w.is_active = 1), 0) AS available_quantity,
  COALESCE((SELECT SUM(i.quantity - i.reserved_quantity) FROM inventory i JOIN warehouses w ON w.id = i.warehouse_id WHERE i.product_id = p.id AND w.is_active = 1), 0) AS available_stock,
  CAST(p.sale_price * ci.quantity AS DECIMAL(14,2)) AS line_total
`;

export const getOrCreateCart = async (userId) => {
  await query(
    `MERGE INTO carts AS target
     USING (SELECT $1 AS user_id) AS source ON target.user_id = source.user_id
     WHEN MATCHED THEN UPDATE SET updated_at = NOW()
     WHEN NOT MATCHED THEN INSERT (user_id) VALUES (source.user_id);`,
    [userId]
  );
  const result = await query(`SELECT id, user_id, created_at, updated_at FROM carts WHERE user_id = $1`, [userId]);
  return result.rows[0];
};

export const getCart = async (userId) => {
  const cart = await getOrCreateCart(userId);
  const items = await query(
    `SELECT ${cartSelect} FROM cart_items ci JOIN products p ON p.id = ci.product_id
     WHERE ci.cart_id = $1 ORDER BY ci.created_at ASC`,
    [cart.id]
  );
  const total = items.rows.reduce((sum, item) => sum + Number(item.line_total), 0);
  return { ...cart, items: items.rows, total_amount: total.toFixed(2) };
};

export const upsertCartItem = async (userId, productId, quantity) => {
  return withTransaction(async (client) => {
    await client.query(
      `MERGE INTO carts AS target
       USING (SELECT $1 AS user_id) AS source ON target.user_id = source.user_id
       WHEN MATCHED THEN UPDATE SET updated_at = NOW()
       WHEN NOT MATCHED THEN INSERT (user_id) VALUES (source.user_id);`,
      [userId]
    );
    const cart = await client.query(`SELECT id FROM carts WHERE user_id = $1`, [userId]);
    const product = await client.query('SELECT id, is_active FROM products WHERE id = $1', [productId]);
    if (!product.rows[0] || !product.rows[0].is_active) { const error = new Error('PRODUCT_NOT_FOUND'); error.code = 'PRODUCT_NOT_FOUND'; throw error; }
    await client.query(
      `MERGE INTO cart_items AS target
       USING (SELECT $1 AS cart_id, $2 AS product_id, $3 AS quantity) AS source
       ON target.cart_id = source.cart_id AND target.product_id = source.product_id
       WHEN MATCHED THEN UPDATE SET quantity = source.quantity, updated_at = NOW()
       WHEN NOT MATCHED THEN INSERT (cart_id, product_id, quantity) VALUES (source.cart_id, source.product_id, source.quantity);`,
      [cart.rows[0].id, productId, quantity]
    );
    const result = await client.query(
      `SELECT id, cart_id, product_id, quantity, updated_at FROM cart_items WHERE cart_id = $1 AND product_id = $2`,
      [cart.rows[0].id, productId]
    );
    return result.rows[0];
  });
};

export const removeCartItem = async (userId, productId) => {
  return withTransaction(async (client) => {
    await client.query('SELECT id FROM carts WHERE user_id = $1 FOR UPDATE', [userId]);
    const result = await client.query(
      `DELETE ci OUTPUT DELETED.id
       FROM cart_items ci
       JOIN carts c ON ci.cart_id = c.id
       WHERE c.user_id = $1 AND ci.product_id = $2`,
      [userId, productId]
    );
    return result.rowCount > 0;
  });
};

export const listAddresses = async (userId) => {
  const result = await query(
    `SELECT id, recipient_name, phone, address_line, ward, district, province, is_default, created_at, updated_at
     FROM customer_addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
    [userId]
  );
  return result.rows;
};

export const createAddress = async (userId, input) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR NO KEY UPDATE', [userId]);
    if (input.isDefault) await client.query('UPDATE customer_addresses SET is_default = FALSE, updated_at = NOW() WHERE user_id = $1', [userId]);
    const result = await client.query(
      `INSERT INTO customer_addresses (user_id, recipient_name, phone, address_line, ward, district, province, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, recipient_name, phone, address_line, ward, district, province, is_default, created_at, updated_at`,
      [userId, input.recipientName, input.phone, input.addressLine, input.ward || null, input.district || null, input.province, input.isDefault]
    );
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
};

export const updateAddress = (userId, addressId, input) => withTransaction(async (client) => {
  await client.query('SELECT id FROM users WHERE id = $1 FOR NO KEY UPDATE', [userId]);
  const existing = await client.query('SELECT id FROM customer_addresses WHERE id = $1 AND user_id = $2 FOR UPDATE', [addressId, userId]);
  if (!existing.rowCount) return null;
  if (input.isDefault === true) await client.query('UPDATE customer_addresses SET is_default = FALSE WHERE user_id = $1', [userId]);
  const result = await client.query(`UPDATE customer_addresses SET
    recipient_name = COALESCE($3, recipient_name), phone = COALESCE($4, phone), address_line = COALESCE($5, address_line),
    province = COALESCE($6, province), is_default = COALESCE($7, is_default),
    ward = CASE WHEN $8 = 1 THEN $9 ELSE ward END, district = CASE WHEN $10 = 1 THEN $11 ELSE district END,
    updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *`,
    [addressId, userId, input.recipientName ?? null, input.phone ?? null, input.addressLine ?? null,
      input.province ?? null, input.isDefault ?? null, Object.hasOwn(input, 'ward') ? 1 : 0, input.ward ?? null,
      Object.hasOwn(input, 'district') ? 1 : 0, input.district ?? null]);
  return result.rows[0];
});

export const deleteAddress = (userId, addressId) => withTransaction(async (client) => {
  await client.query('SELECT id FROM users WHERE id = $1 FOR NO KEY UPDATE', [userId]);
  const result = await client.query('DELETE FROM customer_addresses WHERE id = $1 AND user_id = $2 RETURNING id', [addressId, userId]);
  return result.rowCount > 0;
});

export const checkout = async ({ userId, warehouseId, addressId, channel, paymentMethod, transactionReference, customerName, customerPhone, note, orderNumber, idempotencyKey }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const operation = 'customer.checkout';
    const isTransfer = paymentMethod === 'transfer';
    const replay = await startIdempotency(client, { userId, operation, key: idempotencyKey,
      payload: { warehouseId, addressId: addressId || null, channel, paymentMethod: paymentMethod || 'cod', customerName: customerName || null,
        customerPhone: customerPhone || null, note: note || null } });
    if (replay) { await client.query('COMMIT'); return replay; }
    const warehouse = await client.query('SELECT id FROM warehouses WHERE id = $1 AND is_active = TRUE FOR SHARE', [warehouseId]);
    if (!warehouse.rowCount) throw Object.assign(new Error('WAREHOUSE_NOT_ACTIVE'), { code: 'WAREHOUSE_NOT_ACTIVE' });
    const cart = await client.query('SELECT id FROM carts WHERE user_id = $1 FOR UPDATE', [userId]);
    if (!cart.rows[0]) { const error = new Error('CART_EMPTY'); error.code = 'CART_EMPTY'; throw error; }
    const items = await client.query(
      `SELECT ci.product_id, ci.quantity, p.sale_price, p.name, p.is_active
       FROM cart_items ci JOIN products p ON p.id = ci.product_id
       WHERE ci.cart_id = $1 ORDER BY ci.product_id FOR SHARE OF p`,
      [cart.rows[0].id]
    );
    if (!items.rows.length) { const error = new Error('CART_EMPTY'); error.code = 'CART_EMPTY'; throw error; }
    let addressSnapshot = null;
    if (addressId) {
      const address = await client.query(`SELECT recipient_name, phone, address_line, ward, district, province
        FROM customer_addresses WHERE id = $1 AND user_id = $2 FOR SHARE`, [addressId, userId]);
      if (!address.rows[0]) { const error = new Error('ADDRESS_NOT_FOUND'); error.code = 'ADDRESS_NOT_FOUND'; throw error; }
      addressSnapshot = address.rows[0];
    }
    for (const item of items.rows) {
      if (!item.is_active) throw Object.assign(new Error('PRODUCT_NOT_ACTIVE'), { code: 'PRODUCT_NOT_ACTIVE' });
    }
    const order = await client.query(
      `INSERT INTO orders (order_number, channel, status, payment_status, customer_name, customer_phone, total_amount,
       warehouse_id, shipping_address_id, created_by, shipping_address_snapshot, idempotency_key)
       VALUES ($1, $2, 'pending', $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11) RETURNING id`,
      [orderNumber, channel, isTransfer ? 'paid' : 'unpaid', customerName || addressSnapshot?.recipient_name || null,
        customerPhone || addressSnapshot?.phone || null, 0, warehouseId, addressId || null, userId,
        addressSnapshot ? JSON.stringify(addressSnapshot) : null, idempotencyKey || null]
    );
    const reservationItems = [];
    for (const item of items.rows) {
      const line = await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4) RETURNING id`,
        [order.rows[0].id, item.product_id, item.quantity, item.sale_price]
      );
      reservationItems.push({ orderItemId: line.rows[0].id, warehouseId,
        productId: item.product_id, quantity: Number(item.quantity) });
    }
    await client.query(`UPDATE orders SET total_amount = (
      SELECT COALESCE(SUM(line_total), 0) FROM order_items WHERE order_id = $1) WHERE id = $1`, [order.rows[0].id]);
    if (isTransfer) {
      const txRef = transactionReference || `VIETQR-${orderNumber.slice(-8)}-${Date.now().toString().slice(-4)}`;
      await client.query(
        `INSERT INTO payments (order_id, method, amount, transaction_reference, received_by)
         SELECT id, 'transfer', total_amount, $2, $3 FROM orders WHERE id = $1 AND total_amount > 0`,
        [order.rows[0].id, txRef, userId]
      );
    }
    let expiresAt = null;
    if (!isTransfer && Number.isInteger(env.reservationTtlMinutes) && env.reservationTtlMinutes > 0) {
      const expiry = await client.query(`UPDATE orders SET reservation_expires_at = NOW() + ($2 * INTERVAL '1 minute') WHERE id = $1
        RETURNING reservation_expires_at`,
        [order.rows[0].id, env.reservationTtlMinutes]);
      expiresAt = expiry.rows[0].reservation_expires_at;
    }
    await reserveStock(client, { items: reservationItems, expiresAt });
    await recordInitialOrderState(client, { orderId: order.rows[0].id, status: ORDER_STATUS.PENDING,
      note: note || (isTransfer ? 'Đơn hàng mới (Đã thanh toán VietQR)' : 'Đơn hàng mới (Thanh toán COD)'), changedBy: userId });
    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cart.rows[0].id]);
    await client.query('UPDATE carts SET updated_at = NOW() WHERE id = $1', [cart.rows[0].id]);
    await finishIdempotency(client, { userId, operation, key: idempotencyKey, orderId: order.rows[0].id });
    await client.query('COMMIT');
    return order.rows[0].id;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
};

const orderSelect = `o.id, o.order_number, o.channel, o.status, o.payment_status,
  o.customer_name, o.customer_phone, o.total_amount, o.warehouse_id,
  o.shipping_address_id, o.shipping_address_snapshot, o.reservation_expires_at, o.created_at, o.updated_at`;

export const listOrders = async (userId, { status, limit, offset }) => {
  const values = [userId];
  const conditions = ['o.created_by = $1', "o.channel IN ('web', 'mobile')"];
  if (status) { values.push(status); conditions.push(`o.status = $${values.length}`); }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const count = await query(`SELECT COUNT(*)::int AS total FROM orders o ${where}`, values);
  values.push(limit, offset);
  const result = await query(
    `SELECT ${orderSelect}, COUNT(oi.id) AS item_lines, COALESCE(SUM(oi.quantity), 0) AS item_count, COALESCE(SUM(oi.quantity), 0) AS total_items
     FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
     ${where}
     GROUP BY ${orderSelect}
     ORDER BY o.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return { rows: result.rows, total: count.rows[0].total };
};

export const getOrder = async (userId, orderId) => {
  const header = await query(`SELECT ${orderSelect} FROM orders o WHERE o.id = $1 AND o.created_by = $2 AND o.channel IN ('web', 'mobile')`, [orderId, userId]);
  if (!header.rows[0]) return null;
  const [items, history, shipment, payments] = await Promise.all([
    query(`SELECT oi.id AS order_item_id, oi.product_id, p.sku, p.barcode, p.name, p.name AS product_name, p.image_url, p.image_url AS "imageUrl", oi.quantity, oi.unit_price, oi.line_total FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1`, [orderId]),
    query(`SELECT id, from_status, status, note, changed_by, created_at FROM order_status_history WHERE order_id = $1 ORDER BY created_at ASC`, [orderId]),
    query(`SELECT s.tracking_number, s.carrier, s.status, s.picked_up_at, s.delivered_at, s.failed_at,
      COALESCE((
        SELECT h.status, h.note, h.created_at
        FROM shipment_status_history h
        WHERE h.shipment_id = s.id
        ORDER BY h.created_at ASC
        FOR JSON PATH
      ), '[]') AS status_history
      FROM shipments s WHERE s.order_id = $1`, [orderId]),
    query(`SELECT id, method, amount, status, transaction_reference, paid_at FROM payments WHERE order_id = $1 ORDER BY paid_at`, [orderId])
  ]);
  const firstPayment = payments.rows[0] || null;
  return {
    ...header.rows[0],
    payment_method: firstPayment?.method || 'cod',
    transaction_reference: firstPayment?.transaction_reference || null,
    items: items.rows,
    status_history: history.rows,
    shipment: shipment.rows[0] || null
  };
};

export const cancelOrder = (userId, orderId, note) => cancelOnlineOrder({ orderId, userId, note, customerOnly: true });
