import { pool, query } from '../config/database.js';
import { changeStock } from './inventory.model.js';

export const getDashboardSummary = async ({ from, to }) => {
  const values = [from, to];
  const [orders, products, inventory, users, revenue] = await Promise.all([
    query(`SELECT COUNT(*) AS total_orders,
             COALESCE(SUM(CASE WHEN status IN ('pending', 'confirmed', 'ready_to_pack', 'packed', 'handover', 'shipping') THEN 1 ELSE 0 END), 0) AS open_orders,
             COALESCE(SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END), 0) AS completed_orders
           FROM orders WHERE created_at >= CAST($1 AS DATE) AND created_at < DATEADD(day, 1, CAST($2 AS DATE))`, values),
    query(`SELECT COALESCE(SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END), 0) AS active_products,
             COALESCE(SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END), 0) AS inactive_products
           FROM products`, []),
    query(`SELECT
             COUNT(*) AS inventory_lines,
             COALESCE(SUM(i.quantity), 0) AS total_quantity,
             COALESCE(SUM(CASE WHEN (i.quantity - i.reserved_quantity) <= p.reorder_level THEN 1 ELSE 0 END), 0) AS low_stock_lines
           FROM inventory i
           JOIN products p ON p.id = i.product_id
           JOIN warehouses w ON w.id = i.warehouse_id
           WHERE p.is_active = 1
             AND w.id = (
               SELECT TOP 1 id FROM warehouses
               WHERE is_active = 1
               ORDER BY CASE WHEN code = 'WH-HCM-01' THEN 0 ELSE 1 END, name ASC
             )`, []),
    query(`SELECT COALESCE(SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END), 0) AS active_users,
             COUNT(*) AS total_users FROM users`, []),
    query(`SELECT CAST(COALESCE(SUM(CASE WHEN status = 'delivered' THEN total_amount ELSE 0 END), 0) AS DECIMAL(14,2)) AS revenue,
             CAST(COALESCE(AVG(CASE WHEN status = 'delivered' THEN total_amount ELSE NULL END), 0) AS DECIMAL(14,2)) AS average_order_value
           FROM orders WHERE created_at >= CAST($1 AS DATE) AND created_at < DATEADD(day, 1, CAST($2 AS DATE))`, values)
  ]);

  return {
    period: { from, to },
    orders: orders.rows[0],
    products: products.rows[0],
    inventory: inventory.rows[0],
    users: users.rows[0],
    sales: revenue.rows[0]
  };
};

