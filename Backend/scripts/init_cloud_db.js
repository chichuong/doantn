import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sql from 'mssql';
import { env } from '../src/config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  'data_exchange_jobs',
];

const COMPUTED_COLUMNS = {
  order_items: new Set(['line_total']),
  inventory_transactions: new Set(['reference_id']),
};

async function initCloudDb() {
  const masterConfig = {
    user: env.dbUser,
    password: env.dbPassword,
    server: env.dbHost,
    port: env.dbPort,
    database: 'master',
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
  };

  console.log(`[CloudDB] Connecting to SQL Server at ${env.dbHost}:${env.dbPort}...`);
  const masterPool = await sql.connect(masterConfig);
  await masterPool.request().query(`
    IF DB_ID('${env.dbName}') IS NULL
    BEGIN
      CREATE DATABASE [${env.dbName}] COLLATE Vietnamese_CI_AS;
    END
  `);
  await masterPool.close();

  const dbPool = await sql.connect({ ...masterConfig, database: env.dbName });
  try {
    const checkTbl = await dbPool.request().query(
      "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'users'"
    );
    if (checkTbl.recordset[0].cnt > 0) {
      const userCnt = await dbPool.request().query('SELECT COUNT(*) AS cnt FROM dbo.users');
      if (userCnt.recordset[0].cnt > 0) {
        console.log(`[CloudDB] Database ${env.dbName} already initialized with ${userCnt.recordset[0].cnt} users. Skipping seed.`);
        return;
      }
    }

    console.log('[CloudDB] Applying database/sqlserver_schema.sql...');
    const schemaPath = path.resolve(__dirname, '../database/sqlserver_schema.sql');
    const schemaSql = await fs.readFile(schemaPath, 'utf8');
    const batches = schemaSql.split(/^\s*GO\s*$/gim).map((b) => b.trim()).filter(Boolean);
    for (const batch of batches) {
      await dbPool.request().query(batch);
    }

    console.log('[CloudDB] Loading seed data from database/cloud_seed_data.json...');
    const seedPath = path.resolve(__dirname, '../database/cloud_seed_data.json');
    const seedData = JSON.parse(await fs.readFile(seedPath, 'utf8'));

    await dbPool.request().query(`
      EXEC sp_msforeachtable 'ALTER TABLE ? NOCHECK CONSTRAINT ALL';
      IF OBJECT_ID('dbo.trg_orders_enforce_state_transition', 'TR') IS NOT NULL
        DISABLE TRIGGER dbo.trg_orders_enforce_state_transition ON dbo.orders;
    `);

    for (const table of TABLES) {
      const rows = seedData[table] || [];
      if (!rows.length) continue;
      const skipCols = COMPUTED_COLUMNS[table] || new Set();
      const cols = Object.keys(rows[0]).filter((c) => !skipCols.has(c));
      const colList = cols.map((c) => `[${c}]`).join(', ');

      for (const row of rows) {
        const req = dbPool.request();
        const paramNames = [];
        cols.forEach((col, idx) => {
          const pName = `p${idx}`;
          paramNames.push(`@${pName}`);
          let val = row[col];
          if (val !== null && typeof val === 'object') {
            val = JSON.stringify(val);
          } else if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(val)) {
            val = new Date(val);
          }
          req.input(pName, val);
        });
        await req.query(`INSERT INTO dbo.[${table}] (${colList}) VALUES (${paramNames.join(', ')})`);
      }
      console.log(`[CloudDB] ✓ Seeded ${table}: ${rows.length} rows`);
    }

    await dbPool.request().query(`
      EXEC sp_msforeachtable 'ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL';
      IF OBJECT_ID('dbo.trg_orders_enforce_state_transition', 'TR') IS NOT NULL
        ENABLE TRIGGER dbo.trg_orders_enforce_state_transition ON dbo.orders;
    `);
    console.log('[CloudDB] Cloud SQL Server initialization complete!');
  } finally {
    await dbPool.close();
  }
}

initCloudDb().catch((err) => {
  console.error('[CloudDB] Failed to initialize DB:', err);
  process.exit(1);
});
