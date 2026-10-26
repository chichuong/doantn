import fs from 'node:fs/promises';
import { pool, closeDatabase } from '../src/config/database.js';

// Read-only preparation; never resets counters or modifies schema.
try {
  const sql = await fs.readFile(new URL('../database/010_inventory_preflight.sql', import.meta.url), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN READ ONLY');
    const results = await client.query(sql);
    await client.query('COMMIT');
    const names = [
      'online_orders_without_warehouse',
      'reservation_discrepancies',
      'reservation_contributing_orders',
      'legacy_pos_warehouse_evidence',
      'duplicate_category_names'
    ];
    console.log(JSON.stringify(Object.fromEntries(results.map((result, i) => [names[i], { count: result.rowCount, rows: result.rows }])), null, 2));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
} catch (error) {
  console.error('Preflight failed:', error.code || error.message);
  process.exitCode = 1;
} finally { await closeDatabase(); }
