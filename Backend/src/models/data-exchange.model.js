import { pool, query } from '../config/database.js';
import { lockInventory, recordMovement } from './inventory.model.js';

export const createJob = async ({ operation, dataType, fileName, fileFormat, userId, status = 'processing', totalRows = 0, successRows = 0, errorRows = 0, errors = [], errorDetails = [] }) => {
  const result = await query(
    `INSERT INTO data_exchange_jobs
     (operation, data_type, file_name, file_format, status, total_rows, success_rows, error_rows, errors, created_by, error_details, completed_at)
    VALUES ($1, $2, $3, $4, $5::varchar, $6, $7, $8, $9::jsonb, $10, $11::jsonb, CASE WHEN $5::varchar IN ('completed', 'failed') THEN NOW() ELSE NULL END)
     RETURNING id, operation, data_type, file_name, file_format, status, total_rows, success_rows, error_rows, errors, error_details, created_at, completed_at`,
    [operation, dataType, fileName || null, fileFormat || null, status, totalRows, successRows, errorRows, JSON.stringify(errors), userId, JSON.stringify(errorDetails)]
  );
  return result.rows[0];
};

export const getJob = async (jobId) => {
  const result = await query(
    `SELECT id, operation, data_type, file_name, file_format, status, total_rows, success_rows, error_rows, errors, error_details, created_by, created_at, completed_at
     FROM data_exchange_jobs WHERE id = $1`,
    [jobId]
  );
  return result.rows[0] || null;
};

export const failJob = async (jobId, errors, totalRows, errorDetails = []) => {
  const result = await query(
    `UPDATE data_exchange_jobs SET status = 'failed', total_rows = $2, success_rows = 0,
       error_rows = $3, errors = $4::jsonb, error_details = $5::jsonb, completed_at = NOW()
     WHERE id = $1
     RETURNING id, operation, data_type, file_name, file_format, status, total_rows, success_rows, error_rows, errors, created_at, completed_at`,
    [jobId, totalRows, new Set(errorDetails.filter(e => e.rowNumber > 1).map(e => e.rowNumber)).size,
      JSON.stringify(errors), JSON.stringify(errorDetails)]
  );
  return result.rows[0];
};

export const listJobs = async ({ userId, limit, offset }) => {
  const count = await query('SELECT COUNT(*)::int AS total FROM data_exchange_jobs WHERE created_by = $1', [userId]);
  const result = await query(
    `SELECT id, operation, data_type, file_name, file_format, status, total_rows, success_rows, error_rows, errors, error_details, created_at, completed_at
     FROM data_exchange_jobs WHERE created_by = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return { rows: result.rows, total: count.rows[0].total };
};

export const importProducts = async ({ rows, job }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of rows) {
      try {
      const category = await client.query('SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND is_active = TRUE', [row.category]);
    if (!category.rowCount) throw new Error('Danh mục không tồn tại hoặc đã ngừng hoạt động');
      await client.query(
        `INSERT INTO products (sku, barcode, name, description, category_id, cost_price, sale_price, reorder_level, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [row.sku, row.barcode || null, row.name, row.description || null, category.rows[0].id, row.costPrice, row.salePrice, row.reorderLevel, row.isActive]
      );
      } catch (error) { error.rowNumber = row.rowNumber; throw error; }
    }
    await client.query(
      `UPDATE data_exchange_jobs SET status = 'completed', total_rows = $2, success_rows = $3, error_rows = 0, errors = '[]'::jsonb, completed_at = NOW()
       WHERE id = $1`,
      [job.id, rows.length, rows.length]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
};

