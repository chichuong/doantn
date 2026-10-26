CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL UNIQUE,
  description VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(60) NOT NULL UNIQUE,
  barcode VARCHAR(100) UNIQUE,
  name VARCHAR(180) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  cost_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
  sale_price NUMERIC(14, 2) NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT products_cost_price_check CHECK (cost_price >= 0),
  CONSTRAINT products_sale_price_check CHECK (sale_price >= 0),
  CONSTRAINT products_reorder_level_check CHECK (reorder_level >= 0)
);

CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  address VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory (
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (warehouse_id, product_id),
  CONSTRAINT inventory_quantity_check CHECK (quantity >= 0),
  CONSTRAINT inventory_reserved_check CHECK (reserved_quantity >= 0 AND reserved_quantity <= quantity)
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  product_id UUID NOT NULL REFERENCES products(id),
  type VARCHAR(20) NOT NULL,
  quantity INTEGER NOT NULL,
  reference_code VARCHAR(80),
  note VARCHAR(255),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_transaction_type_check CHECK (type IN ('receipt', 'issue', 'adjustment')),
  CONSTRAINT inventory_transaction_quantity_check CHECK (quantity > 0)
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(40) NOT NULL UNIQUE,
  channel VARCHAR(20) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  customer_name VARCHAR(150),
  customer_phone VARCHAR(30),
  total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT orders_channel_check CHECK (channel IN ('pos', 'web', 'mobile')),
  CONSTRAINT orders_status_check CHECK (status IN ('pending', 'confirmed', 'processing', 'packed', 'shipping', 'completed', 'cancelled', 'returned')),
  CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  CONSTRAINT orders_total_amount_check CHECK (total_amount >= 0)
);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(14, 2) NOT NULL,
  line_total NUMERIC(14, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  CONSTRAINT order_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT order_items_unit_price_check CHECK (unit_price >= 0),
  UNIQUE (order_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created ON inventory_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

INSERT INTO permissions (code, name, module, action, description)
VALUES
  ('manager.dashboard.read', 'Xem dashboard', 'manager', 'dashboard.read', 'Xem tong quan van hanh'),
  ('manager.products.read', 'Xem san pham', 'manager', 'products.read', 'Xem danh sach san pham'),
  ('manager.products.manage', 'Quan ly san pham', 'manager', 'products.manage', 'Tao va cap nhat san pham'),
  ('manager.warehouses.read', 'Xem kho hang', 'manager', 'warehouses.read', 'Xem danh sach kho'),
  ('manager.warehouses.manage', 'Quan ly kho hang', 'manager', 'warehouses.manage', 'Tao va cap nhat kho'),
  ('manager.inventory.read', 'Xem ton kho', 'manager', 'inventory.read', 'Xem ton kho va giao dich'),
  ('manager.inventory.adjust', 'Dieu chinh ton kho', 'manager', 'inventory.adjust', 'Dieu chinh ton kho co ghi nhat ky'),
  ('manager.orders.read', 'Xem don hang', 'manager', 'orders.read', 'Xem don hang va doanh thu'),
  ('manager.reports.read', 'Xem bao cao', 'manager', 'reports.read', 'Xem bao cao ban hang')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'manager.dashboard.read', 'manager.products.read', 'manager.products.manage',
  'manager.warehouses.read', 'manager.warehouses.manage', 'manager.inventory.read',
  'manager.inventory.adjust', 'manager.orders.read', 'manager.reports.read'
)
WHERE r.code = 'manager'
ON CONFLICT DO NOTHING;

INSERT INTO users (email, password_hash, full_name, status, role_id)
SELECT
  'manager@example.com',
  '$2a$12$AcBv5EJHDq1EEoVAADsDPOpfn3E4bwdVSWvh0yFL6vyx92TztvcxW',
  'System Manager',
  'active',
  r.id
FROM roles r
WHERE r.code = 'manager'
ON CONFLICT (email) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  status = 'active',
  updated_at = NOW();

INSERT INTO categories (name, description)
VALUES
  ('Do gia dung', 'San pham gia dung va tien ich'),
  ('Thuc pham dong goi', 'Thuc pham dong goi san'),
  ('Do uong', 'Nuoc uong va do uong dong chai')
ON CONFLICT (name) DO NOTHING;

INSERT INTO warehouses (code, name, address)
VALUES
  ('WH-HCM-01', 'Kho trung tam TP Ho Chi Minh', '236 Le Van Sy, TP Ho Chi Minh'),
  ('WH-HCM-02', 'Kho cua hang quan 3', 'Quan 3, TP Ho Chi Minh')
ON CONFLICT (code) DO NOTHING;

INSERT INTO products (sku, barcode, name, description, category_id, cost_price, sale_price, reorder_level)
SELECT v.sku, v.barcode, v.name, v.description, c.id, v.cost_price, v.sale_price, v.reorder_level
FROM (VALUES
  ('SP-001', '8930000000011', 'Binh nuoc inox 750ml', 'Binh nuoc ca nhan', 'Do gia dung', 90000::numeric, 149000::numeric, 10),
  ('SP-002', '8930000000028', 'Ca phe rang xay 500g', 'Ca phe dong goi', 'Thuc pham dong goi', 65000::numeric, 99000::numeric, 20),
  ('SP-003', '8930000000035', 'Nuoc suoi 500ml', 'Nuoc suoi dong chai', 'Do uong', 4000::numeric, 7000::numeric, 50)
) AS v(sku, barcode, name, description, category_name, cost_price, sale_price, reorder_level)
JOIN categories c ON c.name = v.category_name
ON CONFLICT (sku) DO NOTHING;

INSERT INTO inventory (warehouse_id, product_id, quantity, reserved_quantity)
SELECT w.id, p.id,
  CASE p.sku WHEN 'SP-001' THEN 35 WHEN 'SP-002' THEN 12 ELSE 80 END,
  0
FROM warehouses w CROSS JOIN products p
WHERE w.code = 'WH-HCM-01'
ON CONFLICT (warehouse_id, product_id) DO NOTHING;

INSERT INTO inventory (warehouse_id, product_id, quantity, reserved_quantity)
SELECT w.id, p.id,
  CASE p.sku WHEN 'SP-001' THEN 8 WHEN 'SP-002' THEN 25 ELSE 40 END,
  0
FROM warehouses w CROSS JOIN products p
WHERE w.code = 'WH-HCM-02'
ON CONFLICT (warehouse_id, product_id) DO NOTHING;

INSERT INTO inventory_transactions (warehouse_id, product_id, type, quantity, reference_code, note, created_by)
SELECT w.id, p.id, 'receipt', i.quantity, 'SEED-002', 'Ton kho mau ban dau', u.id
FROM inventory i
JOIN warehouses w ON w.id = i.warehouse_id
JOIN products p ON p.id = i.product_id
JOIN users u ON u.email = 'admin@example.com'
WHERE NOT EXISTS (
  SELECT 1 FROM inventory_transactions t WHERE t.reference_code = 'SEED-002'
);

INSERT INTO orders (order_number, channel, status, payment_status, customer_name, customer_phone, total_amount, created_by)
SELECT 'ORD-SEED-0001', 'web', 'completed', 'paid', 'Tran Thi B', '0901111222', 198000, u.id
FROM users u WHERE u.email = 'admin@example.com'
ON CONFLICT (order_number) DO NOTHING;

INSERT INTO order_items (order_id, product_id, quantity, unit_price)
SELECT o.id, p.id, 2, p.sale_price
FROM orders o JOIN products p ON p.sku = 'SP-002'
WHERE o.order_number = 'ORD-SEED-0001'
ON CONFLICT (order_id, product_id) DO NOTHING;
