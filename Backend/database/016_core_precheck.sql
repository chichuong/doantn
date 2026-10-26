-- DRY-RUN FOR MIGRATION 016
-- Safe on schema 009 and on schemas 010-015. No persistent data is changed.
-- Temporary reporting tables require a read-write transaction on PostgreSQL;
-- every change is temporary and the script always ends with ROLLBACK.
-- Migration 016 itself requires every migration from 010 through 015.
BEGIN;

CREATE TEMP TABLE _m016_schema (
  prerequisite TEXT PRIMARY KEY,
  ready BOOLEAN NOT NULL,
  introduced_by TEXT NOT NULL,
  purpose TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _m016_schema VALUES
  ('orders.pos_session_id', EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'pos_session_id'
  ), '010', 'Bind a POS order to its selling session'),
  ('inventory_reservations', to_regclass('public.inventory_reservations') IS NOT NULL,
    '010', 'Check reservation ownership for every order item'),
  ('inventory_transactions.order_id', EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_transactions' AND column_name = 'order_id'
  ), '010', 'Use direct order-to-transaction evidence'),
  ('inventory_reservation_discrepancies',
    to_regclass('public.inventory_reservation_discrepancies') IS NOT NULL,
    '010', 'Reconcile inventory counters'),
  ('order_scan_events', to_regclass('public.order_scan_events') IS NOT NULL,
    '011', 'Prove whether processing can become ready_to_pack'),
  ('bank_transfer_requests', to_regclass('public.bank_transfer_requests') IS NOT NULL,
    '012', 'Confirm that the migration chain includes online transfer records'),
  ('forecast_runs.metadata', EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'forecast_runs' AND column_name = 'metadata'
  ), '013', 'Confirm that forecasting metadata schema is current'),
  ('user_warehouses', to_regclass('public.user_warehouses') IS NOT NULL,
    '014', 'Confirm that staff warehouse access schema is current'),
  ('orders.reservation_expires_at', EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'reservation_expires_at'
  ), '015', 'Backfill reservation expiry in migration 016');

-- Grid 1. Every ready value must be true before migration 016.
SELECT * FROM _m016_schema ORDER BY introduced_by, prerequisite;

CREATE TEMP TABLE _m016_counts (
  missing_warehouse INTEGER NOT NULL,
  missing_pos_session INTEGER NOT NULL,
  invalid_order_status INTEGER NOT NULL,
  pos_check_mode TEXT NOT NULL
) ON COMMIT DROP;

DO $block$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'pos_session_id') THEN
    EXECUTE $sql$
      INSERT INTO _m016_counts
      SELECT COUNT(*) FILTER (WHERE warehouse_id IS NULL)::int,
        COUNT(*) FILTER (WHERE channel = 'pos' AND pos_session_id IS NULL)::int,
        COUNT(*) FILTER (WHERE status NOT IN (
          'pending','confirmed','processing','packed','shipping','completed','cancelled','returned',
          'ready_to_pack','handover','delivered'))::int,
        'COLUMN_PRESENT'
      FROM orders
    $sql$;
  ELSE
    INSERT INTO _m016_counts
    SELECT COUNT(*) FILTER (WHERE warehouse_id IS NULL)::int,
      COUNT(*) FILTER (WHERE channel = 'pos')::int,
      COUNT(*) FILTER (WHERE status NOT IN (
        'pending','confirmed','processing','packed','shipping','completed','cancelled','returned',
        'ready_to_pack','handover','delivered'))::int,
      'COLUMN_ABSENT_ALL_POS_ORDERS_NEED_MIGRATION_010'
    FROM orders;
  END IF;
END
$block$;

-- Grid 2. On schema 009, missing_pos_session equals all historical POS orders.
SELECT * FROM _m016_counts;

-- Collect warehouse evidence that exists in the current schema.
CREATE TEMP TABLE _m016_warehouse_evidence (
  order_id UUID NOT NULL,
  warehouse_id UUID NOT NULL,
  source TEXT NOT NULL
) ON COMMIT DROP;

INSERT INTO _m016_warehouse_evidence
SELECT o.id, t.warehouse_id, 'inventory_transaction_reference'
FROM orders o
JOIN inventory_transactions t
  ON t.reference_code = o.order_number AND t.type IN ('issue','receipt')
WHERE o.warehouse_id IS NULL;

