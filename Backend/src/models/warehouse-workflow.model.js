import { query } from '../config/database.js';
import { withTransaction } from '../utils/transaction.js';
import { changeStock } from './inventory.model.js';
import { AppError } from '../utils/app-error.js';
import { recordOrderStateEvent } from '../domain/order-state-machine.js';

export const getOrderCheck = async (orderId) => {
  const header = await query(`SELECT id, order_number, warehouse_id, status FROM orders
    WHERE id = $1 AND channel IN ('web', 'mobile')`, [orderId]);
  if (!header.rowCount) throw new AppError(404, 'Không tìm thấy đơn online');
  const items = await query(`SELECT oi.id AS order_item_id, oi.product_id, p.sku, p.barcode, p.name,
    oi.quantity, COALESCE(SUM(e.quantity), 0)::int AS scanned_quantity
    FROM order_items oi JOIN products p ON p.id = oi.product_id
    LEFT JOIN order_scan_events e ON e.order_item_id = oi.id
    WHERE oi.order_id = $1 GROUP BY oi.id, p.id ORDER BY oi.product_id`, [orderId]);
  return { ...header.rows[0], items: items.rows,
    all_checked: items.rowCount > 0 && items.rows.every(item => item.quantity === item.scanned_quantity) };
};

export const scanOrderItem = (input) => withTransaction(async (client) => {
  const { orderId, identifier, quantity, requestId, userId } = input;
  const order = await client.query(`SELECT id, status, warehouse_id FROM orders
    WHERE id = $1 AND channel IN ('web', 'mobile') FOR UPDATE`, [orderId]);
  if (!order.rowCount) throw new AppError(404, 'Không tìm thấy đơn online');
  const previous = await client.query(`SELECT e.*, oi.order_id FROM order_scan_events e
    JOIN order_items oi ON oi.id = e.order_item_id WHERE e.request_id = $1`, [requestId]);
  if (previous.rowCount) {
    const event = previous.rows[0];
    if (event.order_id !== orderId || event.identifier !== identifier || event.quantity !== quantity || event.scanned_by !== userId) {
      throw new AppError(409, 'requestId đã được dùng cho lần quét khác');
    }
    return event;
  }
  if (!['confirmed', 'ready_to_pack'].includes(order.rows[0].status)) {
    throw new AppError(409, 'Chỉ quét kiểm tra khi đơn đã xác nhận và chưa đóng gói');
  }
  const task = await client.query('SELECT status FROM order_processing_tasks WHERE order_id = $1 FOR UPDATE', [orderId]);
  if (!['picking', 'ready_to_pack'].includes(task.rows[0]?.status)) throw new AppError(409, 'Cần bắt đầu lấy hàng trước khi quét kiểm tra');
  const item = await client.query(`SELECT oi.id, oi.quantity FROM order_items oi JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = $1 AND (p.sku = $2 OR p.barcode = $2)`, [orderId, identifier]);
  if (item.rowCount !== 1) throw new AppError(409, 'Mã không thuộc đơn hoặc không xác định duy nhất một sản phẩm');
  const scanned = await client.query('SELECT COALESCE(SUM(quantity),0)::int AS total FROM order_scan_events WHERE order_item_id = $1', [item.rows[0].id]);
  if (scanned.rows[0].total + quantity > item.rows[0].quantity) throw new AppError(409, 'Số lượng quét vượt số lượng của dòng đơn');
  try {
    const event = await client.query(`INSERT INTO order_scan_events (order_item_id, request_id, identifier, quantity, scanned_by)
      VALUES ($1,$2,$3,$4,$5) RETURNING *`, [item.rows[0].id, requestId, identifier, quantity, userId]);
    return event.rows[0];
  } catch (error) {
    if (error.code === '23505') throw new AppError(409, 'requestId đã được dùng cho lần quét khác');
    throw error;
  }
});

