import { pool, query } from '../config/database.js';
import { changeStock } from './inventory.model.js';
import { consumeReservation } from '../services/inventory.service.js';
import { ORDER_STATUS, transitionOrder } from '../domain/order-state-machine.js';
import { AppError } from '../utils/app-error.js';

const documentSelect = `
  d.id, d.document_number, d.warehouse_id, w.code AS warehouse_code,
  w.name AS warehouse_name, d.type, d.status, d.require_scan, d.supplier_name,
  d.reference_code, d.note, d.created_by, d.completed_by,
  d.completed_at, d.created_at, d.updated_at
`;

export const findProductByIdentifier = async (identifier, warehouseId) => {
  const values = [identifier];
  const warehouseFilter = warehouseId ? 'AND i.warehouse_id = $2' : '';
  if (warehouseId) values.push(warehouseId);
  const result = await query(
    `SELECT p.id, p.sku, p.barcode, p.name, p.sale_price, p.reorder_level,
       COALESCE(i.quantity, 0)::int AS quantity,
       COALESCE(i.reserved_quantity, 0)::int AS reserved_quantity,
       (COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0))::int AS available_quantity,
       i.warehouse_id
     FROM products p
     LEFT JOIN inventory i ON i.product_id = p.id ${warehouseFilter}
     WHERE p.is_active = TRUE AND (p.sku = $1 OR p.barcode = $1)
     ORDER BY i.warehouse_id NULLS LAST
     LIMIT 1`,
    values
  );
  return result.rows[0] || null;
};

