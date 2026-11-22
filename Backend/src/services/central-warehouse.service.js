import { query } from '../config/database.js';

let cachedCentralWarehouse = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

export const getCentralWarehouse = async () => {
  const now = Date.now();
  if (cachedCentralWarehouse && (now - lastFetchTime < CACHE_TTL_MS)) {
    return cachedCentralWarehouse;
  }

  // 1. Try finding WH-HCM-01
  let res = await query(
    `SELECT id, code, name, address, is_active
     FROM warehouses
     WHERE code = 'WH-HCM-01'
     LIMIT 1`
  );

  // 2. Fallback to any active warehouse
  if (!res.rows[0]) {
    res = await query(
      `SELECT id, code, name, address, is_active
       FROM warehouses
       WHERE is_active = TRUE
       ORDER BY created_at ASC
       LIMIT 1`
    );
  }

  // 3. Fallback: create default if missing
  if (!res.rows[0]) {
    await query(
      `MERGE INTO warehouses AS target
       USING (SELECT 'WH-HCM-01' AS code) AS source ON target.code = source.code
       WHEN MATCHED THEN UPDATE SET is_active = 1, updated_at = NOW()
       WHEN NOT MATCHED THEN INSERT (code, name, address, is_active)
         VALUES ('WH-HCM-01', N'Kho trung tâm TP Hồ Chí Minh', N'236 Lê Văn Sỹ, Phường 1, Tân Bình, TP Hồ Chí Minh', 1);`
    );
    res = await query(
      `SELECT id, code, name, address, is_active FROM warehouses WHERE code = 'WH-HCM-01'`
    );
  }

  cachedCentralWarehouse = res.rows[0];
  lastFetchTime = now;
  return cachedCentralWarehouse;
};

export const getCentralWarehouseId = async () => {
  const wh = await getCentralWarehouse();
  return wh.id;
};

export const clearCentralWarehouseCache = () => {
  cachedCentralWarehouse = null;
  lastFetchTime = 0;
};
