-- SAFE BACKFILL FOR MIGRATION 016
-- Stop the API and take a database backup before running this file.
-- Section A performs evidence-backed automatic fixes and writes audit_logs.

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '5min';
SELECT pg_advisory_xact_lock(hashtext('migration-016-safe-backfill'));
LOCK TABLE orders IN SHARE ROW EXCLUSIVE MODE;

-- Never create these objects here. They belong to migrations 010-015. Adding
-- individual columns by hand would make the numbered migrations fail later.
DO $prerequisites$
DECLARE
  missing_objects TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'pos_session_id') THEN
    missing_objects := array_append(missing_objects, 'orders.pos_session_id (migration 010)');
  END IF;
  IF to_regclass('public.inventory_reservations') IS NULL THEN
    missing_objects := array_append(missing_objects, 'inventory_reservations (migration 010)');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'inventory_transactions' AND column_name = 'order_id') THEN
    missing_objects := array_append(missing_objects, 'inventory_transactions.order_id (migration 010)');
  END IF;
  IF to_regclass('public.order_scan_events') IS NULL THEN
    missing_objects := array_append(missing_objects, 'order_scan_events (migration 011)');
  END IF;
  IF to_regclass('public.bank_transfer_requests') IS NULL THEN
    missing_objects := array_append(missing_objects, 'bank_transfer_requests (migration 012)');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'forecast_runs' AND column_name = 'metadata') THEN
    missing_objects := array_append(missing_objects, 'forecast_runs.metadata (migration 013)');
  END IF;
  IF to_regclass('public.user_warehouses') IS NULL THEN
    missing_objects := array_append(missing_objects, 'user_warehouses (migration 014)');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'reservation_expires_at') THEN
    missing_objects := array_append(missing_objects, 'orders.reservation_expires_at (migration 015)');
  END IF;

  IF cardinality(missing_objects) > 0 THEN
    RAISE EXCEPTION USING
      MESSAGE = '016 backfill prerequisites are missing: ' || array_to_string(missing_objects, ', '),
      HINT = 'ROLLBACK, run 010_inventory_preflight.sql, then migrations 010 through 015 in order. Do not ALTER individual columns manually.';
  END IF;
END
$prerequisites$;

-- A0. Repair the one project-owned demo order created by migration 002 before
-- orders.warehouse_id existed. This rule is intentionally limited to the exact
-- seed order and the central warehouse declared in that same seed migration.
WITH updated AS (
  UPDATE orders o
  SET warehouse_id = w.id,
      updated_at = NOW()
  FROM warehouses w
  WHERE o.order_number = 'ORD-SEED-0001'
    AND o.channel = 'web'
    AND o.status = 'completed'
    AND o.warehouse_id IS NULL
    AND w.code = 'WH-HCM-01'
  RETURNING o.id, o.order_number, w.id AS warehouse_id
)
INSERT INTO audit_logs (action, entity_type, entity_id, metadata)
SELECT 'migration_016_backfill_seed_warehouse', 'order', id,
  jsonb_build_object(
    'order_number', order_number,
    'new_warehouse_id', warehouse_id,
    'warehouse_code', 'WH-HCM-01',
    'evidence', 'project seed ORD-SEED-0001 and central warehouse from migration 002',
    'database_user', CURRENT_USER
  )
FROM updated;

-- A1. Recover a POS session only when employee + sale time + warehouse identify exactly one session.
WITH candidates AS (
  SELECT o.id AS order_id, s.id AS session_id, s.warehouse_id, s.opened_at
  FROM orders o JOIN pos_sessions s
    ON s.opened_by = o.created_by
   AND o.created_at >= s.opened_at
   AND o.created_at <= COALESCE(s.closed_at, NOW())
   AND (o.warehouse_id IS NULL OR o.warehouse_id = s.warehouse_id)
  WHERE o.channel = 'pos' AND o.pos_session_id IS NULL
), unique_candidate AS (
  SELECT order_id,
    (ARRAY_AGG(session_id ORDER BY opened_at, session_id))[1] AS session_id,
    (ARRAY_AGG(warehouse_id ORDER BY opened_at, session_id))[1] AS warehouse_id
  FROM candidates GROUP BY order_id HAVING COUNT(*) = 1
), updated AS (
  UPDATE orders o
  SET pos_session_id = c.session_id,
      warehouse_id = COALESCE(o.warehouse_id, c.warehouse_id),
      updated_at = NOW()
  FROM unique_candidate c
  WHERE o.id = c.order_id AND o.channel = 'pos' AND o.pos_session_id IS NULL
  RETURNING o.id, o.order_number, c.session_id, c.warehouse_id
)
INSERT INTO audit_logs (action, entity_type, entity_id, metadata)
SELECT 'migration_016_backfill_pos_session', 'order', id,
  jsonb_build_object(
    'order_number', order_number,
    'pos_session_id', session_id,
    'warehouse_id', warehouse_id,
    'evidence', 'exactly one session matched opened_by and order timestamp',
    'database_user', CURRENT_USER
  )
