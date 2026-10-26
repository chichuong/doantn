import { pool, query } from '../config/database.js';
import { AppError } from '../utils/app-error.js';
import { ORDER_STATUS, transitionOrder } from '../domain/order-state-machine.js';

const shipmentSelect = `
  s.id, s.order_id, o.order_number, o.customer_name, o.customer_phone,
  o.total_amount, o.warehouse_id, s.tracking_number, s.carrier, s.status,
  s.assigned_to, u.full_name AS shipper_name, s.created_by, s.note,
  s.picked_up_at, s.delivered_at, s.failed_at, s.created_at, s.updated_at
`;

export const findShipper = async (userId) => {
  const result = await query(
    `SELECT u.id, u.email, u.full_name, u.status FROM users u
     JOIN roles r ON r.id = u.role_id WHERE u.id = $1 AND r.code = 'shipper'`,
    [userId]
  );
  return result.rows[0] || null;
};

export const findOrderForShipment = async (orderId) => {
  const result = await query(
    `SELECT id, order_number, status, shipping_address_id FROM orders WHERE id = $1`,
    [orderId]
  );
  return result.rows[0] || null;
};

export const createShipment = async ({ orderId, trackingNumber, carrier, assignedTo, createdBy, note }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await client.query('SELECT id, status FROM orders WHERE id = $1 FOR UPDATE', [orderId]);
    if (!order.rows[0]) { const error = new Error('ORDER_NOT_FOUND'); error.code = 'ORDER_NOT_FOUND'; throw error; }
    if (order.rows[0].status !== 'packed') { const error = new Error('ORDER_NOT_PACKED'); error.code = 'ORDER_NOT_PACKED'; throw error; }
    const shipment = await client.query(
      `INSERT INTO shipments (order_id, tracking_number, carrier, status, assigned_to, created_by, note)
       VALUES ($1, $2, $3, 'assigned', $4, $5, $6) RETURNING id`,
      [orderId, trackingNumber, carrier || null, assignedTo, createdBy, note || null]
    );
    await client.query(
      `INSERT INTO shipment_status_history (shipment_id, status, note, changed_by)
       VALUES ($1, 'assigned', $2, $3)`,
      [shipment.rows[0].id, note || 'Tao va phan cong van don', createdBy]
    );
    await transitionOrder(client, { orderId, toStatus: ORDER_STATUS.HANDOVER,
      expectedFrom: ORDER_STATUS.PACKED, note: note || 'Đơn hàng đã bàn giao cho đơn vị vận chuyển', changedBy: createdBy });
    await client.query('COMMIT');
    return getShipment(shipment.rows[0].id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
};

export const listShipments = async ({ userId, role, status, limit, offset }) => {
  const values = [];
  const conditions = [];
  if (role === 'shipper') { values.push(userId); conditions.push(`s.assigned_to = $${values.length}`); }
  if (status) { values.push(status); conditions.push(`s.status = $${values.length}`); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const count = await query(`SELECT COUNT(*)::int AS total FROM shipments s ${where}`, values);
  values.push(limit, offset);
  const result = await query(
    `SELECT ${shipmentSelect} FROM shipments s
     JOIN orders o ON o.id = s.order_id JOIN users u ON u.id = s.assigned_to
     ${where} ORDER BY s.created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return { rows: result.rows, total: count.rows[0].total };
};

export const getShipment = async (shipmentId) => {
  const header = await query(
    `SELECT ${shipmentSelect} FROM shipments s
     JOIN orders o ON o.id = s.order_id JOIN users u ON u.id = s.assigned_to
     WHERE s.id = $1`,
    [shipmentId]
  );
  if (!header.rows[0]) return null;
  const [history, address] = await Promise.all([
    query(`SELECT id, status, note, changed_by, created_at FROM shipment_status_history WHERE shipment_id = $1 ORDER BY created_at ASC`, [shipmentId]),
    query(`SELECT o.shipping_address_snapshot AS address FROM orders o
           JOIN shipments s ON s.order_id = o.id WHERE s.id = $1`, [shipmentId])
  ]);
  return { ...header.rows[0], address: address.rows[0]?.address || null, status_history: history.rows };
};

const transitions = {
  assigned: ['picked_up'],
  picked_up: ['in_transit'],
  in_transit: ['delivered', 'failed'],
  failed: ['returned']
};

export const updateShipmentStatus = async ({ shipmentId, status, note, userId, role }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const reference = await client.query('SELECT order_id FROM shipments WHERE id = $1', [shipmentId]);
    if (!reference.rowCount) { const error = new Error('SHIPMENT_NOT_FOUND'); error.code = 'SHIPMENT_NOT_FOUND'; throw error; }
    const order = await client.query('SELECT status FROM orders WHERE id = $1 FOR UPDATE', [reference.rows[0].order_id]);
    const current = await client.query(
      `SELECT s.id, s.order_id, s.status, s.assigned_to FROM shipments s WHERE s.id = $1 FOR UPDATE`,
      [shipmentId]
    );
    if (!current.rows[0]) { const error = new Error('SHIPMENT_NOT_FOUND'); error.code = 'SHIPMENT_NOT_FOUND'; throw error; }
    const shipment = current.rows[0];
    if (role === 'shipper' && shipment.assigned_to !== userId) { const error = new Error('SHIPPER_NOT_ASSIGNED'); error.code = 'SHIPPER_NOT_ASSIGNED'; throw error; }
    if (shipment.status === status) { await client.query('COMMIT'); return getShipment(shipmentId); }
    const expectedOrderStatus = shipment.status === 'assigned' ? ORDER_STATUS.HANDOVER : ORDER_STATUS.SHIPPING;
    if (order.rows[0]?.status !== expectedOrderStatus) throw new AppError(409, 'Trạng thái đơn không còn phù hợp để cập nhật giao nhận');
    if (!transitions[shipment.status]?.includes(status)) { const error = new Error('INVALID_TRANSITION'); error.code = 'INVALID_TRANSITION'; throw error; }
    const timestampColumn = status === 'picked_up' ? 'picked_up_at' : status === 'delivered' ? 'delivered_at' : status === 'failed' ? 'failed_at' : null;
    const updateSql = timestampColumn
      ? `UPDATE shipments SET status = $2, ${timestampColumn} = NOW(), updated_at = NOW() WHERE id = $1`
      : `UPDATE shipments SET status = $2, updated_at = NOW() WHERE id = $1`;
    await client.query(updateSql, [shipmentId, status]);
    await client.query(
      `INSERT INTO shipment_status_history (shipment_id, status, note, changed_by) VALUES ($1, $2, $3, $4)`,
      [shipmentId, status, note || null, userId]
    );
    const orderStatus = status === 'picked_up' ? ORDER_STATUS.SHIPPING
      : status === 'delivered' ? ORDER_STATUS.DELIVERED
        : status === 'returned' ? ORDER_STATUS.RETURNED : null;
    if (orderStatus) {
      await transitionOrder(client, { orderId: shipment.order_id, toStatus: orderStatus,
        expectedFrom: expectedOrderStatus, note: note || `Cập nhật vận đơn: ${status}`, changedBy: userId });
    }
    await client.query('COMMIT');
    return getShipment(shipmentId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
};

export const findShipmentByTracking = async (trackingNumber, userId, role) => {
  const result = await query(`SELECT id FROM shipments WHERE tracking_number = $1
    AND ($2::text <> 'shipper' OR assigned_to = $3::uuid)`, [trackingNumber, role, userId]);
  return result.rows[0]?.id || null;
};
