BEGIN;

-- This project already used migration number 010. This additive migration upgrades
-- that schema without rewriting migration history.
LOCK TABLE orders, inventory, inventory_reservations, inventory_transactions IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM orders WHERE warehouse_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot enforce orders.warehouse_id NOT NULL: legacy orders still have no warehouse';
  END IF;
  IF EXISTS (SELECT 1 FROM orders WHERE channel = 'pos' AND pos_session_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot enforce POS session ownership: legacy POS orders still have no pos_session_id';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
    LEFT JOIN inventory_reservations r ON r.order_item_id = oi.id
    WHERE o.channel IN ('web', 'mobile')
      AND o.status IN ('pending', 'confirmed', 'processing')
      AND (r.id IS NULL OR r.status <> 'active' OR r.warehouse_id <> o.warehouse_id
        OR r.product_id <> oi.product_id OR r.quantity <> oi.quantity)
  ) THEN
    RAISE EXCEPTION 'Cannot migrate: open online orders have missing or mismatched active reservations';
  END IF;
  IF EXISTS (
    SELECT 1 FROM orders o
    WHERE o.channel IN ('web', 'mobile') AND o.status IN ('pending', 'confirmed', 'processing')
      AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)
  ) THEN
    RAISE EXCEPTION 'Cannot migrate: open online orders exist without order items';
  END IF;
  IF EXISTS (
    SELECT 1 FROM inventory_reservations r
    JOIN order_items oi ON oi.id = r.order_item_id
    JOIN orders o ON o.id = oi.order_id
    WHERE r.status = 'active'
      AND NOT (o.channel IN ('web', 'mobile')
        AND o.status IN ('pending', 'confirmed', 'processing'))
  ) THEN
    RAISE EXCEPTION 'Cannot migrate: active reservations are attached to orders that must not hold stock';
  END IF;
  IF EXISTS (
    SELECT 1 FROM inventory_reservation_discrepancies
  ) THEN
    RAISE EXCEPTION 'Cannot migrate: inventory.reserved_quantity differs from active reservations';
  END IF;
END $$;

ALTER TABLE orders ALTER COLUMN warehouse_id SET NOT NULL;
ALTER TABLE orders VALIDATE CONSTRAINT orders_warehouse_required;
ALTER TABLE orders VALIDATE CONSTRAINT orders_pos_session_required;
ALTER TABLE orders ADD COLUMN idempotency_key VARCHAR(120);
UPDATE orders o SET idempotency_key = k.key
FROM api_idempotency_keys k WHERE k.order_id = o.id AND o.idempotency_key IS NULL;
CREATE UNIQUE INDEX uq_orders_actor_idempotency
  ON orders(created_by, channel, idempotency_key) WHERE idempotency_key IS NOT NULL;

ALTER TABLE inventory_reservations ADD COLUMN expires_at TIMESTAMPTZ;
UPDATE inventory_reservations r SET expires_at = o.reservation_expires_at
FROM order_items oi JOIN orders o ON o.id = oi.order_id
WHERE oi.id = r.order_item_id AND r.status = 'active';
ALTER TABLE inventory_reservations DROP CONSTRAINT inventory_reservations_status_check;
ALTER TABLE inventory_reservations ADD CONSTRAINT inventory_reservations_status_check
  CHECK (status IN ('active', 'consumed', 'released', 'expired'));
CREATE INDEX idx_inventory_reservations_expiry
  ON inventory_reservations(expires_at, warehouse_id, product_id)
  WHERE status = 'active' AND expires_at IS NOT NULL;

ALTER TABLE inventory_transactions ADD COLUMN pos_order_id UUID REFERENCES orders(id);
UPDATE inventory_transactions t SET pos_order_id = t.order_id, order_id = NULL
FROM orders o WHERE o.id = t.order_id AND o.channel = 'pos';
ALTER TABLE inventory_transactions ADD COLUMN reference_id UUID
  GENERATED ALWAYS AS (COALESCE(order_id, pos_order_id, document_id)) STORED;
ALTER TABLE inventory_transactions ADD CONSTRAINT inventory_transaction_single_reference
  CHECK (num_nonnulls(order_id, pos_order_id, document_id) <= 1) NOT VALID;
ALTER TABLE inventory_transactions VALIDATE CONSTRAINT inventory_transaction_single_reference;
CREATE INDEX idx_inventory_transactions_stock_time
  ON inventory_transactions(warehouse_id, product_id, created_at DESC);
CREATE INDEX idx_inventory_transactions_reference ON inventory_transactions(reference_id);

ALTER TABLE order_status_history ADD COLUMN from_status VARCHAR(30);

-- Convert legacy lifecycle values to the canonical order state machine.
ALTER TABLE orders DROP CONSTRAINT orders_status_check;
WITH processing_plan AS (
  SELECT o.id,
    CASE WHEN t.status = 'ready_to_pack'
      AND EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)
      AND NOT EXISTS (
      SELECT 1 FROM order_items oi
      LEFT JOIN order_scan_events e ON e.order_item_id = oi.id
      WHERE oi.order_id = o.id
      GROUP BY oi.id HAVING oi.quantity <> COALESCE(SUM(e.quantity), 0)
    ) THEN 'ready_to_pack' ELSE 'confirmed' END AS new_status,
    t.status AS task_status
  FROM orders o LEFT JOIN order_processing_tasks t ON t.order_id = o.id
  WHERE o.status = 'processing'
), updated AS (
  UPDATE orders o SET status = p.new_status, updated_at = NOW()
  FROM processing_plan p WHERE o.id = p.id
  RETURNING o.id, p.new_status, p.task_status
), history_written AS (
  INSERT INTO order_status_history (order_id, from_status, status, note)
  SELECT id, NULL, new_status,
    CASE WHEN new_status = 'ready_to_pack'
      THEN 'Migration 016: processing -> ready_to_pack; task ready and scans exact'
      ELSE 'Migration 016: processing -> confirmed; insufficient ready evidence' END
  FROM updated RETURNING order_id
)
INSERT INTO audit_logs (action, entity_type, entity_id, metadata)
SELECT 'migration_016_status_backfill', 'order', id,
  jsonb_build_object('from', 'processing', 'to', new_status, 'task_status', task_status,
    'history_written', EXISTS (SELECT 1 FROM history_written h WHERE h.order_id = id),
    'reason', CASE WHEN new_status = 'ready_to_pack'
      THEN 'task ready_to_pack and every order line scanned exactly'
      ELSE 'insufficient ready-to-pack evidence; returned to confirmed' END)