export const listDocuments = async ({ warehouseId, type, status, limit, offset }) => {
  const values = [];
  const conditions = [];
  if (warehouseId) { values.push(warehouseId); conditions.push(`d.warehouse_id = $${values.length}`); }
  if (type) { values.push(type); conditions.push(`d.type = $${values.length}`); }
  if (status) { values.push(status); conditions.push(`d.status = $${values.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countResult = await query(`SELECT COUNT(*)::int AS total FROM warehouse_documents d ${where}`, values);
  values.push(limit, offset);
  const result = await query(
    `SELECT ${documentSelect}, COUNT(i.id)::int AS item_lines,
       COALESCE(SUM(i.quantity), 0)::int AS total_quantity
     FROM warehouse_documents d
     JOIN warehouses w ON w.id = d.warehouse_id
     LEFT JOIN warehouse_document_items i ON i.document_id = d.id
     ${where}
     GROUP BY d.id, w.id ORDER BY d.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return { rows: result.rows, total: countResult.rows[0].total };
};

export const getDocument = async (documentId) => {
  const header = await query(
    `SELECT ${documentSelect} FROM warehouse_documents d
     JOIN warehouses w ON w.id = d.warehouse_id WHERE d.id = $1`,
    [documentId]
  );
  if (!header.rows[0]) return null;
  const items = await query(
    `SELECT i.id, i.product_id, p.sku, p.barcode, p.name, i.quantity, i.unit_cost
     FROM warehouse_document_items i JOIN products p ON p.id = i.product_id
     WHERE i.document_id = $1 ORDER BY p.name`,
    [documentId]
  );
  return { ...header.rows[0], items: items.rows };
};

export const createDocument = async ({ documentNumber, warehouseId, type, supplierName, referenceCode, note, createdBy, items }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const header = await client.query(
      `INSERT INTO warehouse_documents
       (document_number, warehouse_id, type, supplier_name, reference_code, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [documentNumber, warehouseId, type, supplierName || null, referenceCode || null, note || null, createdBy]
    );
    for (const item of items) {
      await client.query(
        `INSERT INTO warehouse_document_items (document_id, product_id, quantity, unit_cost)
         VALUES ($1, $2, $3, $4)`,
        [header.rows[0].id, item.productId, item.quantity, item.unitCost]
      );
    }
    await client.query('COMMIT');
    return getDocument(header.rows[0].id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const completeDocument = async (documentId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const document = await client.query(
      `SELECT id, document_number, warehouse_id, type, status, require_scan
       FROM warehouse_documents WHERE id = $1 FOR UPDATE`,
      [documentId]
    );
    if (!document.rows[0]) {
      const error = new Error('DOCUMENT_NOT_FOUND');
      error.code = 'DOCUMENT_NOT_FOUND';
      throw error;
    }
    const header = document.rows[0];
    if (header.status === 'completed') { await client.query('COMMIT'); return getDocument(documentId); }
    if (header.status !== 'draft') {
      const error = new Error('DOCUMENT_NOT_DRAFT');
      error.code = 'DOCUMENT_NOT_DRAFT';
      throw error;
    }
    const items = await client.query(
      `SELECT product_id, quantity, unit_cost FROM warehouse_document_items
       WHERE document_id = $1 ORDER BY product_id`,
      [documentId]
    );
    if (!items.rows.length) {
      const error = new Error('DOCUMENT_EMPTY');
      error.code = 'DOCUMENT_EMPTY';
      throw error;
    }
    if (header.require_scan) {
      const unchecked = await client.query(`SELECT di.id FROM warehouse_document_items di
        LEFT JOIN warehouse_document_scan_events e ON e.document_item_id = di.id WHERE di.document_id = $1
        GROUP BY di.id HAVING di.quantity <> COALESCE(SUM(e.quantity), 0)`, [documentId]);
      if (unchecked.rowCount) throw new AppError(409, 'Phải quét kiểm tra đủ sản phẩm và số lượng trước khi hoàn tất chứng từ');
    }

    for (const item of items.rows) {
      const delta = header.type === 'receipt' ? Number(item.quantity) : -Number(item.quantity);
      await changeStock(client, { warehouseId: header.warehouse_id, productId: item.product_id, delta,
        type: header.type, referenceCode: header.document_number, note: 'Hoàn tất chứng từ kho', userId,
        documentId, operationKey: `warehouse-document:${documentId}:${item.product_id}` });
    }
    await client.query(
      `UPDATE warehouse_documents SET status = 'completed', completed_by = $2,
       completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [documentId, userId]
    );
    await client.query('COMMIT');
    return getDocument(documentId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const listFulfillableOrders = async ({ status, warehouseId, limit, offset }) => {
  const values = [status || 'ready_to_pack', warehouseId || null];
  const count = await query(`SELECT COUNT(*)::int AS total FROM orders
    WHERE status = $1 AND channel IN ('web', 'mobile') AND ($2::uuid IS NULL OR warehouse_id = $2)`, values);
  values.push(limit, offset);
  const result = await query(
    `SELECT o.id, o.order_number, o.channel, o.status, o.payment_status,
       o.customer_name, o.customer_phone, o.total_amount, o.warehouse_id, o.created_at,
       JSON_AGG(JSON_BUILD_OBJECT(
         'productId', p.id, 'sku', p.sku, 'name', p.name,
         'quantity', i.quantity, 'unitPrice', i.unit_price
       ) ORDER BY p.name) AS items
     FROM orders o JOIN order_items i ON i.order_id = o.id
     JOIN products p ON p.id = i.product_id
     WHERE o.status = $1 AND o.channel IN ('web', 'mobile') AND ($2::uuid IS NULL OR o.warehouse_id = $2)
     GROUP BY o.id ORDER BY o.created_at ASC
     LIMIT $3 OFFSET $4`,
    values
  );
  return { rows: result.rows, total: count.rows[0].total };
};

export const packOrder = async ({ orderId, warehouseId, userId }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const orderResult = await client.query(
      `SELECT id, order_number, channel, warehouse_id, status, payment_status, total_amount, updated_at
       FROM orders WHERE id = $1 AND channel IN ('web', 'mobile') FOR UPDATE`,
      [orderId]
    );
    if (!orderResult.rows[0]) {
      const error = new Error('ORDER_NOT_FOUND');
      error.code = 'ORDER_NOT_FOUND';
      throw error;
    }
    const order = orderResult.rows[0];
    if (!order.warehouse_id || (warehouseId && warehouseId !== order.warehouse_id)) {
      throw new AppError(409, 'Kho đóng gói phải trùng kho đã giữ hàng của đơn');
    }
    warehouseId = order.warehouse_id;
    if (order.status === 'packed') { await client.query('COMMIT'); return order; }
    if (order.status !== ORDER_STATUS.READY_TO_PACK) {
      const error = new Error('ORDER_NOT_FULFILLABLE');
      error.code = 'ORDER_NOT_FULFILLABLE';
      throw error;
    }
    const task = await client.query('SELECT status FROM order_processing_tasks WHERE order_id = $1 FOR UPDATE', [orderId]);
    if (task.rows[0]?.status !== 'ready_to_pack') throw new AppError(409, 'Tác vụ phải hoàn tất lấy hàng trước khi đóng gói');
    const items = await client.query(
      `SELECT id, product_id, quantity FROM order_items WHERE order_id = $1 ORDER BY product_id`,
      [orderId]
    );
    if (!items.rowCount) throw new AppError(409, 'Đơn hàng không có sản phẩm');
    const checks = await client.query(`SELECT oi.id FROM order_items oi
      LEFT JOIN order_scan_events e ON e.order_item_id = oi.id WHERE oi.order_id = $1
      GROUP BY oi.id HAVING oi.quantity <> COALESCE(SUM(e.quantity), 0)`, [orderId]);
    if (checks.rowCount) throw new AppError(409, 'Phải quét kiểm tra đủ sản phẩm và số lượng trước khi đóng gói');
    await consumeReservation(client, { orderId, orderNumber: order.order_number, userId });
    const updated = await transitionOrder(client, { orderId, toStatus: ORDER_STATUS.PACKED,
      expectedFrom: ORDER_STATUS.READY_TO_PACK, note: 'Đóng gói và xác nhận xuất kho', changedBy: userId });
    await client.query('COMMIT');
    return updated.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