export const getReturnReceipt = async (orderId) => {
  const header = await query('SELECT * FROM order_return_receipts WHERE order_id = $1', [orderId]);
  if (!header.rowCount) return null;
  const items = await query(`SELECT ri.*, oi.product_id, p.sku, p.name FROM order_return_receipt_items ri
    JOIN order_items oi ON oi.id = ri.order_item_id JOIN products p ON p.id = oi.product_id WHERE ri.receipt_id = $1`, [header.rows[0].id]);
  return { ...header.rows[0], items: items.rows };
};

export const receiveOrderReturn = (input) => withTransaction(async (client) => {
  const { orderId, items, note, userId } = input;
  const order = await client.query(`SELECT id, status, warehouse_id, order_number FROM orders
    WHERE id = $1 AND channel IN ('web', 'mobile') FOR UPDATE`, [orderId]);
  if (!order.rowCount) throw new AppError(404, 'Không tìm thấy đơn online');
  const header = order.rows[0];
  if (header.status !== 'returned') throw new AppError(409, 'Đơn chưa được báo hoàn từ giao nhận');
  if (!header.warehouse_id) throw new AppError(409, 'Đơn cũ chưa xác định được kho xuất');
  const existing = await client.query('SELECT id FROM order_return_receipts WHERE order_id = $1', [orderId]);
  if (existing.rowCount) {
    const prior = await client.query(`SELECT order_item_id, received_quantity, restock_quantity
      FROM order_return_receipt_items WHERE receipt_id = $1 ORDER BY order_item_id`, [existing.rows[0].id]);
    const normalized = [...items].sort((a,b) => a.orderItemId.localeCompare(b.orderItemId));
    if (prior.rowCount !== normalized.length || prior.rows.some((row, i) => row.order_item_id !== normalized[i].orderItemId
      || row.received_quantity !== normalized[i].receivedQuantity || row.restock_quantity !== normalized[i].restockQuantity)) {
      throw new AppError(409, 'Đơn đã có phiếu nhận hoàn với số lượng khác');
    }
    return existing.rows[0].id;
  }
  const shipment = await client.query('SELECT status FROM shipments WHERE order_id = $1 FOR UPDATE', [orderId]);
  if (shipment.rows[0]?.status !== 'returned') throw new AppError(409, 'Vận đơn chưa được xác nhận hoàn về');
  const lines = await client.query('SELECT id, product_id, quantity FROM order_items WHERE order_id = $1 ORDER BY product_id', [orderId]);
  if (!lines.rowCount || lines.rowCount !== items.length) throw new AppError(400, 'Phiếu hoàn phải khai báo toàn bộ dòng đơn');
  const received = new Map(items.map(item => [item.orderItemId, item]));
  const receipt = await client.query(`INSERT INTO order_return_receipts (order_id, warehouse_id, received_by, note)
    VALUES ($1,$2,$3,$4) RETURNING id`, [orderId, header.warehouse_id, userId, note || null]);
  for (const line of lines.rows) {
    const item = received.get(line.id);
    if (!item || item.receivedQuantity !== line.quantity) throw new AppError(400, 'Giai đoạn này chỉ nhận hoàn toàn bộ đơn; receivedQuantity phải bằng số lượng đã xuất');
    await client.query(`INSERT INTO order_return_receipt_items (receipt_id, order_item_id, received_quantity, restock_quantity)
      VALUES ($1,$2,$3,$4)`, [receipt.rows[0].id, line.id, item.receivedQuantity, item.restockQuantity]);
    if (item.restockQuantity > 0) await changeStock(client, { warehouseId: header.warehouse_id, productId: line.product_id,
      delta: item.restockQuantity, type: 'receipt', referenceCode: header.order_number,
      note: 'Nhận hàng hoàn đủ điều kiện bán lại', userId, orderId, orderItemId: line.id,
      operationKey: `online-return:${line.id}` });
  }
  await recordOrderStateEvent(client, { orderId,
    note: note || 'Kho đã nhận và kiểm tra hàng hoàn', changedBy: userId });
  return receipt.rows[0].id;
});
