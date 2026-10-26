BEGIN;
CREATE TABLE user_warehouses (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, warehouse_id)
);
-- No blanket grant: admin must explicitly assign warehouses to sales/warehouse/order_processor users.
CREATE INDEX idx_user_warehouses_warehouse ON user_warehouses(warehouse_id);
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;
COMMIT;
