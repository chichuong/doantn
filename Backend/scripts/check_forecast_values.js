import { query, closeDatabase } from '../src/config/database.js';

async function checkForecastRun() {
  try {
    const res = await query(`
      SELECT fv.id, fv.product_id, p.sku, p.name, fv.forecast_date, fv.predicted_quantity
      FROM forecast_values fv
      JOIN products p ON p.id = fv.product_id
      ORDER BY fv.forecast_date, p.sku
      LIMIT 15;
    `);
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await closeDatabase();
  }
}

checkForecastRun();
