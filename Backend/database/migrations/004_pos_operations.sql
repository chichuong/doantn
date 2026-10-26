CREATE TABLE IF NOT EXISTS pos_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  opened_by UUID NOT NULL REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  opening_cash NUMERIC(14, 2) NOT NULL DEFAULT 0,
  closing_cash NUMERIC(14, 2),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pos_sessions_status_check CHECK (status IN ('open', 'closed')),
  CONSTRAINT pos_sessions_opening_cash_check CHECK (opening_cash >= 0),
  CONSTRAINT pos_sessions_closing_cash_check CHECK (closing_cash IS NULL OR closing_cash >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_open_session_user
  ON pos_sessions(opened_by) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method VARCHAR(20) NOT NULL,
  amount NUMERIC(14, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'paid',
  transaction_reference VARCHAR(100),
  received_by UUID REFERENCES users(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  refunded_at TIMESTAMPTZ,
  CONSTRAINT payments_method_check CHECK (method IN ('cash', 'card', 'transfer')),
  CONSTRAINT payments_amount_check CHECK (amount > 0),
  CONSTRAINT payments_status_check CHECK (status IN ('paid', 'refunded'))
);

CREATE INDEX IF NOT EXISTS idx_pos_sessions_warehouse_status ON pos_sessions(warehouse_id, status);
CREATE INDEX IF NOT EXISTS idx_pos_sessions_opened_at ON pos_sessions(opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at DESC);

INSERT INTO permissions (code, name, module, action, description)
VALUES
  ('pos.sessions.manage', 'Quan ly ca POS', 'pos', 'sessions.manage', 'Mo va dong ca ban hang'),
  ('pos.products.read', 'Tra cuu san pham POS', 'pos', 'products.read', 'Tra cuu san pham de ban hang'),
  ('pos.sales.create', 'Tao giao dich POS', 'pos', 'sales.create', 'Lap don va thanh toan tai quay'),
  ('pos.sales.read', 'Xem giao dich POS', 'pos', 'sales.read', 'Xem lich su giao dich POS'),
  ('pos.sales.void', 'Huy giao dich POS', 'pos', 'sales.void', 'Huy giao dich va hoan ton kho')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'pos.sessions.manage', 'pos.products.read', 'pos.sales.create',
  'pos.sales.read', 'pos.sales.void'
)
WHERE r.code IN ('sales', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO users (email, password_hash, full_name, status, role_id)
SELECT
  'sales@example.com',
  '$2a$12$HrtWNT.1P3aEbk4LMlWfHu/xRO8qos0RR9NXYZ7d/CnavwLZh6zM2',
  'System Sales Staff',
  'active',
  r.id
FROM roles r
WHERE r.code = 'sales'
ON CONFLICT (email) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  status = 'active',
  updated_at = NOW();
