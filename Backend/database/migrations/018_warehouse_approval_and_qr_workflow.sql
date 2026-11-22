BEGIN;

-- 1. Extend warehouse document status check
ALTER TABLE warehouse_documents DROP CONSTRAINT IF EXISTS warehouse_documents_status_check;
ALTER TABLE warehouse_documents ADD CONSTRAINT warehouse_documents_status_check
  CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'completed', 'cancelled'));
ALTER TABLE warehouse_documents ALTER COLUMN status SET DEFAULT 'pending';

-- 2. Add approval, rejection and QR tracking columns
ALTER TABLE warehouse_documents ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE warehouse_documents ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE warehouse_documents ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE warehouse_documents ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;
ALTER TABLE warehouse_documents ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(255);
ALTER TABLE warehouse_documents ADD COLUMN IF NOT EXISTS qr_code VARCHAR(120);

CREATE UNIQUE INDEX IF NOT EXISTS uq_warehouse_documents_qr ON warehouse_documents(qr_code) WHERE qr_code IS NOT NULL;

-- 3. Add actual_quantity column on items for verified count
ALTER TABLE warehouse_document_items ADD COLUMN IF NOT EXISTS actual_quantity INTEGER
  CHECK (actual_quantity IS NULL OR actual_quantity >= 0);

-- 4. Permissions for document approval and review
INSERT INTO permissions (code, name, module, action, description)
VALUES
  ('manager.documents.read', 'Xem chung tu can duyet', 'manager', 'documents.read', 'Xem danh sach yeu cau nhap xuat kho can duyet'),
  ('warehouse.documents.approve', 'Phe duyet chung tu kho', 'warehouse', 'documents.approve', 'Phe duyet hoac tu choi yeu cau nhap xuat kho')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  description = EXCLUDED.description;

-- 5. Grant approval permissions to admin and manager only
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code IN ('admin', 'manager')
  AND p.code IN ('manager.documents.read', 'warehouse.documents.approve')
ON CONFLICT DO NOTHING;

-- 6. Ensure default warehouse staff has access to WH-HCM-01
INSERT INTO user_warehouses (user_id, warehouse_id)
SELECT u.id, w.id
FROM users u, warehouses w
WHERE u.email = 'warehouse@example.com' AND w.code = 'WH-HCM-01'
ON CONFLICT DO NOTHING;

COMMIT;
