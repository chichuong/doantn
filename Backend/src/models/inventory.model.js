import { AppError } from '../utils/app-error.js';

// Caller owns BEGIN/COMMIT and locks the order before touching its inventory.
export const lockInventory = async (client, warehouseId, productId, { create = false } = {}) => {
  if (create) {
    await client.query(`INSERT INTO inventory (warehouse_id, product_id, quantity, reserved_quantity)
      VALUES ($1, $2, 0, 0) ON CONFLICT (warehouse_id, product_id) DO NOTHING`, [warehouseId, productId]);
  }
  const result = await client.query(`SELECT quantity, reserved_quantity FROM inventory
    WHERE warehouse_id = $1 AND product_id = $2 FOR UPDATE`, [warehouseId, productId]);
  if (!result.rows[0]) throw new AppError(409, 'Sản phẩm chưa có tồn kho tại kho được chọn');
  return result.rows[0];
};

export const recordMovement = async (client, input) => {
  const { warehouseId, productId, delta, before, after, type, referenceCode, note, userId,
    orderId = null, posOrderId = null, orderItemId = null, documentId = null, operationKey = null } = input;
  if (delta === 0) return null;
  const result = await client.query(`INSERT INTO inventory_transactions
    (warehouse_id, product_id, type, quantity, quantity_delta, quantity_before, quantity_after,
     reference_code, note, created_by, order_id, pos_order_id, order_item_id, document_id, operation_key)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
  [warehouseId, productId, type, Math.abs(delta), delta, before, after, referenceCode || null,
    note || null, userId, orderId, posOrderId, orderItemId, documentId, operationKey]);
  return result.rows[0];
};

export const changeStock = async (client, input) => {
  const stock = await lockInventory(client, input.warehouseId, input.productId, { create: input.delta > 0 });
  const before = Number(stock.quantity);
  const after = before + input.delta;
  if (after < Number(stock.reserved_quantity)) throw new AppError(409, 'Tồn sau thay đổi thấp hơn lượng hàng đang giữ');
  await client.query(`UPDATE inventory SET quantity = $3, updated_at = NOW()
    WHERE warehouse_id = $1 AND product_id = $2`, [input.warehouseId, input.productId, after]);
  return recordMovement(client, { ...input, before, after });
};