DO $block$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'pos_session_id') THEN
    EXECUTE $sql$
      INSERT INTO _m016_warehouse_evidence
      SELECT o.id, s.warehouse_id, 'stored_pos_session'
      FROM orders o JOIN pos_sessions s ON s.id = o.pos_session_id
      WHERE o.warehouse_id IS NULL
    $sql$;
  END IF;

  IF to_regclass('public.inventory_reservations') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO _m016_warehouse_evidence
      SELECT o.id, r.warehouse_id, 'active_reservation'
      FROM orders o JOIN order_items oi ON oi.order_id = o.id
      JOIN inventory_reservations r ON r.order_item_id = oi.id AND r.status = 'active'
      WHERE o.warehouse_id IS NULL
    $sql$;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'inventory_transactions' AND column_name = 'order_id') THEN
    EXECUTE $sql$
      INSERT INTO _m016_warehouse_evidence
      SELECT o.id, t.warehouse_id, 'inventory_transaction_order'
      FROM orders o JOIN inventory_transactions t ON t.order_id = o.id
      WHERE o.warehouse_id IS NULL
    $sql$;
  END IF;
END
$block$;

-- Grid 3. Orders without warehouse and evidence-backed candidates.
WITH evidence AS (
  SELECT order_id, COUNT(DISTINCT warehouse_id)::int AS candidate_count,
    ARRAY_AGG(DISTINCT warehouse_id ORDER BY warehouse_id) AS candidate_warehouses,
    ARRAY_AGG(DISTINCT source ORDER BY source) AS evidence_sources
  FROM _m016_warehouse_evidence GROUP BY order_id
)
SELECT o.id, o.order_number, o.channel, o.status, o.created_by, o.created_at,
  COALESCE(e.candidate_count, 0) AS candidate_count,
  e.candidate_warehouses, e.evidence_sources,
  CASE WHEN e.candidate_count = 1 THEN 'AUTO_BACKFILL_SAFE'
       WHEN e.candidate_count > 1 THEN 'CONFLICT_REQUIRES_REVIEW'
       ELSE 'NO_EVIDENCE_REQUIRES_MANUAL_DECISION' END AS decision
FROM orders o LEFT JOIN evidence e ON e.order_id = o.id
WHERE o.warehouse_id IS NULL
ORDER BY o.created_at, o.id;

-- Build a POS report dynamically so PostgreSQL never parses a missing column.
CREATE TEMP TABLE _m016_pos_issues (
  order_id UUID, order_number TEXT, warehouse_id UUID, created_by UUID,
  created_at TIMESTAMPTZ, candidate_count INTEGER,
  candidate_sessions UUID[], candidate_warehouses UUID[], decision TEXT
) ON COMMIT DROP;

DO $block$
DECLARE
  predicate TEXT;
BEGIN
  predicate := CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'pos_session_id'
  ) THEN 'o.pos_session_id IS NULL' ELSE 'TRUE' END;

  EXECUTE format($sql$
    INSERT INTO _m016_pos_issues
    WITH candidates AS (
      SELECT o.id AS order_id, s.id AS session_id, s.warehouse_id, s.opened_at
      FROM orders o JOIN pos_sessions s
        ON s.opened_by = o.created_by
       AND o.created_at >= s.opened_at
       AND o.created_at <= COALESCE(s.closed_at, NOW())
       AND (o.warehouse_id IS NULL OR o.warehouse_id = s.warehouse_id)
      WHERE o.channel = 'pos' AND %s
    ), summary AS (
      SELECT order_id, COUNT(*)::int AS candidate_count,
        ARRAY_AGG(session_id ORDER BY opened_at, session_id) AS candidate_sessions,
        ARRAY_AGG(DISTINCT warehouse_id ORDER BY warehouse_id) AS candidate_warehouses
      FROM candidates GROUP BY order_id
    )
    SELECT o.id, o.order_number, o.warehouse_id, o.created_by, o.created_at,
      COALESCE(s.candidate_count, 0), s.candidate_sessions, s.candidate_warehouses,
      CASE WHEN s.candidate_count = 1 THEN 'AUTO_BACKFILL_SAFE_AFTER_MIGRATION_010'
           WHEN s.candidate_count > 1 THEN 'AMBIGUOUS_SESSION_REQUIRES_REVIEW'
           ELSE 'NO_MATCHING_SESSION_REQUIRES_MANUAL_REVIEW' END
    FROM orders o LEFT JOIN summary s ON s.order_id = o.id
    WHERE o.channel = 'pos' AND %s
  $sql$, predicate, predicate);
END
$block$;

-- Grid 4. POS orders missing session, or every POS order when the column is absent.
SELECT * FROM _m016_pos_issues ORDER BY created_at, order_id;