export const importInventory = async ({ rows, warehouseId, job, userId }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const row of [...rows].sort((a, b) => a.productId.localeCompare(b.productId))) {
      try {
      const current = await lockInventory(client, warehouseId, row.productId, { create: true });
      if (row.quantity < Number(current.reserved_quantity)) {
        const error = new Error(`Số lượng ${row.quantity} nhỏ hơn lượng đã giữ ${current.reserved_quantity}`);
        error.code = 'RESERVED_QUANTITY_CONFLICT';
        error.rowNumber = row.rowNumber;
        throw error;
      }
      await client.query(
        `INSERT INTO inventory (warehouse_id, product_id, quantity, reserved_quantity)
         VALUES ($1, $2, $3, 0)
         ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = $3, updated_at = NOW()`,
        [warehouseId, row.productId, row.quantity]
      );
      await recordMovement(client, { warehouseId, productId: row.productId,
        delta: row.quantity - Number(current.quantity), before: Number(current.quantity), after: row.quantity,
        type: 'adjustment', referenceCode: `IMPORT-${job.id}`, note: 'Đặt tồn theo file kiểm kê', userId,
        operationKey: `inventory-import:${job.id}:${row.productId}` });
      } catch (error) { error.rowNumber = row.rowNumber; throw error; }
    }
    await client.query(
      `UPDATE data_exchange_jobs SET status = 'completed', total_rows = $2, success_rows = $3, error_rows = 0, errors = '[]'::jsonb, completed_at = NOW()
       WHERE id = $1`,
      [job.id, rows.length, rows.length]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
};

export const findProductsForInventory = async (skus) => {
  const result = await query('SELECT id, sku FROM products WHERE sku = ANY($1::text[]) AND is_active = TRUE', [skus]);
  return result.rows;
};

export const findCategoriesByNames = async (names) => {
  const result = await query('SELECT id, name FROM categories WHERE LOWER(name) = ANY($1::text[]) AND is_active = TRUE', [names.map((name) => name.toLowerCase())]);
  return result.rows;
};

export const findExistingProductKeys = async (skus, barcodes) => {
  const result = await query(
    `SELECT sku, barcode FROM products WHERE sku = ANY($1::text[]) OR (barcode IS NOT NULL AND barcode = ANY($2::text[]))`,
    [skus, barcodes.length ? barcodes : ['__NO_BARCODE__']]
  );
  return result.rows;
};

export const exportProducts = async ({ categoryId, isActive }) => {
  const values = [];
  const conditions = [];
  if (categoryId) { values.push(categoryId); conditions.push(`p.category_id = $${values.length}`); }
  if (isActive !== undefined) { values.push(isActive); conditions.push(`p.is_active = $${values.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(
    `SELECT p.sku, p.barcode, p.name, p.description, c.name AS category, p.cost_price, p.sale_price,
       p.reorder_level, p.is_active, p.created_at, p.updated_at
     FROM products p LEFT JOIN categories c ON c.id = p.category_id ${where} ORDER BY p.name`,
    values
  );
  return result.rows;
};

export const exportInventory = async (warehouseId) => {
  const result = await query(
    `SELECT w.code AS warehouse_code, w.name AS warehouse_name, p.sku, p.barcode, p.name AS product_name,
       i.quantity, i.reserved_quantity, i.quantity - i.reserved_quantity AS available_quantity, i.updated_at
     FROM inventory i JOIN warehouses w ON w.id = i.warehouse_id JOIN products p ON p.id = i.product_id
     WHERE i.warehouse_id = $1 ORDER BY p.name`,
    [warehouseId]
  );
  return result.rows;
};

export const exportOrders = async ({ from, to, status }) => {
  const values = [from, to];
  const conditions = ['o.created_at >= $1::date', "o.created_at < ($2::date + INTERVAL '1 day')"];
  if (status) { values.push(status); conditions.push(`o.status = $${values.length}`); }
  const result = await query(
    `SELECT o.order_number, o.channel, o.status, o.payment_status, o.customer_name, o.customer_phone,
       o.total_amount, o.created_at, COUNT(oi.id)::int AS item_lines
     FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE ${conditions.join(' AND ')} GROUP BY o.id ORDER BY o.created_at DESC`,
    values
  );
  return result.rows;
};
