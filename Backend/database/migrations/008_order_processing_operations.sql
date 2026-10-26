CREATE TABLE IF NOT EXISTS order_processing_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'assigned',
  note VARCHAR(255),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT order_processing_tasks_status_check CHECK (status IN ('assigned', 'picking', 'ready_to_pack', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_order_processing_tasks_assigned ON order_processing_tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_order_processing_tasks_status ON order_processing_tasks(status);

INSERT INTO permissions (code, name, module, action, description)
VALUES
  ('order_processing.orders.read', 'Xem don can xu ly', 'order_processing', 'orders.read', 'Xem don online can xu ly'),
  ('order_processing.orders.confirm', 'Xac nhan don', 'order_processing', 'orders.confirm', 'Xac nhan tiep nhan don hang'),
  ('order_processing.orders.assign', 'Phan cong xu ly don', 'order_processing', 'orders.assign', 'Phan cong nhan vien xu ly don'),
  ('order_processing.tasks.update', 'Cap nhat tac vu xu ly', 'order_processing', 'tasks.update', 'Cap nhat picking va san sang dong goi')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'order_processing.orders.read', 'order_processing.orders.confirm',
  'order_processing.orders.assign', 'order_processing.tasks.update'
)
WHERE r.code IN ('admin', 'manager')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('order_processing.orders.read', 'order_processing.tasks.update')
WHERE r.code = 'order_processor'
ON CONFLICT DO NOTHING;

INSERT INTO users (email, password_hash, full_name, status, role_id)
SELECT
  'processor@example.com',
  '$2a$12$PLzUY/HIDQYYAx29AN7kme8QEO21t.twzkBYCrLenjdL3VxhW6BdO',
  'System Order Processor',
  'active',
  r.id
FROM roles r
WHERE r.code = 'order_processor'
ON CONFLICT (email) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  status = 'active',
  updated_at = NOW();
