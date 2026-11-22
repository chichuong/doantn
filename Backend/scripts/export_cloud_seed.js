import fs from 'node:fs/promises';
import { query, closeDatabase } from '../src/config/database.js';

async function exportAll() {
  const tblRes = await query(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
  );
  const allTables = tblRes.rows.map((r) => r.TABLE_NAME);

  // Dependency order first, then any remaining tables
  const priority = [
    'roles',
    'permissions',
    'role_permissions',
    'warehouses',
    'users',
    'user_warehouses',
    'categories',
    'products',
    'inventory',
    'orders',
    'order_items',
    'order_status_history',
    'payments',
    'shipments',
    'pos_sessions',
  ];
  const ordered = [
    ...priority.filter((t) => allTables.includes(t)),
    ...allTables.filter((t) => !priority.includes(t)),
  ];

  const dump = {};
  for (const tbl of ordered) {
    try {
      const res = await query(`SELECT * FROM dbo.[${tbl}]`);
      dump[tbl] = res.rows;
      console.log(`Exported ${tbl}: ${res.rows.length} rows`);
    } catch (err) {
      console.warn(`Skipped ${tbl}: ${err.message}`);
    }
  }
  await fs.writeFile('database/cloud_seed_data.json', JSON.stringify(dump, null, 2), 'utf8');
  console.log('Saved database/cloud_seed_data.json');
  await closeDatabase();
}

exportAll();
