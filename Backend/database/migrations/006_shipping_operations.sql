CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  tracking_number VARCHAR(60) NOT NULL UNIQUE,
  carrier VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'assigned',
  assigned_to UUID NOT NULL REFERENCES users(id),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  note VARCHAR(255),
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shipments_status_check CHECK (status IN ('assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'returned'))
);

CREATE TABLE IF NOT EXISTS shipment_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL,
  note VARCHAR(255),
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shipment_history_status_check CHECK (status IN ('assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'returned'))
);

CREATE INDEX IF NOT EXISTS idx_shipments_assigned_status ON shipments(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipment_history_shipment ON shipment_status_history(shipment_id, created_at ASC);

INSERT INTO permissions (code, name, module, action, description)
VALUES
  ('shipping.shipments.read', 'Xem van don', 'shipping', 'shipments.read', 'Xem van don duoc phan cong'),
  ('shipping.shipments.create', 'Tao van don', 'shipping', 'shipments.create', 'Tao va phan cong van don'),
  ('shipping.shipments.assign', 'Phan cong van don', 'shipping', 'shipments.assign', 'Gan van don cho shipper'),
  ('shipping.shipments.update', 'Cap nhat giao nhan', 'shipping', 'shipments.update', 'Cap nhat trang thai giao nhan')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('shipping.shipments.read', 'shipping.shipments.update')
WHERE r.code = 'shipper'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('shipping.shipments.read', 'shipping.shipments.create', 'shipping.shipments.assign', 'shipping.shipments.update')
WHERE r.code IN ('admin', 'manager')
ON CONFLICT DO NOTHING;

INSERT INTO users (email, password_hash, full_name, status, role_id)
SELECT
  'shipper@example.com',
  '$2a$12$PIS4rMl9hdrKz/7TIB0XfeIPdMhHVa8MtQEnA2UgyndGfYG89.5/2',
  'System Shipper',
  'active',
  r.id
FROM roles r
WHERE r.code = 'shipper'
ON CONFLICT (email) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  status = 'active',
  updated_at = NOW();
