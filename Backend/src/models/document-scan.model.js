import { query } from '../config/database.js';
import { withTransaction } from '../utils/transaction.js';
import { AppError } from '../utils/app-error.js';

export const getDocumentCheck = async (documentId) => {
  const header = await query('SELECT id, document_number, warehouse_id, status, require_scan FROM warehouse_documents WHERE id = $1', [documentId]);
  if (!header.rowCount) throw new AppError(404, 'Không tìm thấy chứng từ');
  const items = await query(`SELECT di.id AS document_item_id, di.product_id, p.sku, p.barcode, p.name,
    di.quantity, COALESCE(SUM(e.quantity), 0)::int AS scanned_quantity
    FROM warehouse_document_items di JOIN products p ON p.id = di.product_id
    LEFT JOIN warehouse_document_scan_events e ON e.document_item_id = di.id
    WHERE di.document_id = $1 GROUP BY di.id, p.id ORDER BY di.product_id`, [documentId]);
  return { ...header.rows[0], items: items.rows,
    all_checked: items.rowCount > 0 && items.rows.every(item => item.quantity === item.scanned_quantity) };
};

export const scanDocumentItem = (input) => withTransaction(async (client) => {
  const { documentId, identifier, quantity, requestId, userId } = input;
  const document = await client.query('SELECT status FROM warehouse_documents WHERE id = $1 FOR UPDATE', [documentId]);
  if (!document.rowCount) throw new AppError(404, 'Không tìm thấy chứng từ');
  const existing = await client.query(`SELECT e.*, di.document_id FROM warehouse_document_scan_events e
    JOIN warehouse_document_items di ON di.id = e.document_item_id WHERE e.request_id = $1`, [requestId]);
  if (existing.rowCount) {
    const event = existing.rows[0];
    if (event.document_id !== documentId || event.identifier !== identifier || event.quantity !== quantity || event.scanned_by !== userId) {
      throw new AppError(409, 'requestId đã được dùng cho lần quét khác');
    }
    return event;
  }
  if (document.rows[0].status !== 'draft') throw new AppError(409, 'Chỉ quét kiểm tra chứng từ draft');
  const item = await client.query(`SELECT di.id, di.quantity FROM warehouse_document_items di
    JOIN products p ON p.id = di.product_id WHERE di.document_id = $1 AND (p.sku = $2 OR p.barcode = $2)`, [documentId, identifier]);
  if (item.rowCount !== 1) throw new AppError(409, 'Mã không thuộc chứng từ hoặc không xác định duy nhất một sản phẩm');
  const scanned = await client.query('SELECT COALESCE(SUM(quantity),0)::int AS total FROM warehouse_document_scan_events WHERE document_item_id = $1', [item.rows[0].id]);
  if (scanned.rows[0].total + quantity > item.rows[0].quantity) throw new AppError(409, 'Số lượng quét vượt số lượng chứng từ');
  try {
    const result = await client.query(`INSERT INTO warehouse_document_scan_events (document_item_id, request_id, identifier, quantity, scanned_by)
      VALUES ($1,$2,$3,$4,$5) RETURNING *`, [item.rows[0].id, requestId, identifier, quantity, userId]);
    return result.rows[0];
  } catch (error) { if (error.code === '23505') throw new AppError(409, 'requestId đã được dùng cho lần quét khác'); throw error; }
});
