import { pool, query } from '../config/database.js';
import { changeStock } from './inventory.model.js';
import { consumeReservation } from '../services/inventory.service.js';
import { ORDER_STATUS, transitionOrder } from '../domain/order-state-machine.js';
import { AppError } from '../utils/app-error.js';

const documentSelect = `
  d.id, d.document_number, d.warehouse_id, w.code AS warehouse_code,
  w.name AS warehouse_name, d.type, d.status, d.require_scan, d.supplier_name,
  d.reference_code, d.note, d.created_by, u_cr.full_name AS creator_name,
  d.approved_by, u_app.full_name AS approver_name, d.approved_at,
  d.rejected_by, u_rej.full_name AS rejecter_name, d.rejected_at, d.rejection_reason,
  d.qr_code, d.qr_scanned_at, d.qr_scanned_source, d.qr_scanned_by, u_scan.full_name AS qr_scanned_by_name,
  d.completed_by, u_comp.full_name AS completer_name,
  d.completed_at, d.created_at, d.updated_at
`;

const documentJoins = `
  JOIN warehouses w ON w.id = d.warehouse_id
  LEFT JOIN users u_cr ON u_cr.id = d.created_by
  LEFT JOIN users u_app ON u_app.id = d.approved_by
  LEFT JOIN users u_rej ON u_rej.id = d.rejected_by
  LEFT JOIN users u_comp ON u_comp.id = d.completed_by
  LEFT JOIN users u_scan ON u_scan.id = d.qr_scanned_by
`;

export const findProductByIdentifier = async (identifier, warehouseId) => {
  const values = [identifier];
  const warehouseFilter = warehouseId ? 'AND i.warehouse_id = $2' : '';
  if (warehouseId) values.push(warehouseId);
  const result = await query(
    `SELECT p.id, p.sku, p.barcode, p.name, p.sale_price, p.reorder_level, p.image_url, p.image_url AS "imageUrl",
       COALESCE(i.quantity, 0)::int AS quantity,
       COALESCE(i.reserved_quantity, 0)::int AS reserved_quantity,
       (COALESCE(i.quantity, 0) - COALESCE(i.reserved_quantity, 0))::int AS available_quantity,
       i.warehouse_id
     FROM products p
     LEFT JOIN inventory i ON i.product_id = p.id ${warehouseFilter}
     WHERE p.is_active = TRUE AND p.sku = $1
     ORDER BY i.warehouse_id NULLS LAST
     LIMIT 1`,
    values
  );
  return result.rows[0] || null;
};

