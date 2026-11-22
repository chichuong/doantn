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
  CONVERT(VARCHAR(10), o.created_at AT TIME ZONE 'SE Asia Standard Time', 23) AS date, o.channel,
  COUNT(*) AS orders,
  SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) AS completed_orders,
  CAST(COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN o.total_amount ELSE 0 END), 0) AS DECIMAL(14,2)) AS revenue,
  CAST(COALESCE(SUM(CASE WHEN o.status = 'returned' THEN o.total_amount ELSE 0 END), 0) AS DECIMAL(14,2)) AS returned_amount
  FROM orders o WHERE o.created_at >= CAST($1 AS DATE)
    AND o.created_at < DATEADD(day, 1, CAST($2 AS DATE))
  GROUP BY CONVERT(VARCHAR(10), o.created_at AT TIME ZONE 'SE Asia Standard Time', 23), o.channel ORDER BY date, o.channel`, [from, to])).rows;
