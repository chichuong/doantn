import { pool, query } from '../config/database.js';
import { withTransaction } from '../utils/transaction.js';

const userColumns = `
  u.id, u.email, u.full_name, u.phone, u.status,
  u.role_id, r.code AS role_code, r.name AS role_name,
  u.last_login_at, u.created_at, u.updated_at
`;

export const findUserByEmail = async (email) => {
  const result = await query(
    `SELECT ${userColumns}, u.password_hash
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.email = $1`,
    [email]
  );
  return result.rows[0] || null;
};

export const findUserAuthorization = async (userId) => {
  const result = await query(
    `SELECT ${userColumns},
       COALESCE(JSON_AGG(p.code) FILTER (WHERE p.code IS NOT NULL), '[]') AS permissions,
       COALESCE((SELECT JSON_AGG(uw.warehouse_id) FROM user_warehouses uw WHERE uw.user_id = u.id), '[]') AS warehouse_ids
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN role_permissions rp ON rp.role_id = r.id
     LEFT JOIN permissions p ON p.id = rp.permission_id
     WHERE u.id = $1
     GROUP BY u.id, r.id`,
    [userId]
  );
  return result.rows[0] || null;
};

export const updateLastLogin = (userId) => query(
  'UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1',
  [userId]
);

export const listUsers = async ({ limit, offset, search, status }) => {
  const values = [];
  const conditions = [];

  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(u.email ILIKE $${values.length} OR u.full_name ILIKE $${values.length})`);
  }
  if (status) {
    values.push(status);
    conditions.push(`u.status = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countResult = await query(`SELECT COUNT(*)::int AS total FROM users u ${where}`, values);
  values.push(limit, offset);
  const result = await query(
    `SELECT ${userColumns}
     FROM users u JOIN roles r ON r.id = u.role_id
     ${where}
     ORDER BY u.created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return { rows: result.rows, total: countResult.rows[0].total };
};

export const findRoleById = async (roleId) => {
  const result = await query('SELECT id, code, name, description, is_system, created_at, updated_at FROM roles WHERE id = $1', [roleId]);
  return result.rows[0] || null;
};

export const findRoleByCode = async (code) => {
  const result = await query('SELECT id, code, name, description, is_system, created_at, updated_at FROM roles WHERE code = $1', [code]);
  return result.rows[0] || null;
};

export const listRoles = async () => {
  const result = await query(
    `SELECT r.id, r.code, r.name, r.description, r.is_system, r.created_at, r.updated_at,
       COUNT(rp.permission_id)::int AS permission_count
     FROM roles r
     LEFT JOIN role_permissions rp ON rp.role_id = r.id
     GROUP BY r.id
     ORDER BY r.is_system DESC, r.name ASC`
  );
  return result.rows;
};

export const createRole = async ({ code, name, description }) => {
  const result = await query(
    `INSERT INTO roles (code, name, description)
     VALUES ($1, $2, $3)
     RETURNING id, code, name, description, is_system, created_at, updated_at`,
    [code, name, description || null]
  );
  return result.rows[0];
};

export const updateRole = async (roleId, { name, description }) => {
  const result = await query(
    `UPDATE roles SET name = COALESCE($2, name), description = COALESCE($3, description), updated_at = NOW()
     WHERE id = $1
     RETURNING id, code, name, description, is_system, created_at, updated_at`,
    [roleId, name || null, description === undefined ? null : description]
  );
  return result.rows[0] || null;
};

export const listPermissions = async () => {
  const result = await query(
    `SELECT id, code, name, module, action, description, created_at
     FROM permissions ORDER BY module ASC, action ASC`
  );
  return result.rows;
};

export const findPermissionsByIds = async (permissionIds) => {
  const result = await query('SELECT id, code FROM permissions WHERE id = ANY($1::uuid[])', [permissionIds]);
  return result.rows;
};

export const replaceRolePermissions = async (roleId, permissionIds) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);
    if (permissionIds.length) {
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT $1, unnest($2::uuid[])`,
        [roleId, permissionIds]
      );
    }
    await client.query('UPDATE roles SET updated_at = NOW() WHERE id = $1', [roleId]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const createUser = async ({ email, passwordHash, fullName, phone, roleId }) => {
  const result = await query(
    `INSERT INTO users (email, password_hash, full_name, phone, role_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, full_name, phone, status, role_id, created_at, updated_at`,
    [email, passwordHash, fullName, phone || null, roleId]
  );
  return result.rows[0];
};

export const createCustomer = (input) => withTransaction(async (client) => {
  const user = await client.query(`INSERT INTO users (email, password_hash, full_name, phone, role_id)
    VALUES ($1,$2,$3,$4,$5) RETURNING id, email, full_name, phone, status, role_id, created_at`,
    [input.email, input.passwordHash, input.fullName, input.phone, input.roleId]);
  await client.query(`INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id)
    VALUES ($1,'customer_register','user',$1)`, [user.rows[0].id]);
  return user.rows[0];
});

export const updateUser = async (userId, { fullName, phone, status, roleId }) => {
  const result = await query(
    `UPDATE users SET
       full_name = COALESCE($2, full_name),
       phone = COALESCE($3, phone),
       status = COALESCE($4, status),
       role_id = COALESCE($5, role_id),
       updated_at = NOW()
     WHERE id = $1
     RETURNING id, email, full_name, phone, status, role_id, created_at, updated_at`,
    [userId, fullName || null, phone || null, status || null, roleId || null]
  );
  return result.rows[0] || null;
};

export const writeAuditLog = async ({ actorUserId, action, entityType, entityId, metadata, ipAddress }) => {
  await query(
    `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata, ip_address)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
    [actorUserId, action, entityType, entityId || null, JSON.stringify(metadata || {}), ipAddress || null]
  );
};
