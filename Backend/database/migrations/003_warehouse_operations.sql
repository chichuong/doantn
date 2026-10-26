CREATE TABLE IF NOT EXISTS warehouse_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_number VARCHAR(50) NOT NULL UNIQUE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id),
  type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  supplier_name VARCHAR(150),
  reference_code VARCHAR(80),
  note VARCHAR(255),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT warehouse_documents_type_check CHECK (type IN ('receipt', 'issue')),
  CONSTRAINT warehouse_documents_status_check CHECK (status IN ('draft', 'completed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS warehouse_document_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES warehouse_documents(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT warehouse_document_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT warehouse_document_items_unit_cost_check CHECK (unit_cost >= 0),
  UNIQUE (document_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_warehouse_documents_warehouse ON warehouse_documents(warehouse_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_warehouse_documents_status ON warehouse_documents(status);
CREATE INDEX IF NOT EXISTS idx_warehouse_document_items_product ON warehouse_document_items(product_id);

INSERT INTO permissions (code, name, module, action, description)
VALUES
  ('warehouse.documents.read', 'Xem chung tu kho', 'warehouse', 'documents.read', 'Xem chung tu nhap xuat kho'),
  ('warehouse.documents.create', 'Tao chung tu kho', 'warehouse', 'documents.create', 'Tao phieu nhap va phieu xuat kho'),
  ('warehouse.documents.complete', 'Hoan tat chung tu kho', 'warehouse', 'documents.complete', 'Hoan tat phieu va cap nhat ton kho'),
  ('warehouse.inventory.read', 'Tra cuu ton kho', 'warehouse', 'inventory.read', 'Tra cuu ton kho va quet ma'),
  ('warehouse.orders.read', 'Xem don can xu ly', 'warehouse', 'orders.read', 'Xem don hang cho lay hang'),
  ('warehouse.orders.pack', 'Dong goi don hang', 'warehouse', 'orders.pack', 'Lay hang, dong goi va tru ton')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'warehouse.documents.read', 'warehouse.documents.create', 'warehouse.documents.complete',
  'warehouse.inventory.read', 'warehouse.orders.read', 'warehouse.orders.pack'
)
WHERE r.code = 'warehouse'
ON CONFLICT DO NOTHING;

INSERT INTO users (email, password_hash, full_name, status, role_id)
SELECT
  'warehouse@example.com',
  '$2a$12$FZxw2YiL8k47bnZdwptdA./rCWnU8MbGRooyBDFKXx08355SpXjuq',
  'System Warehouse Staff',
  'active',
  r.id
FROM roles r
WHERE r.code = 'warehouse'
ON CONFLICT (email) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  status = 'active',
  updated_at = NOW();
