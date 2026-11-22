BEGIN;

-- 1. Ensure central warehouse WH-HCM-01 exists and is active
INSERT INTO warehouses (code, name, address, is_active)
VALUES (
  'WH-HCM-01',
  'Kho trung tâm TP Hồ Chí Minh',
  '236 Lê Văn Sỹ, Phường 1, Tân Bình, TP Hồ Chí Minh',
  TRUE
)
ON CONFLICT (code) DO UPDATE SET
  is_active = TRUE,
  name = COALESCE(warehouses.name, EXCLUDED.name),
  updated_at = NOW();

-- 2. Mark any secondary warehouses as inactive (preserving all foreign keys and historical orders)
-- This enforces single central warehouse business logic while keeping historical data intact.
UPDATE warehouses
SET is_active = FALSE, updated_at = NOW()
WHERE code <> 'WH-HCM-01' AND is_active = TRUE;

-- 3. Ensure all active products have inventory entries at central warehouse
INSERT INTO inventory (warehouse_id, product_id, quantity, reserved_quantity, updated_at)
SELECT w.id, p.id, 0, 0, NOW()
FROM warehouses w
CROSS JOIN products p
WHERE w.code = 'WH-HCM-01'
ON CONFLICT (warehouse_id, product_id) DO NOTHING;

-- 4. Assign central warehouse access to all staff with warehouse, pos, sales, manager, or admin roles
INSERT INTO user_warehouses (user_id, warehouse_id)
SELECT u.id, w.id
FROM users u
CROSS JOIN warehouses w
JOIN roles r ON r.id = u.role_id
WHERE w.code = 'WH-HCM-01'
  AND r.code IN ('warehouse', 'pos', 'sales', 'manager', 'admin', 'order_processor')
ON CONFLICT DO NOTHING;

-- 4b. Ensure manager role has warehouse.orders.pack and warehouse.orders.returns for end-to-end order lifecycle on Web
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'manager'
  AND p.code IN ('warehouse.orders.pack', 'warehouse.orders.returns')
ON CONFLICT DO NOTHING;

-- 5. Close any obsolete open POS sessions that were attached to inactive warehouses
UPDATE pos_sessions
SET status = 'closed', closed_at = NOW(), closing_cash = opening_cash, updated_at = NOW()
WHERE status = 'open' AND warehouse_id <> (SELECT id FROM warehouses WHERE code = 'WH-HCM-01');

COMMIT;
