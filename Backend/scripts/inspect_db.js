import { query, closeDatabase } from '../src/config/database.js';

async function main() {
  try {
    console.log('=== PRODUCTS ===');
    const products = await query('SELECT id, sku, barcode, name, sale_price, cost_price, is_active FROM products ORDER BY sku LIMIT 20');
    console.table(products.rows);

    console.log('=== WAREHOUSES ===');
    const warehouses = await query('SELECT id, code, name, is_active FROM warehouses');
    console.table(warehouses.rows);

    console.log('=== INVENTORY ===');
    const inventory = await query(`
      SELECT p.sku, p.name, w.code as wh_code, i.quantity, i.reserved_quantity, (i.quantity - i.reserved_quantity) as available
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      JOIN warehouses w ON w.id = i.warehouse_id
      ORDER BY p.sku
      LIMIT 20
    `);
    console.table(inventory.rows);

    console.log('=== ORDERS COUNT BY STATUS ===');
    const orders = await query('SELECT status, count(*) FROM orders GROUP BY status');
    console.table(orders.rows);

    console.log('=== FORECAST RUNS ===');
    const runs = await query('SELECT id, model_name, status, lookback_days, horizon_days, from_date, to_date, mae, rmse, created_at FROM forecast_runs ORDER BY created_at DESC LIMIT 5');
    console.table(runs.rows);
  } catch (err) {
    console.error('Error querying DB:', err);
  } finally {
    await closeDatabase();
  }
}

main();
