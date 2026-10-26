import { query } from '../config/database.js';
import { withTransaction } from '../utils/transaction.js';

export const findCategoryNames = async (names) => {
  const result = await query('SELECT name FROM categories WHERE LOWER(BTRIM(name)) = ANY($1::text[])', [names]);
  return result.rows;
};

export const importCategories = ({ rows, job }) => withTransaction(async (client) => {
  for (const row of rows) {
    try {
      await client.query(`INSERT INTO categories (name, description, is_active) VALUES ($1,$2,$3)`,
        [row.name, row.description || null, row.isActive]);
    } catch (error) { error.rowNumber = row.rowNumber; throw error; }
  }
  await client.query(`UPDATE data_exchange_jobs SET status = 'completed', total_rows = $2, success_rows = $2,
    error_rows = 0, errors = '[]'::jsonb, error_details = '[]'::jsonb, completed_at = NOW() WHERE id = $1`, [job.id, rows.length]);
});

export const exportCategories = async () => (await query(`SELECT name, description, is_active FROM categories ORDER BY name`)).rows;

export const exportSales = async ({ from, to }) => (await query(`SELECT
  (o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS date, o.channel,
  COUNT(*)::int AS orders,
  COUNT(*) FILTER (WHERE o.status = 'delivered')::int AS completed_orders,
  COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'delivered'), 0)::numeric(14,2) AS revenue,
  COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'returned'), 0)::numeric(14,2) AS returned_amount
  FROM orders o WHERE o.created_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
    AND o.created_at < (($2::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
  GROUP BY (o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, o.channel ORDER BY date, o.channel`, [from, to])).rows;
