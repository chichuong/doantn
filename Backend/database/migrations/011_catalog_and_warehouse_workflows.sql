BEGIN;

-- Do not silently merge categories that already differ only by case or surrounding spaces.
CREATE UNIQUE INDEX uq_categories_normalized_name ON categories(LOWER(BTRIM(name)));
ALTER TABLE data_exchange_jobs DROP CONSTRAINT data_exchange_type_check;
ALTER TABLE data_exchange_jobs ADD CONSTRAINT data_exchange_type_check
  CHECK (data_type IN ('categories', 'products', 'inventory', 'orders', 'sales'));
ALTER TABLE data_exchange_jobs ADD COLUMN error_details JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE order_scan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES order_items(id),
  request_id UUID NOT NULL UNIQUE,
  identifier VARCHAR(100) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  scanned_by UUID NOT NULL REFERENCES users(id),
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_order_scans_item ON order_scan_events(order_item_id);

CREATE TABLE order_return_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  received_by UUID NOT NULL REFERENCES users(id),
  note VARCHAR(255),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE order_return_receipt_items (
  receipt_id UUID NOT NULL REFERENCES order_return_receipts(id),
  order_item_id UUID NOT NULL REFERENCES order_items(id),
  received_quantity INTEGER NOT NULL CHECK (received_quantity > 0),
  restock_quantity INTEGER NOT NULL CHECK (restock_quantity >= 0 AND restock_quantity <= received_quantity),
  PRIMARY KEY (receipt_id, order_item_id)
);

INSERT INTO permissions (code, name, module, action, description) VALUES
  ('manager.categories.read', 'Xem danh muc', 'manager', 'categories.read', 'Xem danh muc san pham'),
  ('manager.categories.manage', 'Quan ly danh muc', 'manager', 'categories.manage', 'Tao, sua va ngung su dung danh muc'),
  ('warehouse.orders.scan', 'Kiem tra hang bang ma', 'warehouse', 'orders.scan', 'Quet va kiem tra so luong theo dong don'),
  ('warehouse.orders.returns', 'Nhan hang hoan', 'warehouse', 'orders.returns', 'Kiem tra va tiep nhan hang hoan ve kho')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE (r.code IN ('admin', 'manager') AND p.code IN ('manager.categories.read', 'manager.categories.manage'))
  OR (r.code IN ('admin', 'warehouse') AND p.code IN ('warehouse.orders.scan', 'warehouse.orders.returns'))
ON CONFLICT DO NOTHING;

COMMIT;
