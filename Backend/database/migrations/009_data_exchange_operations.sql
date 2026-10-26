CREATE TABLE IF NOT EXISTS data_exchange_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation VARCHAR(20) NOT NULL,
  data_type VARCHAR(30) NOT NULL,
  file_name VARCHAR(255),
  file_format VARCHAR(10),
  status VARCHAR(20) NOT NULL DEFAULT 'processing',
  total_rows INTEGER NOT NULL DEFAULT 0,
  success_rows INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT data_exchange_operation_check CHECK (operation IN ('import', 'export')),
  CONSTRAINT data_exchange_type_check CHECK (data_type IN ('products', 'inventory', 'orders')),
  CONSTRAINT data_exchange_status_check CHECK (status IN ('processing', 'completed', 'failed')),
  CONSTRAINT data_exchange_rows_check CHECK (total_rows >= 0 AND success_rows >= 0 AND error_rows >= 0)
);

CREATE INDEX IF NOT EXISTS idx_data_exchange_jobs_user_created ON data_exchange_jobs(created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_exchange_jobs_status ON data_exchange_jobs(status);

INSERT INTO permissions (code, name, module, action, description)
VALUES
  ('data_exchange.import', 'Nhap du lieu', 'data_exchange', 'import', 'Nhap san pham va ton kho tu Excel/CSV'),
  ('data_exchange.export', 'Xuat du lieu', 'data_exchange', 'export', 'Xuat san pham, ton kho va don hang ra Excel/CSV'),
  ('data_exchange.jobs.read', 'Xem lich su import export', 'data_exchange', 'jobs.read', 'Xem ket qua cac job import/export')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('data_exchange.import', 'data_exchange.export', 'data_exchange.jobs.read')
WHERE r.code IN ('admin', 'manager')
ON CONFLICT DO NOTHING;