export const listProducts = async ({ search, categoryId, isActive, limit, offset }) => {
  const values = [];
  const conditions = [];
  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(p.sku ILIKE $${values.length} OR p.name ILIKE $${values.length} OR COALESCE(p.barcode, '') ILIKE $${values.length})`);
  }
  if (categoryId) {
    values.push(categoryId);
    conditions.push(`p.category_id = $${values.length}`);
  }
  if (isActive !== undefined) {
    values.push(isActive);
    conditions.push(`p.is_active = $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countResult = await query(`SELECT COUNT(*)::int AS total FROM products p ${where}`, values);
  values.push(limit, offset);
  const result = await query(
    `SELECT p.id, p.sku, p.barcode, p.name, p.description, p.category_id,
       c.name AS category_name, p.cost_price, p.sale_price, p.reorder_level,
       p.image_url, p.image_url AS "imageUrl",
       p.is_active, p.created_at, p.updated_at
     FROM products p LEFT JOIN categories c ON c.id = p.category_id
     ${where} ORDER BY p.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return { rows: result.rows, total: countResult.rows[0].total };
};

export const findCategory = async (categoryId) => {
  const result = await query('SELECT id FROM categories WHERE id = $1 AND is_active = TRUE', [categoryId]);
  return result.rows[0] || null;
};

export const createProduct = async (input) => {
  const result = await query(
    `INSERT INTO products (sku, barcode, name, description, category_id, cost_price, sale_price, reorder_level, image_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, sku, barcode, name, description, category_id, cost_price, sale_price, reorder_level, image_url, image_url AS "imageUrl", is_active, created_at, updated_at`,
    [input.sku, input.barcode || null, input.name, input.description || null, input.categoryId || null, input.costPrice, input.salePrice, input.reorderLevel, input.imageUrl || null]
  );
  return result.rows[0];
};

export const updateProduct = async (productId, input) => {
  const hasImageUrl = (Object.hasOwn(input, 'imageUrl') || Object.hasOwn(input, 'image_url')) ? 1 : 0;
  const nextImageUrl = (input.imageUrl ?? input.image_url) ? String(input.imageUrl ?? input.image_url).trim() : null;
  const result = await query(
    `UPDATE products SET
       name = COALESCE($2, name), barcode = COALESCE($3, barcode), description = COALESCE($4, description),
       category_id = COALESCE($5, category_id), cost_price = COALESCE($6, cost_price),
       sale_price = COALESCE($7, sale_price), reorder_level = COALESCE($8, reorder_level),
       is_active = COALESCE($9, is_active),
       image_url = CASE WHEN $10 = 1 THEN $11 ELSE image_url END,
       updated_at = NOW()
     WHERE id = $1
     RETURNING id, sku, barcode, name, description, category_id, cost_price, sale_price, reorder_level, image_url, image_url AS "imageUrl", is_active, created_at, updated_at`,
    [productId, input.name || null, input.barcode || null, input.description || null, input.categoryId || null,
      input.costPrice ?? null, input.salePrice ?? null, input.reorderLevel ?? null, input.isActive ?? null,
      hasImageUrl, nextImageUrl]
  );
  return result.rows[0] || null;
};

export const listWarehouses = async () => {
  const result = await query(
    `SELECT w.id, w.code, w.name, w.address, w.is_active, w.created_at, w.updated_at,
       COUNT(i.product_id) AS product_lines,
       COALESCE(SUM(i.quantity), 0) AS total_quantity
     FROM warehouses w LEFT JOIN inventory i ON i.warehouse_id = w.id
     WHERE w.is_active = 1
     GROUP BY w.id, w.code, w.name, w.address, w.is_active, w.created_at, w.updated_at
     ORDER BY (CASE WHEN w.code = 'WH-HCM-01' THEN 0 ELSE 1 END), w.name ASC`
  );
  return result.rows;
};

export const createWarehouse = async ({ code, name, address }) => {
  const result = await query(
    `INSERT INTO warehouses (code, name, address) VALUES ($1, $2, $3)
     RETURNING id, code, name, address, is_active, created_at, updated_at`,
    [code, name, address || null]
  );
  return result.rows[0];
};

export const updateWarehouse = async (warehouseId, input) => {
  const result = await query(
    `UPDATE warehouses SET name = COALESCE($2, name), address = COALESCE($3, address),
       is_active = COALESCE($4, is_active), updated_at = NOW()
     WHERE id = $1
     RETURNING id, code, name, address, is_active, created_at, updated_at`,
    [warehouseId, input.name || null, input.address || null, input.isActive ?? null]
  );
  return result.rows[0] || null;
};

export const listInventory = async ({ warehouseId, productId, search, lowStock, limit, offset }) => {
  const values = [];
  const conditions = [];
  if (warehouseId) { values.push(warehouseId); conditions.push(`i.warehouse_id = $${values.length}`); }
  if (productId) { values.push(productId); conditions.push(`i.product_id = $${values.length}`); }
  if (search) {
    values.push(`%${search.trim()}%`);
    conditions.push(`(p.name ILIKE $${values.length} OR p.sku ILIKE $${values.length} OR COALESCE(p.barcode, '') ILIKE $${values.length})`);
  }
  if (lowStock === true) conditions.push('i.quantity - i.reserved_quantity <= p.reorder_level');
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countResult = await query(`SELECT COUNT(*)::int AS total FROM inventory i JOIN products p ON p.id = i.product_id ${where}`, values);
  values.push(limit, offset);
  const result = await query(
    `SELECT i.warehouse_id, w.code AS warehouse_code, w.name AS warehouse_name,
       i.product_id, p.sku, p.barcode, p.name AS product_name, p.sale_price, p.cost_price, p.reorder_level,
       p.image_url, p.image_url AS "imageUrl",
       i.quantity, i.reserved_quantity, (i.quantity - i.reserved_quantity)::int AS available_quantity,
       (i.quantity - i.reserved_quantity)::int AS available_stock,
       i.updated_at
     FROM inventory i JOIN warehouses w ON w.id = i.warehouse_id JOIN products p ON p.id = i.product_id
     ${where} ORDER BY available_quantity ASC, p.name ASC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return { rows: result.rows, total: countResult.rows[0].total };
};

export const listInventoryDiscrepancies = async ({ warehouseId, productId, limit, offset }) => {
  const values = [];
  const conditions = [];
  if (warehouseId) { values.push(warehouseId); conditions.push(`d.warehouse_id = $${values.length}`); }
  if (productId) { values.push(productId); conditions.push(`d.product_id = $${values.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countResult = await query(`SELECT COUNT(*)::int AS total FROM inventory_reservation_discrepancies d ${where}`, values);
  values.push(limit, offset);
  const result = await query(
    `SELECT d.warehouse_id, w.code AS warehouse_code, w.name AS warehouse_name,
       d.product_id, p.sku, p.name AS product_name,
       d.quantity, d.reserved_quantity, d.expected_reserved_quantity,
       d.reserved_quantity - d.expected_reserved_quantity AS difference
     FROM inventory_reservation_discrepancies d
     JOIN warehouses w ON w.id = d.warehouse_id
     JOIN products p ON p.id = d.product_id
     ${where}
     ORDER BY ABS(d.reserved_quantity - d.expected_reserved_quantity) DESC, w.code, p.sku
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return { rows: result.rows, total: countResult.rows[0].total };
};

export const listInventoryTransactions = async ({ warehouseId, productId, type, from, to, referenceCode, limit, offset }) => {
  const values = [];
  const conditions = [];
  if (warehouseId) { values.push(warehouseId); conditions.push(`t.warehouse_id = $${values.length}`); }
  if (productId) { values.push(productId); conditions.push(`t.product_id = $${values.length}`); }
  if (type) { values.push(type); conditions.push(`t.type = $${values.length}`); }
  if (from) { values.push(from); conditions.push(`t.created_at >= $${values.length}::date`); }
  if (to) { values.push(to); conditions.push(`t.created_at < ($${values.length}::date + INTERVAL '1 day')`); }
  if (referenceCode) { values.push(`%${referenceCode}%`); conditions.push(`COALESCE(t.reference_code, '') ILIKE $${values.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countResult = await query(`SELECT COUNT(*)::int AS total FROM inventory_transactions t ${where}`, values);
  values.push(limit, offset);
  const result = await query(
    `SELECT t.id, t.type, t.quantity, t.quantity_delta, t.quantity_before, t.quantity_after,
       t.reference_code, t.reference_id, t.note, t.created_at,
       t.warehouse_id, w.code AS warehouse_code, w.name AS warehouse_name,
       t.product_id, p.sku, p.name AS product_name,
       t.order_id, t.pos_order_id, COALESCE(o.order_number, po.order_number) AS order_number, t.order_item_id,
       t.document_id, d.document_number,
       t.created_by, u.full_name AS created_by_name
     FROM inventory_transactions t
     JOIN warehouses w ON w.id = t.warehouse_id
     JOIN products p ON p.id = t.product_id
     LEFT JOIN orders o ON o.id = t.order_id
     LEFT JOIN orders po ON po.id = t.pos_order_id
     LEFT JOIN warehouse_documents d ON d.id = t.document_id
     LEFT JOIN users u ON u.id = t.created_by
     ${where}
     ORDER BY t.created_at DESC, t.id DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return { rows: result.rows, total: countResult.rows[0].total };
};

export const getInventoryReservations = async ({ warehouseId, productId, status, limit, offset }) => {
  const values = [warehouseId, productId];
  const conditions = ['r.warehouse_id = $1', 'r.product_id = $2'];
  if (status) { values.push(status); conditions.push(`r.status = $${values.length}`); }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const [stockResult, countResult] = await Promise.all([
    query(
      `SELECT i.warehouse_id, w.code AS warehouse_code, w.name AS warehouse_name,
         i.product_id, p.sku, p.name AS product_name, i.quantity, i.reserved_quantity,
         i.quantity - i.reserved_quantity AS available_quantity,
         COALESCE(SUM(CASE WHEN r.status = 'active' THEN r.quantity ELSE 0 END), 0) AS expected_reserved_quantity,
         i.reserved_quantity - COALESCE(SUM(CASE WHEN r.status = 'active' THEN r.quantity ELSE 0 END), 0) AS difference
       FROM inventory i
       JOIN warehouses w ON w.id = i.warehouse_id
       JOIN products p ON p.id = i.product_id
       LEFT JOIN inventory_reservations r ON r.warehouse_id = i.warehouse_id AND r.product_id = i.product_id
       WHERE i.warehouse_id = $1 AND i.product_id = $2
       GROUP BY i.warehouse_id, w.id, w.code, w.name, i.product_id, p.id, p.sku, p.name, i.quantity, i.reserved_quantity`,
      [warehouseId, productId]
    ),
    query(`SELECT COUNT(*) AS total FROM inventory_reservations r ${where}`, values)
  ]);
  if (!stockResult.rows[0]) return null;
  values.push(limit, offset);
  const reservations = await query(
    `SELECT r.id, r.order_item_id, r.quantity, r.status, r.created_at, r.closed_at,
       o.id AS order_id, o.order_number, o.status AS order_status, o.channel
     FROM inventory_reservations r
     JOIN order_items oi ON oi.id = r.order_item_id
     JOIN orders o ON o.id = oi.order_id
     ${where}
     ORDER BY CASE WHEN r.status = 'active' THEN 1 ELSE 0 END DESC, r.created_at DESC, r.id DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return { stock: stockResult.rows[0], reservations: reservations.rows, total: countResult.rows[0].total };
};

export const adjustInventory = async ({ warehouseId, productId, type, quantity, referenceCode, note, userId }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const delta = type === 'issue' ? -quantity : quantity;
    const transaction = await changeStock(client, { warehouseId, productId, delta, type, referenceCode, note, userId });
    await client.query('COMMIT');
    return transaction;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const listOrders = async ({ status, channel, from, to, limit, offset }) => {
  const values = [from, to];
  const conditions = ['o.created_at >= CAST($1 AS DATE)', 'o.created_at < DATEADD(day, 1, CAST($2 AS DATE))'];
  if (status) { values.push(status); conditions.push(`o.status = $${values.length}`); }
  if (channel) { values.push(channel); conditions.push(`o.channel = $${values.length}`); }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const countResult = await query(`SELECT COUNT(*) AS total FROM orders o ${where}`, values);
  values.push(limit, offset);
  const result = await query(
    `SELECT o.id, o.order_number, o.channel, o.status, o.payment_status, o.customer_name,
       o.customer_phone, o.total_amount, o.warehouse_id, w.name AS warehouse_name, w.code AS warehouse_code,
       o.created_at, o.updated_at,
       COUNT(oi.id) AS item_lines
     FROM orders o
     LEFT JOIN warehouses w ON w.id = o.warehouse_id
     LEFT JOIN order_items oi ON oi.order_id = o.id
     ${where}
     GROUP BY o.id, o.order_number, o.channel, o.status, o.payment_status, o.customer_name,
       o.customer_phone, o.total_amount, o.warehouse_id, w.id, w.name, w.code, o.created_at, o.updated_at
     ORDER BY o.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return { rows: result.rows, total: countResult.rows[0].total };
};

export const getSalesReport = async ({ from, to }) => {
  const [summary, byChannel, byDay] = await Promise.all([
    query(`SELECT COALESCE(SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END), 0) AS completed_orders,
             CAST(COALESCE(SUM(CASE WHEN status = 'delivered' THEN total_amount ELSE 0 END), 0) AS DECIMAL(14,2)) AS revenue,
             CAST(COALESCE(SUM(CASE WHEN status = 'returned' THEN total_amount ELSE 0 END), 0) AS DECIMAL(14,2)) AS returned_amount
           FROM orders WHERE created_at >= CAST($1 AS DATE) AND created_at < DATEADD(day, 1, CAST($2 AS DATE))`, [from, to]),
    query(`SELECT channel, COUNT(*) AS orders,
             CAST(COALESCE(SUM(CASE WHEN status = 'delivered' THEN total_amount ELSE 0 END), 0) AS DECIMAL(14,2)) AS revenue
           FROM orders WHERE created_at >= CAST($1 AS DATE) AND created_at < DATEADD(day, 1, CAST($2 AS DATE))
           GROUP BY channel ORDER BY revenue DESC`, [from, to]),
    query(`SELECT CONVERT(VARCHAR(10), created_at, 23) AS date, COUNT(*) AS orders,
             CAST(COALESCE(SUM(CASE WHEN status = 'delivered' THEN total_amount ELSE 0 END), 0) AS DECIMAL(14,2)) AS revenue
           FROM orders WHERE created_at >= CAST($1 AS DATE) AND created_at < DATEADD(day, 1, CAST($2 AS DATE))
           GROUP BY CONVERT(VARCHAR(10), created_at, 23) ORDER BY date ASC`, [from, to])
  ]);
  return { period: { from, to }, summary: summary.rows[0], byChannel: byChannel.rows, byDay: byDay.rows };
};
