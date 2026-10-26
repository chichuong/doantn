-- READ-ONLY ACCEPTANCE CHECKS. Run only after migration 016 commits successfully.
BEGIN;
SET TRANSACTION READ ONLY;

-- 1. Schema objects created by migration 016.
SELECT
  to_regclass('public.inventory_reservation_reconciliation') IS NOT NULL AS reconciliation_view_exists,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'idempotency_key') AS order_idempotency_exists,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'warehouse_id'
      AND is_nullable = 'NO') AS order_warehouse_is_required,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_reservations' AND column_name = 'expires_at') AS reservation_expiry_exists,
  EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_transactions' AND column_name = 'reference_id') AS transaction_reference_exists,
  EXISTS (SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_orders_enforce_state_transition' AND NOT tgisinternal) AS state_trigger_exists;

-- 2. Distribution after legacy status backfill.
SELECT status, COUNT(*)::int AS orders
FROM orders GROUP BY status ORDER BY status;

-- Must return no rows.
SELECT id, order_number, channel, status
FROM orders
WHERE status NOT IN ('pending','confirmed','ready_to_pack','packed','handover',
  'shipping','delivered','cancelled','returned')
ORDER BY created_at, id;

-- Must return one row containing zeros.
SELECT
  COUNT(*) FILTER (WHERE warehouse_id IS NULL)::int AS missing_warehouse,
  COUNT(*) FILTER (WHERE channel = 'pos' AND pos_session_id IS NULL)::int AS missing_pos_session,
  COUNT(*) FILTER (WHERE channel <> 'pos' AND pos_session_id IS NOT NULL)::int AS non_pos_with_session,
  (SELECT COUNT(*) FROM orders x JOIN pos_sessions s ON s.id = x.pos_session_id
    WHERE x.channel = 'pos' AND x.warehouse_id IS DISTINCT FROM s.warehouse_id)::int AS pos_warehouse_mismatch
FROM orders;

-- 3. Held online orders: every item needs one exact active reservation.
-- Must return no rows.
SELECT o.id AS order_id, o.order_number, o.status, oi.id AS order_item_id,
  o.warehouse_id AS expected_warehouse_id, oi.product_id AS expected_product_id,
  oi.quantity AS expected_quantity, r.id AS reservation_id,
  r.warehouse_id AS actual_warehouse_id, r.product_id AS actual_product_id,
  r.quantity AS actual_quantity, r.status AS reservation_status
FROM orders o JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN inventory_reservations r ON r.order_item_id = oi.id
WHERE o.channel IN ('web','mobile')
  AND o.status IN ('pending','confirmed','ready_to_pack')
  AND (r.id IS NULL OR r.status <> 'active'
    OR r.warehouse_id IS DISTINCT FROM o.warehouse_id
    OR r.product_id IS DISTINCT FROM oi.product_id
    OR r.quantity IS DISTINCT FROM oi.quantity)
ORDER BY o.created_at, o.id, oi.id;

-- Active reservations on another order state are invalid. Must return no rows.
SELECT o.id AS order_id, o.order_number, o.status, r.id AS reservation_id,
  r.warehouse_id, r.product_id, r.quantity
FROM inventory_reservations r
JOIN order_items oi ON oi.id = r.order_item_id
JOIN orders o ON o.id = oi.order_id
WHERE r.status = 'active'
  AND NOT (o.channel IN ('web','mobile') AND o.status IN ('pending','confirmed','ready_to_pack'))
ORDER BY o.created_at, o.id, r.id;

-- 4. Required reconciliation requested for acceptance. Must return no rows.
SELECT *
FROM inventory_reservation_reconciliation
WHERE NOT is_balanced
ORDER BY warehouse_id, product_id;

-- 5. Latest state history must agree with the current order state. Must return no rows.
SELECT o.id, o.order_number, o.status AS order_status,
  h.status AS latest_history_status, h.created_at AS latest_history_at
FROM orders o
LEFT JOIN LATERAL (
  SELECT status, created_at FROM order_status_history
  WHERE order_id = o.id ORDER BY created_at DESC, id DESC LIMIT 1
) h ON TRUE
WHERE h.status IS NULL OR h.status IS DISTINCT FROM o.status
ORDER BY o.created_at, o.id;

-- 6. Reference structure must have at most one source and generated reference_id must match it.
-- Must return no rows.
SELECT id, order_id, pos_order_id, document_id, reference_id
FROM inventory_transactions
WHERE num_nonnulls(order_id, pos_order_id, document_id) > 1
   OR reference_id IS DISTINCT FROM COALESCE(order_id, pos_order_id, document_id)
ORDER BY created_at, id;

-- 7. Audit trail produced by the backfill and migration.
SELECT id, actor_user_id, action, entity_id, metadata, created_at
FROM audit_logs
WHERE action LIKE 'migration_016_%'
ORDER BY created_at, id;

ROLLBACK;
