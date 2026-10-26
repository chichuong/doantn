import { query } from '../config/database.js';
import { withTransaction } from '../utils/transaction.js';
import { AppError } from '../utils/app-error.js';

export const getUserWarehouses = async (id) => {
  const user = await query('SELECT id FROM users WHERE id = $1', [id]);
  if (!user.rowCount) throw new AppError(404, 'Không tìm thấy người dùng');
  const result = await query(`SELECT w.id, w.code, w.name, w.is_active, uw.assigned_at
    FROM user_warehouses uw JOIN warehouses w ON w.id = uw.warehouse_id WHERE uw.user_id = $1 ORDER BY w.code`, [id]);
  return result.rows;
};

export const replaceUserWarehouses = (userId, warehouseIds, actorId) => withTransaction(async (client) => {
  const user = await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
  if (!user.rowCount) throw new AppError(404, 'Không tìm thấy người dùng');
  const warehouses = await client.query('SELECT id FROM warehouses WHERE id = ANY($1::uuid[]) AND is_active = TRUE FOR SHARE', [warehouseIds]);
  if (warehouses.rowCount !== warehouseIds.length) throw new AppError(400, 'Có kho không tồn tại hoặc đã ngừng hoạt động');
  await client.query('DELETE FROM user_warehouses WHERE user_id = $1', [userId]);
  if (warehouseIds.length) await client.query(`INSERT INTO user_warehouses (user_id, warehouse_id, assigned_by)
    SELECT $1, unnest($2::uuid[]), $3`, [userId, warehouseIds, actorId]);
  await client.query(`INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    VALUES ($1,'replace_warehouses','user',$2,$3::jsonb)`, [actorId, userId, JSON.stringify({ warehouseIds })]);
});
