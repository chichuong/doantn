import { AppError } from '../utils/app-error.js';
import { recordMovement } from '../models/inventory.model.js';

const positiveInteger = (value, field) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0 || number > 2147483647) {
    throw new AppError(400, `${field} phải là số nguyên dương`);
  }
  return number;
};

const canonicalItems = (items, requireOrderItem = true) => {
  if (!Array.isArray(items) || !items.length) throw new AppError(400, 'Danh sách sản phẩm không được rỗng');
  const normalized = items.map((item, index) => ({
    warehouseId: item.warehouseId,
    productId: item.productId,
    orderItemId: item.orderItemId || null,
    quantity: positiveInteger(item.quantity, `items[${index}].quantity`)
  }));
  if (normalized.some(item => !item.warehouseId || !item.productId || (requireOrderItem && !item.orderItemId))) {
    throw new AppError(400, 'Mỗi dòng tồn phải có warehouseId, productId và orderItemId hợp lệ');
  }
  normalized.sort((a, b) => a.warehouseId.localeCompare(b.warehouseId) || a.productId.localeCompare(b.productId));
  const keys = new Set();
  for (const item of normalized) {
    const key = `${item.warehouseId}:${item.productId}`;
    if (keys.has(key)) throw new AppError(400, 'Danh sách tồn có sản phẩm trùng trong cùng kho');
    keys.add(key);
  }
  return normalized;
};

export const lockInventoryRows = async (client, items) => {
  const ordered = canonicalItems(items, false);
  const warehouseIds = ordered.map(item => item.warehouseId);
  const productIds = ordered.map(item => item.productId);
  const result = await client.query(
    `WITH requested AS (
       SELECT * FROM unnest($1::uuid[], $2::uuid[]) AS x(warehouse_id, product_id)
     )
     SELECT i.warehouse_id, i.product_id, i.quantity, i.reserved_quantity
     FROM inventory i JOIN requested r
       ON r.warehouse_id = i.warehouse_id AND r.product_id = i.product_id
     ORDER BY i.warehouse_id ASC, i.product_id ASC
     FOR UPDATE OF i`,
    [warehouseIds, productIds]
  );
  if (result.rowCount !== ordered.length) throw new AppError(409, 'Một hoặc nhiều sản phẩm chưa có dòng tồn tại kho được chọn');
  return new Map(result.rows.map(row => [`${row.warehouse_id}:${row.product_id}`, row]));
};

export const reserveStock = async (client, { items, expiresAt = null }) => {
  const ordered = canonicalItems(items);
  const stocks = await lockInventoryRows(client, ordered);
  for (const item of ordered) {
    const stock = stocks.get(`${item.warehouseId}:${item.productId}`);
    if (Number(stock.quantity) - Number(stock.reserved_quantity) < item.quantity) {
      throw new AppError(409, 'Tồn khả dụng không đủ để giữ hàng', {
        warehouseId: item.warehouseId,
        productId: item.productId,
        requested: item.quantity,
        available: Number(stock.quantity) - Number(stock.reserved_quantity)
      });
    }
  }
  for (const item of ordered) {
    await client.query(
      `UPDATE inventory SET reserved_quantity = reserved_quantity + $3, updated_at = NOW()
       WHERE warehouse_id = $1 AND product_id = $2`,
      [item.warehouseId, item.productId, item.quantity]
    );
    await client.query(
      `INSERT INTO inventory_reservations
       (order_item_id, warehouse_id, product_id, quantity, status, expires_at)
       VALUES ($1, $2, $3, $4, 'active', $5)`,
      [item.orderItemId, item.warehouseId, item.productId, item.quantity, expiresAt]
    );
  }
  return ordered.length;
};

const loadOrderReservations = async (client, orderId) => {
  const result = await client.query(
    `SELECT r.id, r.order_item_id, r.warehouse_id, r.product_id, r.quantity, r.status,
       oi.quantity AS order_quantity
     FROM order_items oi
     LEFT JOIN inventory_reservations r ON r.order_item_id = oi.id
     WHERE oi.order_id = $1
     ORDER BY r.warehouse_id ASC NULLS LAST, r.product_id ASC NULLS LAST`,
    [orderId]
  );
  if (!result.rowCount) throw new AppError(409, 'Đơn hàng không có dòng sản phẩm');
  if (result.rows.some(row => !row.id || Number(row.quantity) !== Number(row.order_quantity))) {
    throw new AppError(409, 'Reservation không khớp đầy đủ với các dòng đơn hàng');
  }
  return result.rows;
};

