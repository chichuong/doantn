CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255),
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT roles_code_format CHECK (code ~ '^[a-z][a-z0-9_]*$')
);

CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  module VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT permissions_code_format CHECK (code ~ '^[a-z][a-z0-9_.]*$')
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(30),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  role_id UUID NOT NULL REFERENCES roles(id),
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_status_check CHECK (status IN ('active', 'inactive', 'locked'))
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_created ON audit_logs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

INSERT INTO roles (code, name, description, is_system)
VALUES
  ('admin', 'Quan tri vien', 'Quan ly tai khoan, vai tro va quyen han', TRUE),
  ('manager', 'Quan ly', 'Quan ly van hanh, kho va bao cao', TRUE),
  ('sales', 'Nhan vien ban hang', 'Ban hang tai quay POS', TRUE),
  ('warehouse', 'Nhan vien kho', 'Nhap xuat ton va xu ly hang hoa', TRUE),
  ('order_processor', 'Nhan vien xu ly don', 'Xu ly, lay hang va dong goi don', TRUE),
  ('shipper', 'Nhan vien giao hang', 'Giao nhan va cap nhat van don', TRUE),
  ('customer', 'Khach hang', 'Mua hang va theo doi don hang', TRUE)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO permissions (code, name, module, action, description)
VALUES
  ('auth.users.read', 'Xem tai khoan', 'auth', 'users.read', 'Xem danh sach va thong tin tai khoan'),
  ('auth.users.create', 'Tao tai khoan', 'auth', 'users.create', 'Tao tai khoan nguoi dung'),
  ('auth.users.update', 'Cap nhat tai khoan', 'auth', 'users.update', 'Cap nhat thong tin, vai tro va trang thai'),
  ('auth.roles.read', 'Xem vai tro', 'auth', 'roles.read', 'Xem vai tro va quyen han'),
  ('auth.roles.create', 'Tao vai tro', 'auth', 'roles.create', 'Tao vai tro moi'),
  ('auth.roles.update', 'Cap nhat vai tro', 'auth', 'roles.update', 'Cap nhat vai tro va danh sach quyen'),
  ('auth.permissions.read', 'Xem quyen', 'auth', 'permissions.read', 'Xem danh sach quyen he thong')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.code = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO users (email, password_hash, full_name, status, role_id)
SELECT
  'admin@example.com',
  '$2a$12$ZKdvbId.zCoSPx9ObqG9reWda0sGgtouKYww1pNw.nnuDJzIUCsbG',
  'System Administrator',
  'active',
  r.id
FROM roles r
WHERE r.code = 'admin'
ON CONFLICT (email) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  status = 'active',
  updated_at = NOW();

INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
SELECT u.id, 'seed', 'user', u.id, '{"source":"001_admin_auth.sql"}'::JSONB
FROM users u
WHERE u.email = 'admin@example.com'
  AND NOT EXISTS (
    SELECT 1 FROM audit_logs a
    WHERE a.action = 'seed' AND a.entity_type = 'user' AND a.entity_id = u.id
  );
