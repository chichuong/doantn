BEGIN;

LOCK TABLE orders, order_status_history IN SHARE ROW EXCLUSIVE MODE;

CREATE TEMP TABLE _m017_history_repairs ON COMMIT DROP AS
SELECT o.id AS order_id, o.order_number, o.status AS current_status,
  latest.status AS previous_history_status
FROM orders o
LEFT JOIN LATERAL (
  SELECT h.status
  FROM order_status_history h
  WHERE h.order_id = o.id
  ORDER BY h.created_at DESC, h.id DESC
  LIMIT 1
) latest ON TRUE
WHERE latest.status IS DISTINCT FROM o.status;

INSERT INTO order_status_history (order_id, from_status, status, note, changed_by)
SELECT order_id, previous_history_status, current_status,
  'Migration 017 established order history baseline', NULL
FROM _m017_history_repairs;

INSERT INTO audit_logs (action, entity_type, entity_id, metadata)
SELECT 'migration_017_order_history_baseline', 'order', order_id,
  jsonb_build_object(
    'order_number', order_number,
    'previous_history_status', previous_history_status,
    'current_status', current_status,
    'database_user', CURRENT_USER
  )
FROM _m017_history_repairs;

DO $assertion$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM orders o
    LEFT JOIN LATERAL (
      SELECT h.status
      FROM order_status_history h
      WHERE h.order_id = o.id
      ORDER BY h.created_at DESC, h.id DESC
      LIMIT 1
    ) latest ON TRUE
    WHERE latest.status IS DISTINCT FROM o.status
  ) THEN
    RAISE EXCEPTION 'Order history integrity assertion failed';
  END IF;
END
$assertion$;

COMMIT;
