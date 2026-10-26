-- Run 010_inventory_preflight.sql first. Stop API writers while applying this migration.
-- Existing reservations are adopted only when their totals match the old counters exactly.
BEGIN;

LOCK TABLE orders, order_items, inventory, inventory_transactions, pos_sessions IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM orders WHERE channel IN ('web', 'mobile')
      AND status IN ('pending', 'confirmed', 'processing') AND warehouse_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Open online orders without warehouse_id. Resolve preflight report before migration 010.';
  END IF;
  IF EXISTS (
    WITH expected AS (
      SELECT o.warehouse_id, oi.product_id, SUM(oi.quantity) AS reserved
      FROM orders o JOIN order_items oi ON oi.order_id = o.id
      WHERE o.channel IN ('web', 'mobile') AND o.status IN ('pending', 'confirmed', 'processing')
      GROUP BY o.warehouse_id, oi.product_id
    )
    SELECT 1 FROM inventory i FULL JOIN expected e
      ON e.warehouse_id = i.warehouse_id AND e.product_id = i.product_id
    WHERE COALESCE(i.reserved_quantity, 0) <> COALESCE(e.reserved, 0)
      OR (e.reserved IS NOT NULL AND i.product_id IS NULL)
  ) THEN
    RAISE EXCEPTION 'Reservation counters differ from open online orders. Resolve preflight report; no automatic stock reset is performed.';
  END IF;
END $$;

ALTER TABLE orders ADD COLUMN pos_session_id UUID REFERENCES pos_sessions(id);
ALTER TABLE orders ADD COLUMN shipping_address_snapshot JSONB;
CREATE INDEX idx_orders_pos_session ON orders(pos_session_id);
ALTER TABLE pos_sessions ADD CONSTRAINT pos_sessions_id_warehouse_unique UNIQUE (id, warehouse_id);
ALTER TABLE orders ADD CONSTRAINT orders_pos_session_warehouse_fk
  FOREIGN KEY (pos_session_id, warehouse_id) REFERENCES pos_sessions(id, warehouse_id);

UPDATE orders o SET shipping_address_snapshot = jsonb_build_object(
  'recipient_name', a.recipient_name, 'phone', a.phone, 'address_line', a.address_line,
  'ward', a.ward, 'district', a.district, 'province', a.province)
FROM customer_addresses a WHERE o.shipping_address_id = a.id;

-- Only adopt a POS session when exactly one session and one issue warehouse agree.
WITH issue_warehouses AS (
  SELECT o.id, MIN(t.warehouse_id::text)::uuid AS warehouse_id
  FROM orders o JOIN inventory_transactions t ON t.reference_code = o.order_number AND t.type = 'issue'
  WHERE o.channel = 'pos'
    AND NOT EXISTS (
      SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.quantity <> (
        SELECT COALESCE(SUM(it.quantity), 0) FROM inventory_transactions it
        WHERE it.reference_code = o.order_number AND it.type = 'issue' AND it.product_id = oi.product_id
      )
    )
    AND EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)
    AND NOT EXISTS (
      SELECT 1 FROM inventory_transactions it WHERE it.reference_code = o.order_number AND it.type = 'issue'
        AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.product_id = it.product_id)
    )
  GROUP BY o.id HAVING COUNT(DISTINCT t.warehouse_id) = 1
), candidates AS (
  SELECT o.id, MIN(s.id::text)::uuid AS session_id, MIN(w.warehouse_id::text)::uuid AS warehouse_id
  FROM orders o JOIN issue_warehouses w ON w.id = o.id
  JOIN pos_sessions s ON s.opened_by = o.created_by AND s.warehouse_id = w.warehouse_id
    AND o.created_at >= s.opened_at AND (s.closed_at IS NULL OR o.created_at <= s.closed_at)
  WHERE o.channel = 'pos' AND (o.warehouse_id IS NULL OR o.warehouse_id = w.warehouse_id)
  GROUP BY o.id HAVING COUNT(*) = 1
)
UPDATE orders o SET warehouse_id = c.warehouse_id, pos_session_id = c.session_id
FROM candidates c WHERE c.id = o.id;

-- Apply after backfill: NOT VALID preserves unresolved history but checks future writes.
ALTER TABLE orders ADD CONSTRAINT orders_warehouse_required CHECK (warehouse_id IS NOT NULL) NOT VALID;
ALTER TABLE orders ADD CONSTRAINT orders_pos_session_required
  CHECK ((channel = 'pos' AND pos_session_id IS NOT NULL) OR (channel <> 'pos' AND pos_session_id IS NULL)) NOT VALID;

CREATE TABLE inventory_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL UNIQUE REFERENCES order_items(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'released')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  CHECK ((status = 'active' AND closed_at IS NULL) OR (status <> 'active' AND closed_at IS NOT NULL)),
  FOREIGN KEY (warehouse_id, product_id) REFERENCES inventory(warehouse_id, product_id)
);
CREATE INDEX idx_reservations_active_stock ON inventory_reservations(warehouse_id, product_id) WHERE status = 'active';

INSERT INTO inventory_reservations (order_item_id, warehouse_id, product_id, quantity, created_at)
SELECT oi.id, o.warehouse_id, oi.product_id, oi.quantity, o.created_at
FROM orders o JOIN order_items oi ON oi.order_id = o.id
WHERE o.channel IN ('web', 'mobile') AND o.status IN ('pending', 'confirmed', 'processing');

ALTER TABLE inventory_transactions ADD COLUMN quantity_delta INTEGER;
ALTER TABLE inventory_transactions ADD COLUMN quantity_before INTEGER;
ALTER TABLE inventory_transactions ADD COLUMN quantity_after INTEGER;
ALTER TABLE inventory_transactions ADD COLUMN order_id UUID REFERENCES orders(id);
ALTER TABLE inventory_transactions ADD COLUMN order_item_id UUID REFERENCES order_items(id);
ALTER TABLE inventory_transactions ADD COLUMN document_id UUID REFERENCES warehouse_documents(id);
ALTER TABLE inventory_transactions ADD COLUMN operation_key VARCHAR(160);
CREATE UNIQUE INDEX uq_inventory_transaction_operation ON inventory_transactions(operation_key) WHERE operation_key IS NOT NULL;
ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transaction_delta_check
  CHECK (quantity_delta IS NULL OR (quantity_delta <> 0 AND ABS(quantity_delta::bigint) = quantity
    AND (type <> 'receipt' OR quantity_delta > 0) AND (type <> 'issue' OR quantity_delta < 0)));
ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transaction_balance_check
  CHECK (quantity_before IS NULL OR (quantity_before >= 0 AND quantity_after >= 0
    AND quantity_after::bigint - quantity_before = quantity_delta));

CREATE TABLE api_idempotency_keys (
  user_id UUID NOT NULL REFERENCES users(id),
  operation VARCHAR(30) NOT NULL CHECK (operation IN ('customer.checkout', 'pos.sale')),
  key VARCHAR(120) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  order_id UUID REFERENCES orders(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, operation, key)
);

CREATE VIEW inventory_reservation_discrepancies AS
SELECT i.warehouse_id, i.product_id, i.quantity, i.reserved_quantity,
  COALESCE(SUM(r.quantity) FILTER (WHERE r.status = 'active'), 0)::bigint AS expected_reserved_quantity
FROM inventory i LEFT JOIN inventory_reservations r
  ON r.warehouse_id = i.warehouse_id AND r.product_id = i.product_id
GROUP BY i.warehouse_id, i.product_id
HAVING i.reserved_quantity <> COALESCE(SUM(r.quantity) FILTER (WHERE r.status = 'active'), 0);

COMMIT;