FROM updated;

-- A2. Recover warehouse only when all available business evidence points to one warehouse.
WITH warehouse_evidence AS (
  SELECT o.id AS order_id, s.warehouse_id, 'stored_pos_session'::text AS source
  FROM orders o JOIN pos_sessions s ON s.id = o.pos_session_id
  WHERE o.warehouse_id IS NULL
  UNION ALL
  SELECT o.id, r.warehouse_id, 'active_reservation'
  FROM orders o JOIN order_items oi ON oi.order_id = o.id
  JOIN inventory_reservations r ON r.order_item_id = oi.id AND r.status = 'active'
  WHERE o.warehouse_id IS NULL
  UNION ALL
  SELECT o.id, t.warehouse_id, 'inventory_transaction_order'
  FROM orders o JOIN inventory_transactions t ON t.order_id = o.id
  WHERE o.warehouse_id IS NULL
  UNION ALL
  SELECT o.id, t.warehouse_id, 'inventory_transaction_reference'
  FROM orders o JOIN inventory_transactions t
    ON t.reference_code = o.order_number AND t.type IN ('issue','receipt')
  WHERE o.warehouse_id IS NULL
), evidence_summary AS (
  SELECT order_id,
    (ARRAY_AGG(DISTINCT warehouse_id ORDER BY warehouse_id))[1] AS warehouse_id,
    ARRAY_AGG(DISTINCT source ORDER BY source) AS evidence_sources
  FROM warehouse_evidence
  GROUP BY order_id HAVING COUNT(DISTINCT warehouse_id) = 1
), updated AS (
  UPDATE orders o SET warehouse_id = e.warehouse_id, updated_at = NOW()
  FROM evidence_summary e
  WHERE o.id = e.order_id AND o.warehouse_id IS NULL
  RETURNING o.id, o.order_number, e.warehouse_id, e.evidence_sources
)
INSERT INTO audit_logs (action, entity_type, entity_id, metadata)
SELECT 'migration_016_backfill_warehouse', 'order', id,
  jsonb_build_object(
    'order_number', order_number,
    'old_warehouse_id', NULL,
    'new_warehouse_id', warehouse_id,
    'evidence_sources', to_jsonb(evidence_sources),
    'database_user', CURRENT_USER
  )
FROM updated;

-- A3. Result grids. Rows here remain unresolved and must not be guessed.
SELECT id, order_number, channel, status, created_by, created_at,
  'WAREHOUSE_STILL_UNRESOLVED' AS issue_code
FROM orders WHERE warehouse_id IS NULL ORDER BY created_at, id;

SELECT id, order_number, warehouse_id, created_by, created_at,
  'POS_SESSION_STILL_UNRESOLVED' AS issue_code
FROM orders WHERE channel = 'pos' AND pos_session_id IS NULL ORDER BY created_at, id;

-- Reservation linkage must return no rows before migration 016.
SELECT o.id AS order_id, o.order_number, o.status, oi.id AS order_item_id,
  oi.product_id, oi.quantity, o.warehouse_id,
  r.id AS reservation_id, r.status AS reservation_status,
  r.product_id AS reservation_product_id, r.quantity AS reservation_quantity,
  r.warehouse_id AS reservation_warehouse_id
FROM orders o JOIN order_items oi ON oi.order_id = o.id
LEFT JOIN inventory_reservations r ON r.order_item_id = oi.id
WHERE o.channel IN ('web','mobile') AND o.status IN ('pending','confirmed','processing')
  AND (r.id IS NULL OR r.status <> 'active'
    OR r.warehouse_id IS DISTINCT FROM o.warehouse_id
    OR r.product_id IS DISTINCT FROM oi.product_id
    OR r.quantity IS DISTINCT FROM oi.quantity)
ORDER BY o.created_at, o.id, oi.id;

COMMIT;

-- SECTION B: OPTIONAL MANUAL DECISIONS FOR ROWS LEFT BY SECTION A.
-- Run this section only after checking invoices, warehouse documents, shift records,
-- or another external business record. Insert real UUIDs between CREATE TEMP TABLE
-- and the validation block. Every decision requires an active admin/manager approver.
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(hashtext('migration-016-manual-backfill'));
LOCK TABLE orders IN SHARE ROW EXCLUSIVE MODE;

DO $manual_prerequisites$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'pos_session_id') THEN
    RAISE EXCEPTION USING
      MESSAGE = 'Manual 016 backfill requires orders.pos_session_id from migration 010',
      HINT = 'ROLLBACK and apply migrations 010 through 015 before running Section B.';
  END IF;