-- Grid 5. Lifecycle problems checkable on schema 009.
WITH issues AS (
  SELECT id AS order_id, order_number, 'UNKNOWN_STATUS'::text AS issue_code,
    jsonb_build_object('status', status) AS details
  FROM orders WHERE status NOT IN (
    'pending','confirmed','processing','packed','shipping','completed','cancelled','returned',
    'ready_to_pack','handover','delivered')
  UNION ALL
  SELECT o.id, o.order_number, 'SHIPPING_ORDER_WITHOUT_SHIPMENT',
    jsonb_build_object('status', o.status)
  FROM orders o LEFT JOIN shipments s ON s.order_id = o.id
  WHERE o.status = 'shipping' AND s.id IS NULL
  UNION ALL
  SELECT h.order_id, o.order_number, 'UNKNOWN_HISTORY_STATUS',
    jsonb_build_object('history_id', h.id, 'status', h.status)
  FROM order_status_history h JOIN orders o ON o.id = h.order_id
  WHERE h.status NOT IN (
    'pending','confirmed','processing','packed','shipping','completed','cancelled','returned',
    'ready_to_pack','handover','delivered')
)
SELECT * FROM issues ORDER BY issue_code, order_id;

CREATE TEMP TABLE _m016_advanced_issues (
  issue_code TEXT, order_id UUID, order_number TEXT, details JSONB
) ON COMMIT DROP;

-- This base check is valid on every supported schema.
INSERT INTO _m016_advanced_issues
SELECT 'OPEN_ORDER_WITHOUT_ITEMS', o.id, o.order_number,
  jsonb_build_object('status', o.status)
FROM orders o
WHERE o.channel IN ('web','mobile') AND o.status IN ('pending','confirmed','processing')
  AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id);

DO $block$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'pos_session_id') THEN
    EXECUTE $sql$
      INSERT INTO _m016_advanced_issues
      SELECT 'NON_POS_HAS_POS_SESSION', o.id, o.order_number,
        jsonb_build_object('channel', o.channel, 'pos_session_id', o.pos_session_id)
      FROM orders o WHERE o.channel <> 'pos' AND o.pos_session_id IS NOT NULL
      UNION ALL
      SELECT 'POS_WAREHOUSE_SESSION_MISMATCH', o.id, o.order_number,
        jsonb_build_object('order_warehouse_id', o.warehouse_id,
          'session_warehouse_id', s.warehouse_id)
      FROM orders o JOIN pos_sessions s ON s.id = o.pos_session_id
      WHERE o.channel = 'pos' AND o.warehouse_id IS DISTINCT FROM s.warehouse_id
    $sql$;
  END IF;

  IF to_regclass('public.inventory_reservations') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO _m016_advanced_issues
      SELECT CASE WHEN r.id IS NULL THEN 'MISSING_RESERVATION'
                  WHEN r.status <> 'active' THEN 'RESERVATION_NOT_ACTIVE'
                  WHEN r.warehouse_id IS DISTINCT FROM o.warehouse_id THEN 'RESERVATION_WAREHOUSE_MISMATCH'
                  WHEN r.product_id IS DISTINCT FROM oi.product_id THEN 'RESERVATION_PRODUCT_MISMATCH'
                  ELSE 'RESERVATION_QUANTITY_MISMATCH' END,
        o.id, o.order_number,
        jsonb_build_object('order_item_id', oi.id, 'expected_product_id', oi.product_id,
          'expected_quantity', oi.quantity, 'expected_warehouse_id', o.warehouse_id,
          'reservation_id', r.id, 'reservation_status', r.status,
          'reservation_product_id', r.product_id, 'reservation_quantity', r.quantity,
          'reservation_warehouse_id', r.warehouse_id)
      FROM orders o JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN inventory_reservations r ON r.order_item_id = oi.id
      WHERE o.channel IN ('web','mobile') AND o.status IN ('pending','confirmed','processing')
        AND (r.id IS NULL OR r.status <> 'active'
          OR r.warehouse_id IS DISTINCT FROM o.warehouse_id
          OR r.product_id IS DISTINCT FROM oi.product_id
          OR r.quantity IS DISTINCT FROM oi.quantity)
      UNION ALL
      SELECT 'ACTIVE_RESERVATION_ON_CLOSED_ORDER', o.id, o.order_number,
        jsonb_build_object('order_status', o.status, 'reservation_id', r.id,
          'quantity', r.quantity, 'warehouse_id', r.warehouse_id, 'product_id', r.product_id)
      FROM inventory_reservations r JOIN order_items oi ON oi.id = r.order_item_id
      JOIN orders o ON o.id = oi.order_id
      WHERE r.status = 'active'
        AND NOT (o.channel IN ('web','mobile') AND o.status IN ('pending','confirmed','processing'))
    $sql$;
  END IF;

  IF to_regclass('public.order_scan_events') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO _m016_advanced_issues
      WITH scans AS (
        SELECT oi.order_id, COUNT(*)::int AS item_lines,
          BOOL_AND(oi.quantity = COALESCE(x.scanned_quantity, 0)) AS all_lines_scanned
        FROM order_items oi LEFT JOIN (
          SELECT order_item_id, SUM(quantity)::int AS scanned_quantity
          FROM order_scan_events GROUP BY order_item_id
        ) x ON x.order_item_id = oi.id GROUP BY oi.order_id
      )
      SELECT 'PROCESSING_STATUS_MAPPING_PREVIEW', o.id, o.order_number,
        jsonb_build_object('task_status', t.status, 'item_lines', COALESCE(s.item_lines, 0),
          'all_lines_scanned', COALESCE(s.all_lines_scanned, FALSE),
          'planned_status', CASE WHEN t.status = 'ready_to_pack'
            AND COALESCE(s.item_lines, 0) > 0 AND COALESCE(s.all_lines_scanned, FALSE)
            THEN 'ready_to_pack' ELSE 'confirmed' END)
      FROM orders o LEFT JOIN order_processing_tasks t ON t.order_id = o.id
      LEFT JOIN scans s ON s.order_id = o.id WHERE o.status = 'processing'
    $sql$;
  END IF;
