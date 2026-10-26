import { pool, query } from '../config/database.js';

export const listForecastProducts = async (productId) => {
  const values = productId ? [productId] : [];
  const filter = productId ? 'AND p.id = $1' : '';
  const result = await query(
    `SELECT p.id, p.sku, p.name FROM products p WHERE p.is_active = TRUE ${filter} ORDER BY p.name`,
    values
  );
  return result.rows;
};

export const getHistoricalDemand = async ({ productId, warehouseId, fromDate, toDate }) => {
  const values = [fromDate, toDate];
  const conditions = [
    "o.status = 'delivered'",
    "o.channel IN ('pos', 'web', 'mobile')",
    "o.created_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')",
    "o.created_at < (($2::date + 1)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')",
    'oi.product_id = $3'
  ];
  values.push(productId);
  if (warehouseId) {
    values.push(warehouseId);
    conditions.push(`o.warehouse_id = $${values.length}`);
  }
  const result = await query(
    `SELECT TO_CHAR(o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS demand_date, SUM(oi.quantity)::bigint AS quantity
     FROM orders o JOIN order_items oi ON oi.order_id = o.id
     WHERE ${conditions.join(' AND ')}
     GROUP BY TO_CHAR(o.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') ORDER BY demand_date ASC`,
    values
  );
  return result.rows;
};

export const createForecastRun = async ({ modelName, lookbackDays, horizonDays, fromDate, toDate, warehouseId, metadata = {}, createdBy, mae, rmse, values }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const run = await client.query(
      `INSERT INTO forecast_runs
       (model_name, status, lookback_days, horizon_days, from_date, to_date, mae, rmse, created_by, warehouse_id, metadata, completed_at)
       VALUES ($1, 'completed', $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NOW()) RETURNING id`,
      [modelName, lookbackDays, horizonDays, fromDate, toDate, mae, rmse, createdBy, warehouseId || null, JSON.stringify(metadata)]
    );
    for (const value of values) {
      await client.query(
        `INSERT INTO forecast_values
         (run_id, product_id, warehouse_id, forecast_date, predicted_quantity, lower_bound, upper_bound)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [run.rows[0].id, value.productId, value.warehouseId || null, value.forecastDate, value.predictedQuantity, value.lowerBound, value.upperBound]
      );
    }
    await client.query('COMMIT');
    return getForecastRun(run.rows[0].id);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
};

export const getForecastRun = async (runId) => {
  const header = await query(
    `SELECT id, model_name, status, lookback_days, horizon_days,
       TO_CHAR(from_date, 'YYYY-MM-DD') AS from_date, TO_CHAR(to_date, 'YYYY-MM-DD') AS to_date,
       mae, rmse, warehouse_id, metadata, created_by, created_at, completed_at
     FROM forecast_runs WHERE id = $1`,
    [runId]
  );
  if (!header.rows[0]) return null;
  const values = await query(
    `SELECT f.id, f.product_id, p.sku, p.name, f.warehouse_id, w.code AS warehouse_code,
       TO_CHAR(f.forecast_date, 'YYYY-MM-DD') AS forecast_date, f.predicted_quantity, f.lower_bound, f.upper_bound
     FROM forecast_values f JOIN products p ON p.id = f.product_id
     LEFT JOIN warehouses w ON w.id = f.warehouse_id
     WHERE f.run_id = $1 ORDER BY f.forecast_date, p.name`,
    [runId]
  );
  return { ...header.rows[0], values: values.rows };
};

export const listForecastRuns = async ({ limit, offset }) => {
  const count = await query('SELECT COUNT(*)::int AS total FROM forecast_runs');
  const result = await query(
    `SELECT id, model_name, status, lookback_days, horizon_days,
       TO_CHAR(from_date, 'YYYY-MM-DD') AS from_date, TO_CHAR(to_date, 'YYYY-MM-DD') AS to_date,
       mae, rmse, warehouse_id, metadata, created_at, completed_at
     FROM forecast_runs ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return { rows: result.rows, total: count.rows[0].total };
};

export const getForecastAlerts = async ({ runId, warehouseId, fromDate, toDate }) => {
  const values = [runId, fromDate, toDate, warehouseId || null];
  const result = await query(
    `WITH demand AS (
       SELECT f.product_id, SUM(f.predicted_quantity)::numeric(14,2) AS predicted_quantity
       FROM forecast_values f
       WHERE f.run_id = $1 AND f.forecast_date >= $2::date AND f.forecast_date <= $3::date
         AND f.warehouse_id IS NOT DISTINCT FROM $4::uuid
       GROUP BY f.product_id
     ), stock AS (
       SELECT i.product_id, SUM(i.quantity - i.reserved_quantity)::int AS available_quantity
       FROM inventory i JOIN warehouses w ON w.id = i.warehouse_id
       WHERE w.is_active = TRUE AND ($4::uuid IS NULL OR i.warehouse_id = $4) GROUP BY i.product_id
     )
     SELECT d.product_id, p.sku, p.name, d.predicted_quantity,
       COALESCE(s.available_quantity, 0)::int AS available_quantity,
       GREATEST(CEIL(d.predicted_quantity - COALESCE(s.available_quantity, 0)), 0)::int AS recommended_quantity
     FROM demand d JOIN products p ON p.id = d.product_id LEFT JOIN stock s ON s.product_id = d.product_id
     WHERE d.predicted_quantity > COALESCE(s.available_quantity, 0)
     ORDER BY recommended_quantity DESC, p.name`,
    values
  );
  return result.rows;
};

export const getWarehouseCode = async (id) => {
  const result = await query('SELECT code FROM warehouses WHERE id = $1 AND is_active = TRUE', [id]);
  return result.rows[0]?.code || null;
};