const closeOrderReservations = async (client, { orderId, closeStatus, consume, orderNumber, userId }) => {
  const snapshot = await loadOrderReservations(client, orderId);
  const items = snapshot.map(row => ({ warehouseId: row.warehouse_id, productId: row.product_id,
    orderItemId: row.order_item_id, quantity: Number(row.quantity) }));
  const stocks = await lockInventoryRows(client, items);
  const locked = await client.query(
    `SELECT r.id, r.order_item_id, r.warehouse_id, r.product_id, r.quantity, r.status
     FROM inventory_reservations r JOIN order_items oi ON oi.id = r.order_item_id
     WHERE oi.order_id = $1
     ORDER BY r.warehouse_id ASC, r.product_id ASC FOR UPDATE OF r`,
    [orderId]
  );
  if (locked.rowCount !== items.length || locked.rows.some(row => row.status !== 'active')) {
    throw new AppError(409, 'Reservation của đơn không còn ở trạng thái active');
  }
  for (const reservation of locked.rows) {
    const stock = stocks.get(`${reservation.warehouse_id}:${reservation.product_id}`);
    const quantity = Number(reservation.quantity);
    const before = Number(stock.quantity);
    const reservedBefore = Number(stock.reserved_quantity);
    if (reservedBefore < quantity || (consume && before < quantity)) {
      throw new AppError(409, 'Số dư tồn không khớp reservation', { productId: reservation.product_id });
    }
    const after = consume ? before - quantity : before;
    await client.query(
      `UPDATE inventory SET quantity = $3, reserved_quantity = reserved_quantity - $4, updated_at = NOW()
       WHERE warehouse_id = $1 AND product_id = $2`,
      [reservation.warehouse_id, reservation.product_id, after, quantity]
    );
    await client.query(
      `UPDATE inventory_reservations SET status = $2, closed_at = NOW() WHERE id = $1 AND status = 'active'`,
      [reservation.id, closeStatus]
    );
    if (consume) {
      await recordMovement(client, {
        warehouseId: reservation.warehouse_id,
        productId: reservation.product_id,
        delta: -quantity,
        before,
        after,
        type: 'issue',
        referenceCode: orderNumber,
        note: 'Xuất kho khi đóng gói đơn online',
        userId,
        orderId,
        orderItemId: reservation.order_item_id,
        operationKey: `online-fulfillment:${reservation.order_item_id}`
      });
    }
  }
  return locked.rowCount;
};

export const consumeReservation = (client, input) => closeOrderReservations(client, {
  ...input, closeStatus: 'consumed', consume: true
});

export const releaseReservation = (client, input) => {
  const closeStatus = input.status || 'released';
  if (!['released', 'expired'].includes(closeStatus)) throw new AppError(400, 'Trạng thái giải phóng reservation không hợp lệ');
  return closeOrderReservations(client, { ...input, closeStatus, consume: false });
};

export const directDeductStock = async (client, { warehouseId, items, userId, posOrderId, orderNumber, note = 'Bán hàng POS' }) => {
  const ordered = canonicalItems(items.map(item => ({ ...item, warehouseId })));
  const stocks = await lockInventoryRows(client, ordered);
  for (const item of ordered) {
    const stock = stocks.get(`${warehouseId}:${item.productId}`);
    const available = Number(stock.quantity) - Number(stock.reserved_quantity);
    if (available < item.quantity) {
      throw new AppError(409, 'Tồn khả dụng không đủ cho giao dịch POS', {
        productId: item.productId, requested: item.quantity, available
      });
    }
  }
  for (const item of ordered) {
    const stock = stocks.get(`${warehouseId}:${item.productId}`);
    const before = Number(stock.quantity);
    const after = before - item.quantity;
    await client.query(
      `UPDATE inventory SET quantity = $3, updated_at = NOW()
       WHERE warehouse_id = $1 AND product_id = $2`,
      [warehouseId, item.productId, after]
    );
    await recordMovement(client, {
      warehouseId,
      productId: item.productId,
      delta: -item.quantity,
      before,
      after,
      type: 'issue',
      referenceCode: orderNumber,
      note,
      userId,
      posOrderId,
      orderItemId: item.orderItemId,
      operationKey: `pos-sale:${item.orderItemId}`
    });
  }
  return ordered.length;
};