END
$block$;

-- Grid 6. Reservation/session issues and processing mapping preview.
SELECT * FROM _m016_advanced_issues ORDER BY issue_code, order_id;

CREATE TEMP TABLE _m016_reconciliation (
  check_state TEXT, warehouse_id UUID, product_id UUID, quantity INTEGER,
  reserved_quantity INTEGER, expected_reserved_quantity BIGINT, difference BIGINT
) ON COMMIT DROP;

DO $block$
BEGIN
  IF to_regclass('public.inventory_reservation_discrepancies') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO _m016_reconciliation
      SELECT 'CHECKED', warehouse_id, product_id, quantity, reserved_quantity,
        expected_reserved_quantity, reserved_quantity::bigint - expected_reserved_quantity
      FROM inventory_reservation_discrepancies
    $sql$;
  ELSE
    INSERT INTO _m016_reconciliation (check_state)
    VALUES ('SKIPPED_REQUIRES_MIGRATION_010');
  END IF;
END
$block$;

-- Grid 7. A SKIPPED row is expected on schema 009; after 010, no row means balanced.
SELECT * FROM _m016_reconciliation
ORDER BY ABS(difference) DESC NULLS LAST, warehouse_id, product_id;

-- Final grid. Ready for 016 means schema_ready_for_016=true and every count=0.
-- NULL means the prerequisite is missing and the check was skipped.
SELECT
  NOT EXISTS (SELECT 1 FROM _m016_schema WHERE NOT ready) AS schema_ready_for_016,
  ARRAY(SELECT DISTINCT introduced_by FROM _m016_schema WHERE NOT ready ORDER BY introduced_by)
    AS missing_prerequisite_migrations,
  c.missing_warehouse,
  c.missing_pos_session,
  c.invalid_order_status,
  (SELECT COUNT(*) FROM order_status_history WHERE status NOT IN (
    'pending','confirmed','processing','packed','shipping','completed','cancelled','returned'))::int
    AS invalid_legacy_history_status,
  (SELECT COUNT(*) FROM _m016_advanced_issues WHERE issue_code = 'OPEN_ORDER_WITHOUT_ITEMS')::int
    AS open_orders_without_items,
  CASE WHEN to_regclass('public.inventory_reservations') IS NULL THEN NULL ELSE
    (SELECT COUNT(*) FROM _m016_advanced_issues WHERE issue_code LIKE 'RESERVATION_%'
      OR issue_code = 'MISSING_RESERVATION')::int END AS invalid_held_order_lines,
  CASE WHEN to_regclass('public.inventory_reservations') IS NULL THEN NULL ELSE
    (SELECT COUNT(*) FROM _m016_advanced_issues
      WHERE issue_code = 'ACTIVE_RESERVATION_ON_CLOSED_ORDER')::int END
    AS active_reservations_on_closed_orders,
  CASE WHEN to_regclass('public.inventory_reservation_discrepancies') IS NULL THEN NULL ELSE
    (SELECT COUNT(*) FROM _m016_reconciliation WHERE check_state = 'CHECKED')::int END
    AS reservation_counter_mismatch
FROM _m016_counts c;

ROLLBACK;
