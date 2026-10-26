import { query } from '../config/database.js';

export const listCategories = async ({ search, isActive, limit, offset }) => {
  const values = [search || null, isActive ?? null];
  const where = `WHERE ($1::text IS NULL OR name ILIKE '%' || $1 || '%') AND ($2::boolean IS NULL OR is_active = $2)`;
  const count = await query(`SELECT COUNT(*)::int AS total FROM categories ${where}`, values);
  const result = await query(`SELECT id, name, description, is_active, created_at, updated_at
    FROM categories ${where} ORDER BY name, id LIMIT $3 OFFSET $4`, [...values, limit, offset]);
  return { rows: result.rows, total: count.rows[0].total };
};
export const createCategory = async ({ name, description, isActive }) => {
  const result = await query(`INSERT INTO categories (name, description, is_active) VALUES ($1,$2,$3) RETURNING *`,
    [name, description ?? null, isActive ?? true]);
  return result.rows[0];
};
export const updateCategory = async (id, input) => {
  const result = await query(`UPDATE categories SET name = COALESCE($2, name),
    description = CASE WHEN $3 THEN $4 ELSE description END,
    is_active = COALESCE($5, is_active), updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, input.name ?? null, Object.hasOwn(input, 'description'), input.description ?? null, input.isActive ?? null]);
  return result.rows[0] || null;
};
