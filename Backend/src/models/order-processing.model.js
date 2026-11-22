import { pool, query } from '../config/database.js';
import { AppError } from '../utils/app-error.js';
import { ORDER_STATUS, transitionOrder } from '../domain/order-state-machine.js';

const taskSelect = `
  t.id AS task_id, o.id, o.id AS order_id, o.order_number, o.channel,
  o.status, o.status AS order_status,
  o.payment_status, o.customer_name, o.customer_phone, o.total_amount,
  o.warehouse_id, w.name AS warehouse_name, w.code AS warehouse_code,
  COALESCE(
    JSON_VALUE(o.shipping_address_snapshot, '$.full_address'),
    CONCAT_WS(', ',
      JSON_VALUE(o.shipping_address_snapshot, '$.address_line'),
      JSON_VALUE(o.shipping_address_snapshot, '$.ward'),
      JSON_VALUE(o.shipping_address_snapshot, '$.district'),
      COALESCE(JSON_VALUE(o.shipping_address_snapshot, '$.city'), JSON_VALUE(o.shipping_address_snapshot, '$.province'))
    ),
    JSON_VALUE(o.shipping_address_snapshot, '$.address_line')
  ) AS shipping_address,
  o.created_at, o.updated_at,
  t.assigned_to, u.full_name AS processor_name, COALESCE(t.status, 'unassigned') AS task_status,
  t.note, t.assigned_at, t.completed_at
`;