END
$manual_prerequisites$;

CREATE TEMP TABLE manual_order_warehouse_decisions (
  order_id UUID PRIMARY KEY,
  warehouse_id UUID NOT NULL,
  reason TEXT NOT NULL,
  approved_by UUID NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE manual_pos_session_decisions (
  order_id UUID PRIMARY KEY,
  pos_session_id UUID NOT NULL,
  reason TEXT NOT NULL,
  approved_by UUID NOT NULL
) ON COMMIT DROP;

-- Add reviewed decisions here before executing Section B, for example:
-- INSERT INTO manual_order_warehouse_decisions (order_id, warehouse_id, reason, approved_by)
-- VALUES ('real-order-uuid', 'real-warehouse-uuid', 'Invoice ABC proves fulfillment at WH-HCM-01', 'real-admin-uuid');
-- INSERT INTO manual_pos_session_decisions (order_id, pos_session_id, reason, approved_by)
-- VALUES ('real-order-uuid', 'real-session-uuid', 'Signed shift report and receipt timestamp match', 'real-admin-uuid');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM manual_order_warehouse_decisions d
    LEFT JOIN orders o ON o.id = d.order_id
    LEFT JOIN warehouses w ON w.id = d.warehouse_id
    LEFT JOIN users u ON u.id = d.approved_by
    LEFT JOIN roles role ON role.id = u.role_id
    WHERE o.id IS NULL OR o.warehouse_id IS NOT NULL OR w.id IS NULL
      OR LENGTH(BTRIM(d.reason)) < 20 OR u.id IS NULL OR role.id IS NULL
      OR u.status <> 'active' OR role.code NOT IN ('admin','manager')
  ) THEN
    RAISE EXCEPTION 'Invalid manual warehouse decision: verify order, warehouse, reason and approver';
  END IF;
  IF EXISTS (
    SELECT 1 FROM manual_pos_session_decisions d
    LEFT JOIN orders o ON o.id = d.order_id
    LEFT JOIN pos_sessions s ON s.id = d.pos_session_id
    LEFT JOIN users u ON u.id = d.approved_by
    LEFT JOIN roles role ON role.id = u.role_id
    WHERE o.id IS NULL OR o.channel <> 'pos' OR o.pos_session_id IS NOT NULL OR s.id IS NULL
      OR s.opened_by IS DISTINCT FROM o.created_by
      OR o.created_at < s.opened_at OR o.created_at > COALESCE(s.closed_at, NOW())
      OR (o.warehouse_id IS NOT NULL AND o.warehouse_id <> s.warehouse_id)
      OR LENGTH(BTRIM(d.reason)) < 20 OR u.id IS NULL OR role.id IS NULL
      OR u.status <> 'active' OR role.code NOT IN ('admin','manager')
  ) THEN
    RAISE EXCEPTION 'Invalid manual POS session decision: verify employee, time, warehouse, reason and approver';
  END IF;
  IF EXISTS (
    SELECT 1 FROM manual_pos_session_decisions p
    JOIN pos_sessions s ON s.id = p.pos_session_id
    JOIN manual_order_warehouse_decisions w ON w.order_id = p.order_id
    WHERE w.warehouse_id <> s.warehouse_id
  ) THEN
    RAISE EXCEPTION 'Manual warehouse and POS session decisions disagree for the same order';
  END IF;
END $$;

WITH updated AS (
  UPDATE orders o SET warehouse_id = d.warehouse_id, updated_at = NOW()
  FROM manual_order_warehouse_decisions d
  WHERE o.id = d.order_id AND o.warehouse_id IS NULL
  RETURNING o.id, o.order_number, d.warehouse_id, d.reason, d.approved_by
)
INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
SELECT approved_by, 'migration_016_manual_warehouse', 'order', id,
  jsonb_build_object('order_number', order_number, 'new_warehouse_id', warehouse_id,
    'reason', reason, 'database_user', CURRENT_USER)
FROM updated;

WITH updated AS (
  UPDATE orders o
  SET pos_session_id = d.pos_session_id,
      warehouse_id = COALESCE(o.warehouse_id, s.warehouse_id),
      updated_at = NOW()
  FROM manual_pos_session_decisions d JOIN pos_sessions s ON s.id = d.pos_session_id
  WHERE o.id = d.order_id AND o.channel = 'pos' AND o.pos_session_id IS NULL
  RETURNING o.id, o.order_number, d.pos_session_id, s.warehouse_id, d.reason, d.approved_by
)
INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
SELECT approved_by, 'migration_016_manual_pos_session', 'order', id,
  jsonb_build_object('order_number', order_number, 'pos_session_id', pos_session_id,
    'warehouse_id', warehouse_id, 'reason', reason, 'database_user', CURRENT_USER)
FROM updated;

COMMIT;
