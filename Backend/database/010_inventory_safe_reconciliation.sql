-- SAFE RECONCILIATION BEFORE MIGRATION 010
-- Stop the API/workers and take a backup before running this file.
-- Business invariant at schema 009:
-- reserved_quantity = sum(order_items.quantity) for open web/mobile orders
-- in pending, confirmed or processing status at the order's warehouse.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';
SELECT pg_advisory_xact_lock(hashtext('migration-010-inventory-reconciliation'));
LOCK TABLE orders, order_items, inventory IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE _m010_expected_reservations ON COMMIT DROP AS
SELECT o.warehouse_id, oi.product_id, SUM(oi.quantity)::integer AS expected_reserved_quantity
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.channel IN ('web', 'mobile')
  AND o.status IN ('pending', 'confirmed', 'processing')
GROUP BY o.warehouse_id, oi.product_id;

-- Block instead of guessing when order/reservation evidence is incomplete.
DO $validation$
BEGIN
  IF EXISTS (
    SELECT 1 FROM orders o
    WHERE o.channel IN ('web', 'mobile')
      AND o.status IN ('pending', 'confirmed', 'processing')
      AND o.warehouse_id IS NULL
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Cannot reconcile: an open online order has no warehouse_id',
      HINT = 'Use the detailed queries in 010_inventory_preflight.sql and assign a warehouse from business evidence.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM orders o
    WHERE o.channel IN ('web', 'mobile')
      AND o.status IN ('pending', 'confirmed', 'processing')
      AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)
  ) THEN
    RAISE EXCEPTION 'Cannot reconcile: an open online order has no order items';
  END IF;

  IF EXISTS (
    SELECT 1 FROM _m010_expected_reservations e
    LEFT JOIN inventory i
      ON i.warehouse_id = e.warehouse_id AND i.product_id = e.product_id
    WHERE i.product_id IS NULL
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Cannot reconcile: an order item has no inventory row at its order warehouse',
      HINT = 'Create or verify the correct warehouse/product inventory record from stock records; do not invent quantity.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM _m010_expected_reservations e
    JOIN inventory i
      ON i.warehouse_id = e.warehouse_id AND i.product_id = e.product_id
    WHERE e.expected_reserved_quantity > i.quantity
  ) THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Cannot reconcile: expected reservation exceeds physical inventory',
      HINT = 'Review the contributing open orders and physical stock before changing counters.';
  END IF;
END
$validation$;

-- Result grid: exact changes that will be applied by the next statement.
SELECT i.warehouse_id, w.code AS warehouse_code,
  i.product_id, p.sku,
  i.quantity,
  i.reserved_quantity AS old_reserved_quantity,
  COALESCE(e.expected_reserved_quantity, 0) AS new_reserved_quantity,
  COALESCE(e.expected_reserved_quantity, 0) - i.reserved_quantity AS difference
FROM inventory i
JOIN warehouses w ON w.id = i.warehouse_id
JOIN products p ON p.id = i.product_id
LEFT JOIN _m010_expected_reservations e
  ON e.warehouse_id = i.warehouse_id AND e.product_id = i.product_id
WHERE i.reserved_quantity <> COALESCE(e.expected_reserved_quantity, 0)
ORDER BY w.code, p.sku;

WITH targets AS (
  SELECT i.warehouse_id, i.product_id,
    i.reserved_quantity AS old_reserved_quantity,
    COALESCE(e.expected_reserved_quantity, 0)::integer AS new_reserved_quantity
  FROM inventory i
  LEFT JOIN _m010_expected_reservations e
    ON e.warehouse_id = i.warehouse_id AND e.product_id = i.product_id
  WHERE i.reserved_quantity <> COALESCE(e.expected_reserved_quantity, 0)
), updated AS (
  UPDATE inventory i
  SET reserved_quantity = t.new_reserved_quantity,
      updated_at = NOW()
  FROM targets t
  WHERE i.warehouse_id = t.warehouse_id AND i.product_id = t.product_id
  RETURNING i.warehouse_id, i.product_id,
    t.old_reserved_quantity, t.new_reserved_quantity
)
INSERT INTO audit_logs (action, entity_type, metadata)
SELECT 'migration_010_reconcile_reserved_quantity', 'inventory',
  jsonb_build_object(
    'warehouse_id', warehouse_id,
    'product_id', product_id,
    'old_reserved_quantity', old_reserved_quantity,
    'new_reserved_quantity', new_reserved_quantity,
    'rule', 'sum of open web/mobile order items at the order warehouse',
    'database_user', CURRENT_USER
  )
FROM updated;

DO $assertion$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM inventory i
    FULL JOIN _m010_expected_reservations e
      ON e.warehouse_id = i.warehouse_id AND e.product_id = i.product_id
    WHERE COALESCE(i.reserved_quantity, 0) <> COALESCE(e.expected_reserved_quantity, 0)
      OR (e.expected_reserved_quantity IS NOT NULL AND i.product_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Post-reconciliation assertion failed; all changes will be rolled back';
  END IF;
END
$assertion$;

-- Must return zero rows.
SELECT i.warehouse_id, i.product_id, i.quantity, i.reserved_quantity,
  COALESCE(e.expected_reserved_quantity, 0) AS expected_reserved_quantity
FROM inventory i
FULL JOIN _m010_expected_reservations e
  ON e.warehouse_id = i.warehouse_id AND e.product_id = i.product_id
WHERE COALESCE(i.reserved_quantity, 0) <> COALESCE(e.expected_reserved_quantity, 0)
  OR (e.expected_reserved_quantity IS NOT NULL AND i.product_id IS NULL);

COMMIT;