export const listOrders = async ({ status, warehouseId, limit, offset }) => {
  const values = [];
  const conditions = ["o.channel IN ('web', 'mobile')", "o.status IN ('pending', 'confirmed', 'ready_to_pack')"];
  if (status) { values.push(status); conditions.push(`o.status = $${values.length}`); }
  if (warehouseId) { values.push(warehouseId); conditions.push(`o.warehouse_id = $${values.length}`); }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const count = await query(`SELECT COUNT(*) AS total FROM orders o ${where}`, values);
  values.push(limit, offset);
  const result = await query(
    `SELECT o.id, o.order_number, o.channel, o.status, o.payment_status,
       o.customer_name, o.customer_phone, o.total_amount, o.warehouse_id,
       o.created_at, o.updated_at, COUNT(oi.id) AS item_lines,
       COALESCE(t.status, 'unassigned') AS task_status, t.assigned_to
     FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id
     LEFT JOIN order_processing_tasks t ON t.order_id = o.id
     ${where}
     GROUP BY o.id, o.order_number, o.channel, o.status, o.payment_status, o.customer_name,
       o.customer_phone, o.total_amount, o.warehouse_id, o.created_at, o.updated_at, t.id, t.status, t.assigned_to
     ORDER BY o.created_at ASC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return { rows: result.rows, total: count.rows[0].total };
};

export const getOrder = async (orderId) => {
  const header = await query(`SELECT ${taskSelect} FROM orders o
    LEFT JOIN warehouses w ON w.id = o.warehouse_id
    LEFT JOIN order_processing_tasks t ON t.order_id = o.id
    LEFT JOIN users u ON u.id = t.assigned_to
    WHERE o.id = $1`, [orderId]);
  if (!header.rows[0]) return null;
  const [items, history, shipment, payments] = await Promise.all([
    query(`SELECT oi.id, oi.id AS order_item_id, oi.product_id, p.sku, p.barcode, p.name, p.image_url, p.image_url AS "imageUrl", oi.quantity, oi.unit_price, oi.line_total
      FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = $1`, [orderId]),
    query(`SELECT id, from_status, status, note, changed_by, created_at FROM order_status_history WHERE order_id = $1 ORDER BY created_at ASC`, [orderId]),
    query(`SELECT s.id, s.tracking_number, s.carrier, s.status, s.assigned_to, u.full_name AS shipper_name
      FROM shipments s LEFT JOIN users u ON u.id = s.assigned_to WHERE s.order_id = $1`, [orderId]),
    query(`SELECT id, method, amount, status, transaction_reference, refund_reference, paid_at, refunded_at
      FROM payments WHERE order_id = $1 ORDER BY paid_at`, [orderId])
  ]);
  const s = shipment.rows[0] || null;
  const firstPayment = payments.rows[0] || null;
  return {
    ...header.rows[0],
    payment_method: firstPayment?.method || (header.rows[0].channel === 'pos' ? 'cash' : 'cod'),
    transaction_reference: firstPayment?.transaction_reference || null,
    payments: payments.rows,
    items: items.rows,
    status_history: history.rows,
    shipment: s,
    shipment_id: s?.id || null,
    tracking_number: s?.tracking_number || null
  };
};

export const findProcessor = async (userId) => {
  const result = await query(`SELECT u.id, u.status FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = $1 AND r.code = 'order_processor'`, [userId]);
  return result.rows[0] || null;
};

export const confirmOrder = async ({ orderId, userId, note }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await client.query(`SELECT id, status, warehouse_id,
      CASE WHEN reservation_expires_at <= NOW() AND payment_status = 'unpaid' THEN 1 ELSE 0 END AS reservation_expired
      FROM orders WHERE id = $1 AND channel IN ('web', 'mobile') FOR UPDATE`, [orderId]);
    if (!order.rows[0]) { const error = new Error('ORDER_NOT_FOUND'); error.code = 'ORDER_NOT_FOUND'; throw error; }
    if (order.rows[0].status !== 'pending') { const error = new Error('ORDER_NOT_PENDING'); error.code = 'ORDER_NOT_PENDING'; throw error; }
    if (order.rows[0].reservation_expired) throw new AppError(409, 'Thời gian giữ hàng đã hết; cần hủy và đặt lại');
    await transitionOrder(client, { orderId, toStatus: ORDER_STATUS.CONFIRMED,
      expectedFrom: ORDER_STATUS.PENDING, note: note || 'Nhân viên xử lý đã xác nhận đơn', changedBy: userId });
    await client.query(`UPDATE orders SET reservation_expires_at = NULL, updated_at = NOW() WHERE id = $1`, [orderId]);
    await client.query(`UPDATE inventory_reservations SET expires_at = NULL WHERE order_item_id IN
      (SELECT id FROM order_items WHERE order_id = $1) AND status = 'active'`, [orderId]);
    await client.query(
      `IF NOT EXISTS (SELECT 1 FROM order_processing_tasks WHERE order_id = $1)
       INSERT INTO order_processing_tasks (order_id, assigned_to, status, note, assigned_at)
       VALUES ($1, $2, 'picking', $3, NOW())`,
      [orderId, userId, 'Tác vụ khởi tạo khi xác nhận đơn']
    );
    await client.query('COMMIT');
    return getOrder(orderId);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
};

export const assignOrder = async ({ orderId, assignedTo, userId, note }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await client.query(`SELECT id, status, warehouse_id FROM orders WHERE id = $1 AND channel IN ('web', 'mobile') FOR UPDATE`, [orderId]);
    if (!order.rows[0]) { const error = new Error('ORDER_NOT_FOUND'); error.code = 'ORDER_NOT_FOUND'; throw error; }
    if (order.rows[0].status !== ORDER_STATUS.CONFIRMED) { const error = new Error('ORDER_NOT_ASSIGNABLE'); error.code = 'ORDER_NOT_ASSIGNABLE'; throw error; }
    const processor = await client.query(`SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1 AND u.status = 'active' AND r.code = 'order_processor' FOR SHARE OF u`, [assignedTo]);
    if (!processor.rowCount) throw new AppError(400, 'Nhân viên xử lý không còn hoạt động');
    const access = await client.query(`SELECT user_id FROM user_warehouses
      WHERE user_id = $1 AND warehouse_id = $2 FOR SHARE`, [assignedTo, order.rows[0].warehouse_id]);
    if (!access.rowCount) throw new AppError(400, 'Nhân viên xử lý chưa được phân công làm việc tại kho của đơn');
    await client.query(
      `MERGE INTO order_processing_tasks AS target
       USING (SELECT $1 AS order_id, $2 AS assigned_to, $3 AS note) AS source
       ON target.order_id = source.order_id
       WHEN MATCHED THEN UPDATE SET assigned_to = source.assigned_to, status = 'assigned', note = source.note, assigned_at = NOW(), updated_at = NOW()
       WHEN NOT MATCHED THEN INSERT (order_id, assigned_to, status, note) VALUES (source.order_id, source.assigned_to, 'assigned', source.note);`,
      [orderId, assignedTo, note || null]
    );
    await client.query('COMMIT');
    return getOrder(orderId);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
};

const transitions = { assigned: ['picking'], picking: ['ready_to_pack'] };

export const updateTask = async ({ orderId, status, userId, role, note }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await client.query('SELECT status FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (order.rows[0]?.status !== ORDER_STATUS.CONFIRMED) {
      const error = new Error('INVALID_TRANSITION'); error.code = 'INVALID_TRANSITION'; throw error;
    }
    let current = await client.query(`SELECT id, order_id, status, assigned_to FROM order_processing_tasks WHERE order_id = $1 FOR UPDATE`, [orderId]);
    if (!current.rows[0]) {
      if (['admin', 'manager', 'warehouse'].includes(role)) {
        current = await client.query(
          `INSERT INTO order_processing_tasks (order_id, assigned_to, status, note, assigned_at)
           VALUES ($1, $2, 'picking', $3, NOW())
           RETURNING id, order_id, status, assigned_to`,
          [orderId, userId, note || 'Tự động khởi tạo tác vụ xử lý đơn']
        );
      } else {
        const error = new Error('TASK_NOT_FOUND'); error.code = 'TASK_NOT_FOUND'; throw error;
      }
    }
    const task = current.rows[0];
    if (role === 'order_processor' && task.assigned_to !== userId) { const error = new Error('PROCESSOR_NOT_ASSIGNED'); error.code = 'PROCESSOR_NOT_ASSIGNED'; throw error; }
    if (task.status !== status && !transitions[task.status]?.includes(status)) {
      if (!['admin', 'manager'].includes(role)) {
        const error = new Error('INVALID_TRANSITION'); error.code = 'INVALID_TRANSITION'; throw error;
      }
    }
    if (status === 'ready_to_pack') {
      const check = await client.query(`SELECT oi.id FROM order_items oi
        LEFT JOIN order_scan_events e ON e.order_item_id = oi.id WHERE oi.order_id = $1
        GROUP BY oi.id, oi.quantity HAVING oi.quantity <> COALESCE(SUM(e.quantity), 0)`, [orderId]);
      if (check.rowCount) {
        if (['admin', 'manager'].includes(role)) {
          // Admin/Manager có thẩm quyền phê duyệt nhặt hàng trực tiếp trên Web
          for (const item of check.rows) {
            await client.query(
              `INSERT INTO order_scan_events (order_item_id, request_id, identifier, quantity, scanned_by)
               SELECT oi.id, gen_random_uuid(), p.sku, oi.quantity - COALESCE((SELECT SUM(quantity) FROM order_scan_events WHERE order_item_id = oi.id), 0), $2
               FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.id = $1`,
              [item.id, userId]
            );
          }
        } else {
          throw new AppError(409, 'Chưa quét kiểm tra đủ hàng để chuyển ready_to_pack');
        }
      }
    }
    await client.query(`UPDATE order_processing_tasks SET status = $2::varchar, completed_at = CASE WHEN $2::varchar = 'ready_to_pack' THEN NOW() ELSE completed_at END, updated_at = NOW() WHERE id = $1`, [task.id, status]);
    if (status === 'ready_to_pack') {
      await transitionOrder(client, { orderId, toStatus: ORDER_STATUS.READY_TO_PACK,
        expectedFrom: ORDER_STATUS.CONFIRMED, note: note || 'Đã lấy và kiểm tra đủ hàng', changedBy: userId });
    }
    await client.query('COMMIT');
    return getOrder(orderId);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
};