FROM updated;

WITH shipping_plan AS (
  SELECT o.id, s.status AS shipment_status, CASE s.status
    WHEN 'assigned' THEN 'handover'
    WHEN 'picked_up' THEN 'shipping'
    WHEN 'in_transit' THEN 'shipping'
    WHEN 'failed' THEN 'shipping'
    WHEN 'delivered' THEN 'delivered'
    WHEN 'returned' THEN 'returned'
    ELSE 'shipping'
  END AS new_status
  FROM orders o JOIN shipments s ON s.order_id = o.id WHERE o.status = 'shipping'
), updated AS (
  UPDATE orders o SET status = p.new_status, updated_at = NOW()
  FROM shipping_plan p WHERE o.id = p.id
  RETURNING o.id, p.new_status, p.shipment_status
), history_written AS (
  INSERT INTO order_status_history (order_id, from_status, status, note)
  SELECT id, NULL, new_status, 'Migration 016: mapped legacy shipping state from shipment status'
  FROM updated RETURNING order_id
)
INSERT INTO audit_logs (action, entity_type, entity_id, metadata)
SELECT 'migration_016_status_backfill', 'order', id,
  jsonb_build_object('from', 'shipping', 'to', new_status, 'shipment_status', shipment_status,
    'history_written', EXISTS (SELECT 1 FROM history_written h WHERE h.order_id = id))
FROM updated;
WITH updated AS (
  UPDATE orders SET status = 'delivered', updated_at = NOW() WHERE status = 'completed'
  RETURNING id
), history_written AS (
  INSERT INTO order_status_history (order_id, from_status, status, note)
  SELECT id, NULL, 'delivered', 'Migration 016: completed -> delivered'
  FROM updated RETURNING order_id
)
INSERT INTO audit_logs (action, entity_type, entity_id, metadata)
SELECT 'migration_016_status_backfill', 'order', id,
  jsonb_build_object('from', 'completed', 'to', 'delivered',
    'reason', 'canonical terminal delivery state',
    'history_written', EXISTS (SELECT 1 FROM history_written h WHERE h.order_id = id))
FROM updated;

UPDATE order_status_history SET status = 'confirmed' WHERE status = 'processing';
UPDATE order_status_history SET status = 'delivered' WHERE status = 'completed';

ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (
  'pending', 'confirmed', 'ready_to_pack', 'packed', 'handover',
  'shipping', 'delivered', 'cancelled', 'returned'
));

ALTER TABLE order_status_history ADD CONSTRAINT order_status_history_status_check CHECK (
  status IN ('pending', 'confirmed', 'ready_to_pack', 'packed', 'handover',
    'shipping', 'delivered', 'cancelled', 'returned')
  AND (from_status IS NULL OR from_status IN ('pending', 'confirmed', 'ready_to_pack', 'packed',
    'handover', 'shipping', 'delivered', 'cancelled', 'returned'))
);

CREATE OR REPLACE FUNCTION enforce_order_state_transition() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  IF NOT (CASE OLD.status
    WHEN 'pending' THEN NEW.status IN ('confirmed', 'cancelled')
    WHEN 'confirmed' THEN NEW.status IN ('ready_to_pack', 'cancelled')
    WHEN 'ready_to_pack' THEN NEW.status IN ('packed', 'cancelled')
    WHEN 'packed' THEN NEW.status = 'handover'
    WHEN 'handover' THEN NEW.status IN ('shipping', 'returned')
    WHEN 'shipping' THEN NEW.status IN ('delivered', 'returned')
    WHEN 'delivered' THEN NEW.status = 'returned'
    ELSE FALSE
  END) THEN
    RAISE EXCEPTION 'Invalid order state transition: % -> %', OLD.status, NEW.status
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_orders_enforce_state_transition
BEFORE UPDATE OF status ON orders
FOR EACH ROW EXECUTE FUNCTION enforce_order_state_transition();

CREATE OR REPLACE VIEW inventory_reservation_reconciliation AS
SELECT i.warehouse_id, i.product_id, i.quantity, i.reserved_quantity,
  COALESCE(SUM(r.quantity) FILTER (WHERE r.status = 'active'), 0)::bigint AS active_reserved_quantity,
  i.reserved_quantity = COALESCE(SUM(r.quantity) FILTER (WHERE r.status = 'active'), 0) AS is_balanced
FROM inventory i
LEFT JOIN inventory_reservations r
  ON r.warehouse_id = i.warehouse_id AND r.product_id = i.product_id
GROUP BY i.warehouse_id, i.product_id;

-- Reconciliation query after migration:
-- SELECT * FROM inventory_reservation_reconciliation WHERE NOT is_balanced;

COMMIT;
