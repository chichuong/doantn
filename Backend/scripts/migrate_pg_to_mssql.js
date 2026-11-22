import pg from 'pg';
import sql from 'mssql';
import 'dotenv/config';

const pgPool = new pg.Pool({
  host: process.env.PG_HOST || 'localhost',
  port: Number(process.env.PG_PORT || 5432),
  database: process.env.PG_NAME || 'Karat_retail',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '123456'
});

const mssqlConfig = {
  user: 'karat_user',
  password: '123456',
  server: 'localhost',
  port: 14333,
  database: 'Karat_retail',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

// Tables in topological dependency order
const TABLES = [
  'roles',
  'permissions',
  'users',
  'role_permissions',
  'audit_logs',
  'categories',
  'products',
  'warehouses',
  'user_warehouses',
  'inventory',
  'customer_addresses',
  'carts',
  'cart_items',
  'pos_sessions',
  'warehouse_documents',
  'warehouse_document_items',
  'warehouse_document_scan_events',
  'orders',
  'order_items',
  'inventory_reservations',
  'inventory_transactions',
  'api_idempotency_keys',
  'order_status_history',
  'bank_transfer_requests',
  'payments',
  'manual_refunds',
  'shipments',
  'shipment_status_history',
  'order_processing_tasks',
  'order_scan_events',
  'order_return_receipts',
  'order_return_receipt_items',
  'forecast_runs',
  'forecast_values',
  'data_exchange_jobs'
];

// Computed columns in SQL Server that must not be inserted directly
const COMPUTED_COLUMNS = {
  order_items: new Set(['line_total']),
  inventory_transactions: new Set(['reference_id'])
};

async function migrateData() {
  const mssqlPool = await sql.connect(mssqlConfig);
  try {
    console.log('Connected to both PostgreSQL and SQL Server (Karat_retail)!');

    // Disable all constraints and triggers temporarily for clean bulk load
    await mssqlPool.request().query(`
      EXEC sp_msforeachtable 'ALTER TABLE ? NOCHECK CONSTRAINT ALL';
      DISABLE TRIGGER dbo.trg_orders_enforce_state_transition ON dbo.orders;
    `);

    // Clear existing data in reverse order
    for (const table of [...TABLES].reverse()) {
      await mssqlPool.request().query(`DELETE FROM dbo.[${table}]`);
    }

    for (const table of TABLES) {
      const pgRes = await pgPool.query(`SELECT * FROM "${table}"`);
      const rows = pgRes.rows;
      if (!rows.length) {
        console.log(`- ${table}: 0 rows (skipped)`);
        continue;
      }

      const skipCols = COMPUTED_COLUMNS[table] || new Set();
      const cols = Object.keys(rows[0]).filter((c) => !skipCols.has(c));
      const colList = cols.map((c) => `[${c}]`).join(', ');

      for (const row of rows) {
        const req = mssqlPool.request();
        const paramNames = [];
        cols.forEach((col, idx) => {
          const pName = `p${idx}`;
          paramNames.push(`@${pName}`);
          let val = row[col];
          if (val !== null && typeof val === 'object' && !(val instanceof Date) && !Buffer.isBuffer(val)) {
            val = JSON.stringify(val);
          }
          req.input(pName, val);
        });
        await req.query(`INSERT INTO dbo.[${table}] (${colList}) VALUES (${paramNames.join(', ')})`);
      }

      const checkRes = await mssqlPool.request().query(`SELECT COUNT(*) AS cnt FROM dbo.[${table}]`);
      console.log(`✓ ${table}: migrated ${rows.length} rows (SQL Server count: ${checkRes.recordset[0].cnt})`);
    }

    // Re-enable all constraints (WITH CHECK) and triggers
    await mssqlPool.request().query(`
      EXEC sp_msforeachtable 'ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL';
      ENABLE TRIGGER dbo.trg_orders_enforce_state_transition ON dbo.orders;
    `);
    console.log('\nAll foreign keys, check constraints, and triggers verified and re-enabled!');

    // Verify views
    const v1 = await mssqlPool.request().query('SELECT COUNT(*) AS cnt FROM dbo.inventory_reservation_discrepancies');
    const v2 = await mssqlPool.request().query('SELECT COUNT(*) AS cnt FROM dbo.inventory_reservation_reconciliation');
    console.log(`View inventory_reservation_discrepancies: ${v1.recordset[0].cnt} rows`);
    console.log(`View inventory_reservation_reconciliation: ${v2.recordset[0].cnt} rows`);
  } finally {
    await mssqlPool.close();
    await pgPool.end();
  }
}

migrateData().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