export const listDocuments = async ({ warehouseId, type, status, search, limit, offset }) => {
  const values = [];
  const conditions = [];
  if (warehouseId) { values.push(warehouseId); conditions.push(`d.warehouse_id = $${values.length}`); }
  if (type) { values.push(type); conditions.push(`d.type = $${values.length}`); }
  if (status) { values.push(status); conditions.push(`d.status = $${values.length}`); }
  if (search) {
    values.push(`%${search.trim()}%`);
    conditions.push(`(d.document_number ILIKE $${values.length} OR d.reference_code ILIKE $${values.length} OR d.supplier_name ILIKE $${values.length})`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countResult = await query(`SELECT COUNT(*)::int AS total FROM warehouse_documents d ${where}`, values);
  values.push(limit, offset);
  const result = await query(
    `SELECT ${documentSelect},
       (SELECT COUNT(*) FROM warehouse_document_items i WHERE i.document_id = d.id) AS item_lines,
       COALESCE((SELECT SUM(i.quantity) FROM warehouse_document_items i WHERE i.document_id = d.id), 0) AS total_quantity
     FROM warehouse_documents d
     ${documentJoins}
     ${where}
     ORDER BY d.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return { rows: result.rows, total: countResult.rows[0].total };
};

export const getDocument = async (documentId) => {
  const header = await query(
    `SELECT ${documentSelect} FROM warehouse_documents d
     ${documentJoins} WHERE d.id = $1`,
    [documentId]
  );
  if (!header.rows[0]) return null;
  const items = await query(
    `SELECT i.id, i.product_id, p.sku, p.barcode, p.name, p.image_url, p.image_url AS "imageUrl", i.quantity, i.actual_quantity, i.unit_cost
     FROM warehouse_document_items i JOIN products p ON p.id = i.product_id
     WHERE i.document_id = $1 ORDER BY p.name`,
    [documentId]
  );
  return { ...header.rows[0], items: items.rows };
};

export const getDocumentByQr = async (identifier) => {
  const clean = String(identifier || '').trim();
  if (!clean) throw new AppError(400, 'Mã định danh hoặc mã QR là bắt buộc');
  const rawNumber = clean.startsWith('DOC:') ? clean.slice(4).trim() : clean;
  const prefixed = clean.startsWith('DOC:') ? clean : `DOC:${clean}`;
  const res = await query(
    `SELECT id FROM warehouse_documents
     WHERE qr_code = $1 OR qr_code = $2 OR document_number = $1 OR document_number = $3 OR CAST(id AS VARCHAR(36)) = $1
     LIMIT 1`,
    [clean, prefixed, rawNumber]
  );
  if (!res.rows[0]) {
    throw new AppError(404, 'Không tìm thấy chứng từ theo mã QR hoặc mã phiếu');
  }
  return getDocument(res.rows[0].id);
};

export const recordDocumentQrScan = async (documentId, userId, source) => {
  await query(
    `UPDATE warehouse_documents
     SET qr_scanned_at = NOW(), qr_scanned_by = $2, qr_scanned_source = $3, updated_at = NOW()
     WHERE id = $1 AND status = 'approved'`,
    [documentId, userId, source]
  );
  return getDocument(documentId);
};

export const createDocument = async ({ documentNumber, warehouseId, type, supplierName, referenceCode, note, createdBy, items }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const header = await client.query(
      `INSERT INTO warehouse_documents
       (document_number, warehouse_id, type, status, supplier_name, reference_code, note, created_by)
       VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7)
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

export const approveDocument = async (documentId, userId, userRole) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const docRes = await client.query(
      `SELECT id, document_number, status, created_by, type, warehouse_id
       FROM warehouse_documents WHERE id = $1 FOR UPDATE`,
      [documentId]
    );
    if (!docRes.rows[0]) {
      throw new AppError(404, 'Không tìm thấy chứng từ kho');
    }
    const doc = docRes.rows[0];
    if (doc.status === 'approved') {
      await client.query('COMMIT');
      return getDocument(documentId);
    }
    if (doc.status !== 'pending' && doc.status !== 'draft') {
      throw new AppError(409, `Không thể phê duyệt chứng từ ở trạng thái ${doc.status}`);
    }
    if (doc.created_by === userId && userRole !== 'admin') {
      throw new AppError(403, 'Nhân viên không thể tự phê duyệt yêu cầu do chính mình tạo');
    }
    const qrCode = `DOC:${doc.document_number}`;
    await client.query(
      `UPDATE warehouse_documents
       SET status = 'approved', approved_by = $2, approved_at = NOW(), qr_code = $3, updated_at = NOW()
       WHERE id = $1`,
      [documentId, userId, qrCode]
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

export const rejectDocument = async (documentId, userId, reason) => {
  if (!reason || !String(reason).trim()) {
    throw new AppError(400, 'Lý do từ chối là bắt buộc');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const docRes = await client.query(
      `SELECT id, document_number, status FROM warehouse_documents WHERE id = $1 FOR UPDATE`,
      [documentId]
    );
    if (!docRes.rows[0]) {
      throw new AppError(404, 'Không tìm thấy chứng từ kho');
    }
    const doc = docRes.rows[0];
    if (doc.status === 'rejected') {
      await client.query('COMMIT');
      return getDocument(documentId);
    }
    if (doc.status !== 'pending' && doc.status !== 'draft') {
      throw new AppError(409, `Không thể từ chối chứng từ ở trạng thái ${doc.status}`);
    }
    await client.query(
      `UPDATE warehouse_documents
       SET status = 'rejected', rejected_by = $2, rejected_at = NOW(),
           rejection_reason = $3, updated_at = NOW()
       WHERE id = $1`,
      [documentId, userId, String(reason).trim()]
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

export const completeDocument = async (documentId, userId, actualItems = null) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const document = await client.query(
      `SELECT id, document_number, warehouse_id, type, status, require_scan, qr_scanned_at
       FROM warehouse_documents WHERE id = $1 FOR UPDATE`,
      [documentId]
    );
    if (!document.rows[0]) {
      const error = new Error('DOCUMENT_NOT_FOUND');
      error.code = 'DOCUMENT_NOT_FOUND';
      throw error;
    }
    const header = document.rows[0];
    if (header.status === 'completed') {
      await client.query('COMMIT');
      return getDocument(documentId);
    }
    if (header.status !== 'approved' && header.status !== 'draft') {
      if (header.status === 'pending') {
        throw new AppError(409, 'Chứng từ chưa được phê duyệt. Vui lòng chờ Quản lý phê duyệt trước khi nhập/xuất kho.');
      }
      if (header.status === 'rejected') {
        throw new AppError(409, 'Chứng từ đã bị từ chối, không thể thực hiện nhập/xuất kho.');
      }
      const error = new Error('DOCUMENT_NOT_DRAFT');
      error.code = 'DOCUMENT_NOT_DRAFT';
      throw error;
    }
    if (!header.qr_scanned_at) {
      throw new AppError(409, 'Chứng từ chưa được quét mã QR đối soát qua thiết bị IoT ESP32-S3 hoặc App kho. Vui lòng quét mã QR trước khi xác nhận hoàn tất.');
    }
    const items = await client.query(
      `SELECT id, product_id, quantity, actual_quantity, unit_cost
       FROM warehouse_document_items
       WHERE document_id = $1 ORDER BY product_id`,
      [documentId]
    );
    if (!items.rows.length) {
      const error = new Error('DOCUMENT_EMPTY');
      error.code = 'DOCUMENT_EMPTY';
      throw error;
    }

    const actualMap = new Map();
    if (Array.isArray(actualItems) && actualItems.length > 0) {
      for (const item of actualItems) {
        const pid = String(item.productId || item.product_id || '').toLowerCase();
        const rawQty = item.actualQuantity ?? item.actual_quantity ?? item.quantity;
        const q = Number(rawQty);
        if (pid && Number.isInteger(q) && q >= 0) {
          actualMap.set(pid, q);
        }
      }
    }

    if (header.require_scan && (!actualItems || actualItems.length === 0)) {
      const scanCounts = await client.query(
        `SELECT di.id, di.quantity, COALESCE(SUM(e.quantity), 0) AS scanned_qty
         FROM warehouse_document_items di
         LEFT JOIN warehouse_document_scan_events e ON e.document_item_id = di.id
         WHERE di.document_id = $1
         GROUP BY di.id, di.quantity`,
        [documentId]
      );
      const hasAnyScan = scanCounts.rows.some(r => r.scanned_qty > 0);
      if (hasAnyScan) {
        const unchecked = scanCounts.rows.filter(r => r.quantity !== r.scanned_qty);
        if (unchecked.length) {
          throw new AppError(409, 'Phải quét kiểm tra đủ sản phẩm và số lượng trước khi hoàn tất chứng từ');
        }
      }
    }

    for (const item of items.rows) {
      const pid = String(item.product_id).toLowerCase();
      const confirmedQty = actualMap.has(pid)
        ? actualMap.get(pid)
        : (item.actual_quantity ?? item.quantity);

      if (confirmedQty < 0) {
        throw new AppError(400, 'Số lượng thực tế không được âm');
      }

      if (header.type === 'issue' && confirmedQty > item.quantity) {
        throw new AppError(409, `Số lượng xuất thực tế (${confirmedQty}) vượt quá số lượng đã được phê duyệt (${item.quantity})`);
      }

      await client.query(
        `UPDATE warehouse_document_items SET actual_quantity = $1 WHERE id = $2`,
        [confirmedQty, item.id]
      );

      const delta = header.type === 'receipt' ? Number(confirmedQty) : -Number(confirmedQty);
      await changeStock(client, {
        warehouseId: header.warehouse_id,
        productId: item.product_id,
        delta,
        type: header.type,
        referenceCode: header.document_number,
        note: `Hoàn tất phiếu ${header.type === 'receipt' ? 'nhập' : 'xuất'} kho (SL: ${confirmedQty})`,
        userId,
        documentId,
        operationKey: `warehouse-document:${documentId}:${item.product_id}`
      });
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
  const count = await query(`SELECT COUNT(*) AS total FROM orders
    WHERE status = $1 AND channel IN ('web', 'mobile') AND ($2 IS NULL OR warehouse_id = $2)`, values);
  values.push(limit, offset);
  const result = await query(
    `SELECT o.id, o.order_number, o.channel, o.status, o.payment_status,
       o.customer_name, o.customer_phone, o.total_amount, o.warehouse_id, o.created_at,
       COALESCE((
         SELECT p.id AS productId, p.sku, p.name, i.quantity, i.unit_price AS unitPrice
         FROM order_items i JOIN products p ON p.id = i.product_id
         WHERE i.order_id = o.id
         ORDER BY p.name ASC
         FOR JSON PATH
       ), '[]') AS items
     FROM orders o
     WHERE o.status = $1 AND o.channel IN ('web', 'mobile') AND ($2 IS NULL OR o.warehouse_id = $2)
     ORDER BY o.created_at ASC
     LIMIT $3 OFFSET $4`,
    values
  );
  return { rows: result.rows, total: count.rows[0].total };
};

export const packOrder = async ({ orderId, warehouseId, userId, role }) => {
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
    if (task.rows[0]?.status !== 'ready_to_pack') {
      if (['admin', 'manager'].includes(role)) {
        await client.query(
          `MERGE INTO order_processing_tasks AS target
           USING (SELECT $1 AS order_id, $2 AS assigned_to) AS source ON target.order_id = source.order_id
           WHEN MATCHED THEN UPDATE SET status = 'ready_to_pack', completed_at = NOW(), updated_at = NOW()
           WHEN NOT MATCHED THEN INSERT (order_id, assigned_to, status, note, assigned_at, completed_at)
             VALUES (source.order_id, source.assigned_to, 'ready_to_pack', N'Tự động hoàn tất lấy hàng khi đóng gói', NOW(), NOW());`,
          [orderId, userId]
        );
      } else {
        throw new AppError(409, 'Tác vụ phải hoàn tất lấy hàng trước khi đóng gói');
      }
    }
    const items = await client.query(
      `SELECT id, product_id, quantity FROM order_items WHERE order_id = $1 ORDER BY product_id`,
      [orderId]
    );
    if (!items.rowCount) throw new AppError(409, 'Đơn hàng không có sản phẩm');
    const checks = await client.query(`SELECT oi.id FROM order_items oi
      LEFT JOIN order_scan_events e ON e.order_item_id = oi.id WHERE oi.order_id = $1
      GROUP BY oi.id, oi.quantity HAVING oi.quantity <> COALESCE(SUM(e.quantity), 0)`, [orderId]);
    if (checks.rowCount) {
      if (['admin', 'manager'].includes(role)) {
        for (const item of checks.rows) {
          await client.query(
            `INSERT INTO order_scan_events (order_item_id, request_id, identifier, quantity, scanned_by)
             SELECT oi.id, gen_random_uuid(), p.sku, oi.quantity - COALESCE((SELECT SUM(quantity) FROM order_scan_events WHERE order_item_id = oi.id), 0), $2
             FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.id = $1`,
            [item.id, userId]
          );
        }
      } else {
        throw new AppError(409, 'Phải quét kiểm tra đủ sản phẩm và số lượng trước khi đóng gói');
      }
    }
    await consumeReservation(client, { orderId, orderNumber: order.order_number, userId });
    const updated = await transitionOrder(client, { orderId, toStatus: ORDER_STATUS.PACKED,
      expectedFrom: ORDER_STATUS.READY_TO_PACK, note: 'Đóng gói và xác nhận xuất kho', changedBy: userId });
    await client.query('COMMIT');
    return updated.rows ? updated.rows[0] : updated;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
