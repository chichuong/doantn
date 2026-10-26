BEGIN;
ALTER TABLE orders ADD COLUMN reservation_expires_at TIMESTAMPTZ;
CREATE INDEX idx_orders_reservation_expiry ON orders(reservation_expires_at)
  WHERE status = 'pending' AND payment_status = 'unpaid';
-- Existing drafts remain completable; every new document requires scan verification by default.
ALTER TABLE warehouse_documents ADD COLUMN require_scan BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE warehouse_documents ALTER COLUMN require_scan SET DEFAULT TRUE;
CREATE TABLE warehouse_document_scan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_item_id UUID NOT NULL REFERENCES warehouse_document_items(id),
  request_id UUID NOT NULL UNIQUE,
  identifier VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  scanned_by UUID NOT NULL REFERENCES users(id),
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_document_scans_item ON warehouse_document_scan_events(document_item_id);
INSERT INTO permissions (code, name, module, action, description) VALUES
  ('manager.orders.cancel', 'Huy don online', 'manager', 'orders.cancel', 'Huy don truoc xuat kho, giai phong giu hang')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.code IN ('admin','manager') AND p.code = 'manager.orders.cancel' ON CONFLICT DO NOTHING;
COMMIT;
