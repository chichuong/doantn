CREATE TABLE IF NOT EXISTS customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_name VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  address_line VARCHAR(255) NOT NULL,
  ward VARCHAR(100),
  district VARCHAR(100),
  province VARCHAR(100) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address_id UUID REFERENCES customer_addresses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_warehouse ON orders(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_orders_shipping_address ON orders(shipping_address_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_default_address
  ON customer_addresses(user_id) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_customer_addresses_user ON customer_addresses(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cart_items_quantity_check CHECK (quantity > 0),
  UNIQUE (cart_id, product_id)
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL,
  note VARCHAR(255),
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id, created_at ASC);

INSERT INTO permissions (code, name, module, action, description)
VALUES
  ('customer.catalog.read', 'Xem san pham online', 'customer', 'catalog.read', 'Xem va tim kiem san pham'),
  ('customer.addresses.manage', 'Quan ly dia chi', 'customer', 'addresses.manage', 'Them, xem va chinh sua dia chi giao hang'),
  ('customer.cart.manage', 'Quan ly gio hang', 'customer', 'cart.manage', 'Them, sua, xoa san pham trong gio hang'),
  ('customer.orders.create', 'Dat hang online', 'customer', 'orders.create', 'Checkout va tao don hang online'),
  ('customer.orders.read', 'Xem don hang ca nhan', 'customer', 'orders.read', 'Xem lich su va trang thai don hang'),
  ('customer.orders.cancel', 'Huy don hang', 'customer', 'orders.cancel', 'Huy don truoc khi xu ly')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'customer.catalog.read', 'customer.addresses.manage', 'customer.cart.manage',
  'customer.orders.create', 'customer.orders.read', 'customer.orders.cancel'
)
WHERE r.code IN ('customer', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO users (email, password_hash, full_name, status, role_id)
SELECT
  'customer@example.com',
  '$2a$12$o.mzjsV9QwzwYTA98tRtzOS.QJSHdHcktyZoL62FYm3ro9QsAax1m',
  'System Customer',
  'active',
  r.id
FROM roles r
WHERE r.code = 'customer'
ON CONFLICT (email) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  status = 'active',
  updated_at = NOW();
