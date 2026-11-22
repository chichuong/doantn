-- =============================================================================
-- KARAT RETAIL - SQL SERVER (T-SQL) COMPLETE DATABASE SCHEMA
-- Migrated 1:1 from PostgreSQL (preserving all 35 tables, 2 views, columns, FKs, checks, and triggers)
-- =============================================================================

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

-- Drop views and tables in reverse dependency order if re-creating
IF OBJECT_ID('dbo.inventory_reservation_reconciliation', 'V') IS NOT NULL DROP VIEW dbo.inventory_reservation_reconciliation;
IF OBJECT_ID('dbo.inventory_reservation_discrepancies', 'V') IS NOT NULL DROP VIEW dbo.inventory_reservation_discrepancies;

IF OBJECT_ID('dbo.warehouse_document_scan_events', 'U') IS NOT NULL DROP TABLE dbo.warehouse_document_scan_events;
IF OBJECT_ID('dbo.warehouse_document_items', 'U') IS NOT NULL DROP TABLE dbo.warehouse_document_items;
IF OBJECT_ID('dbo.order_return_receipt_items', 'U') IS NOT NULL DROP TABLE dbo.order_return_receipt_items;
IF OBJECT_ID('dbo.order_return_receipts', 'U') IS NOT NULL DROP TABLE dbo.order_return_receipts;
IF OBJECT_ID('dbo.order_scan_events', 'U') IS NOT NULL DROP TABLE dbo.order_scan_events;
IF OBJECT_ID('dbo.order_processing_tasks', 'U') IS NOT NULL DROP TABLE dbo.order_processing_tasks;
IF OBJECT_ID('dbo.shipment_status_history', 'U') IS NOT NULL DROP TABLE dbo.shipment_status_history;
IF OBJECT_ID('dbo.shipments', 'U') IS NOT NULL DROP TABLE dbo.shipments;
IF OBJECT_ID('dbo.manual_refunds', 'U') IS NOT NULL DROP TABLE dbo.manual_refunds;
IF OBJECT_ID('dbo.payments', 'U') IS NOT NULL DROP TABLE dbo.payments;
IF OBJECT_ID('dbo.bank_transfer_requests', 'U') IS NOT NULL DROP TABLE dbo.bank_transfer_requests;
IF OBJECT_ID('dbo.order_status_history', 'U') IS NOT NULL DROP TABLE dbo.order_status_history;
IF OBJECT_ID('dbo.api_idempotency_keys', 'U') IS NOT NULL DROP TABLE dbo.api_idempotency_keys;
IF OBJECT_ID('dbo.inventory_transactions', 'U') IS NOT NULL DROP TABLE dbo.inventory_transactions;
IF OBJECT_ID('dbo.inventory_reservations', 'U') IS NOT NULL DROP TABLE dbo.inventory_reservations;
IF OBJECT_ID('dbo.order_items', 'U') IS NOT NULL DROP TABLE dbo.order_items;
IF OBJECT_ID('dbo.orders', 'U') IS NOT NULL DROP TABLE dbo.orders;
IF OBJECT_ID('dbo. warehouse_documents', 'U') IS NOT NULL DROP TABLE dbo.warehouse_documents;
IF OBJECT_ID('dbo.warehouse_documents', 'U') IS NOT NULL DROP TABLE dbo.warehouse_documents;
IF OBJECT_ID('dbo.pos_sessions', 'U') IS NOT NULL DROP TABLE dbo.pos_sessions;
IF OBJECT_ID('dbo.cart_items', 'U') IS NOT NULL DROP TABLE dbo.cart_items;
IF OBJECT_ID('dbo.carts', 'U') IS NOT NULL DROP TABLE dbo.carts;
IF OBJECT_ID('dbo.customer_addresses', 'U') IS NOT NULL DROP TABLE dbo.customer_addresses;
IF OBJECT_ID('dbo.forecast_values', 'U') IS NOT NULL DROP TABLE dbo.forecast_values;
IF OBJECT_ID('dbo.forecast_runs', 'U') IS NOT NULL DROP TABLE dbo.forecast_runs;
IF OBJECT_ID('dbo.data_exchange_jobs', 'U') IS NOT NULL DROP TABLE dbo.data_exchange_jobs;
IF OBJECT_ID('dbo.inventory', 'U') IS NOT NULL DROP TABLE dbo.inventory;
IF OBJECT_ID('dbo.products', 'U') IS NOT NULL DROP TABLE dbo.products;
IF OBJECT_ID('dbo.categories', 'U') IS NOT NULL DROP TABLE dbo.categories;
IF OBJECT_ID('dbo.user_warehouses', 'U') IS NOT NULL DROP TABLE dbo.user_warehouses;
IF OBJECT_ID('dbo.warehouses', 'U') IS NOT NULL DROP TABLE dbo.warehouses;
IF OBJECT_ID('dbo.audit_logs', 'U') IS NOT NULL DROP TABLE dbo.audit_logs;
IF OBJECT_ID('dbo.role_permissions', 'U') IS NOT NULL DROP TABLE dbo.role_permissions;
IF OBJECT_ID('dbo.users', 'U') IS NOT NULL DROP TABLE dbo.users;
IF OBJECT_ID('dbo.permissions', 'U') IS NOT NULL DROP TABLE dbo.permissions;
IF OBJECT_ID('dbo.roles', 'U') IS NOT NULL DROP TABLE dbo.roles;
GO

-- 1. roles
CREATE TABLE dbo.roles (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_roles PRIMARY KEY DEFAULT NEWID(),
  code VARCHAR(50) NOT NULL CONSTRAINT UQ_roles_code UNIQUE,
  name NVARCHAR(100) NOT NULL,
  description NVARCHAR(255) NULL,
  is_system BIT NOT NULL DEFAULT 0,
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT roles_code_format CHECK (code LIKE '[a-z]%' AND code NOT LIKE '%[^a-z0-9_]%')
);

-- 2. permissions
CREATE TABLE dbo.permissions (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_permissions PRIMARY KEY DEFAULT NEWID(),
  code VARCHAR(100) NOT NULL CONSTRAINT UQ_permissions_code UNIQUE,
  name NVARCHAR(150) NOT NULL,
  module VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description NVARCHAR(255) NULL,
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT permissions_code_format CHECK (code LIKE '[a-z]%' AND code NOT LIKE '%[^a-z0-9_.]%')
);

-- 3. users
CREATE TABLE dbo.users (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_users PRIMARY KEY DEFAULT NEWID(),
  email VARCHAR(255) NOT NULL CONSTRAINT UQ_users_email UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name NVARCHAR(150) NOT NULL,
  phone VARCHAR(30) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  role_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_users_role REFERENCES dbo.roles(id),
  last_login_at DATETIMEOFFSET NULL,
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT users_status_check CHECK (status IN ('active', 'inactive', 'locked'))
);
CREATE INDEX idx_users_role_id ON dbo.users(role_id);
CREATE INDEX idx_users_status ON dbo.users(status);

-- 4. role_permissions
CREATE TABLE dbo.role_permissions (
  role_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_role_permissions_role REFERENCES dbo.roles(id) ON DELETE CASCADE,
  permission_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_role_permissions_perm REFERENCES dbo.permissions(id) ON DELETE CASCADE,
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT PK_role_permissions PRIMARY KEY (role_id, permission_id)
);

-- 5. audit_logs
CREATE TABLE dbo.audit_logs (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_audit_logs PRIMARY KEY DEFAULT NEWID(),
  actor_user_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_audit_logs_actor REFERENCES dbo.users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UNIQUEIDENTIFIER NULL,
  metadata NVARCHAR(MAX) NOT NULL DEFAULT N'{}',
  ip_address VARCHAR(64) NULL,
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX idx_audit_logs_actor_created ON dbo.audit_logs(actor_user_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON dbo.audit_logs(entity_type, entity_id);

-- 6. categories
CREATE TABLE dbo.categories (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_categories PRIMARY KEY DEFAULT NEWID(),
  name NVARCHAR(120) NOT NULL CONSTRAINT UQ_categories_name UNIQUE,
  description NVARCHAR(255) NULL,
  is_active BIT NOT NULL DEFAULT 1,
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

-- 7. products
CREATE TABLE dbo.products (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_products PRIMARY KEY DEFAULT NEWID(),
  sku VARCHAR(60) NOT NULL CONSTRAINT UQ_products_sku UNIQUE,
  barcode VARCHAR(100) NULL,
  name NVARCHAR(180) NOT NULL,
  description NVARCHAR(MAX) NULL,
  category_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_products_category REFERENCES dbo.categories(id) ON DELETE SET NULL,
  cost_price DECIMAL(14, 2) NOT NULL DEFAULT 0,
  sale_price DECIMAL(14, 2) NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 0,
  is_active BIT NOT NULL DEFAULT 1,
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  image_url NVARCHAR(MAX) NULL,
  CONSTRAINT products_cost_price_check CHECK (cost_price >= 0),
  CONSTRAINT products_sale_price_check CHECK (sale_price >= 0),
  CONSTRAINT products_reorder_level_check CHECK (reorder_level >= 0)
);
CREATE UNIQUE INDEX uq_products_barcode ON dbo.products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_products_category ON dbo.products(category_id);
CREATE INDEX idx_products_active ON dbo.products(is_active);

-- 8. warehouses
CREATE TABLE dbo.warehouses (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_warehouses PRIMARY KEY DEFAULT NEWID(),
  code VARCHAR(30) NOT NULL CONSTRAINT UQ_warehouses_code UNIQUE,
  name NVARCHAR(120) NOT NULL,
  address NVARCHAR(255) NULL,
  is_active BIT NOT NULL DEFAULT 1,
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

-- 9. user_warehouses
CREATE TABLE dbo.user_warehouses (
  user_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_user_warehouses_user REFERENCES dbo.users(id) ON DELETE CASCADE,
  warehouse_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_user_warehouses_wh REFERENCES dbo.warehouses(id),
  assigned_by UNIQUEIDENTIFIER NULL CONSTRAINT FK_user_warehouses_assigner REFERENCES dbo.users(id),
  assigned_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT PK_user_warehouses PRIMARY KEY (user_id, warehouse_id)
);
CREATE INDEX idx_user_warehouses_warehouse ON dbo.user_warehouses(warehouse_id);

-- 10. inventory
CREATE TABLE dbo.inventory (
  warehouse_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_inventory_warehouse REFERENCES dbo.warehouses(id) ON DELETE CASCADE,
  product_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_inventory_product REFERENCES dbo.products(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 0,
  reserved_quantity INT NOT NULL DEFAULT 0,
  updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT PK_inventory PRIMARY KEY (warehouse_id, product_id),
  CONSTRAINT inventory_quantity_check CHECK (quantity >= 0),
  CONSTRAINT inventory_reserved_check CHECK (reserved_quantity >= 0 AND reserved_quantity <= quantity)
);
CREATE INDEX idx_inventory_product ON dbo.inventory(product_id);

-- 11. customer_addresses
CREATE TABLE dbo.customer_addresses (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_customer_addresses PRIMARY KEY DEFAULT NEWID(),
  user_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_customer_addresses_user REFERENCES dbo.users(id) ON DELETE CASCADE,
  recipient_name NVARCHAR(150) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  address_line NVARCHAR(255) NOT NULL,
  ward NVARCHAR(100) NULL,
  district NVARCHAR(100) NULL,
  province NVARCHAR(100) NOT NULL,
  is_default BIT NOT NULL DEFAULT 0,
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);
CREATE UNIQUE INDEX uq_customer_default_address ON dbo.customer_addresses(user_id) WHERE is_default = 1;
CREATE INDEX idx_customer_addresses_user ON dbo.customer_addresses(user_id, created_at DESC);

-- 12. carts
CREATE TABLE dbo.carts (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_carts PRIMARY KEY DEFAULT NEWID(),
  user_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT UQ_carts_user UNIQUE CONSTRAINT FK_carts_user REFERENCES dbo.users(id) ON DELETE CASCADE,
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

-- 13. cart_items
CREATE TABLE dbo.cart_items (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_cart_items PRIMARY KEY DEFAULT NEWID(),
  cart_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_cart_items_cart REFERENCES dbo.carts(id) ON DELETE CASCADE,
  product_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_cart_items_product REFERENCES dbo.products(id),
  quantity INT NOT NULL,
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT cart_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT UQ_cart_items_cart_product UNIQUE (cart_id, product_id)
);
CREATE INDEX idx_cart_items_cart ON dbo.cart_items(cart_id);

-- 14. pos_sessions
CREATE TABLE dbo.pos_sessions (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_pos_sessions PRIMARY KEY DEFAULT NEWID(),
  warehouse_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_pos_sessions_warehouse REFERENCES dbo.warehouses(id),
  opened_by UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_pos_sessions_user REFERENCES dbo.users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  opening_cash DECIMAL(14, 2) NOT NULL DEFAULT 0,
  closing_cash DECIMAL(14, 2) NULL,
  opened_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  closed_at DATETIMEOFFSET NULL,
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT pos_sessions_status_check CHECK (status IN ('open', 'closed')),
  CONSTRAINT pos_sessions_opening_cash_check CHECK (opening_cash >= 0),
  CONSTRAINT pos_sessions_closing_cash_check CHECK (closing_cash IS NULL OR closing_cash >= 0),
  CONSTRAINT pos_sessions_id_warehouse_unique UNIQUE (id, warehouse_id)
);
CREATE UNIQUE INDEX uq_pos_open_session_user ON dbo.pos_sessions(opened_by) WHERE status = 'open';
CREATE INDEX idx_pos_sessions_warehouse_status ON dbo.pos_sessions(warehouse_id, status);
CREATE INDEX idx_pos_sessions_opened_at ON dbo.pos_sessions(opened_at DESC);

-- 15. warehouse_documents
CREATE TABLE dbo.warehouse_documents (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_warehouse_documents PRIMARY KEY DEFAULT NEWID(),
  document_number VARCHAR(50) NOT NULL CONSTRAINT UQ_warehouse_documents_number UNIQUE,
  warehouse_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_warehouse_documents_warehouse REFERENCES dbo.warehouses(id),
  type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  supplier_name NVARCHAR(150) NULL,
  reference_code VARCHAR(80) NULL,
  note NVARCHAR(255) NULL,
  created_by UNIQUEIDENTIFIER NULL CONSTRAINT FK_warehouse_documents_creator REFERENCES dbo.users(id),
  completed_by UNIQUEIDENTIFIER NULL CONSTRAINT FK_warehouse_documents_completer REFERENCES dbo.users(id),
  completed_at DATETIMEOFFSET NULL,
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  require_scan BIT NOT NULL DEFAULT 1,
  approved_by UNIQUEIDENTIFIER NULL CONSTRAINT FK_warehouse_documents_approver REFERENCES dbo.users(id),
  approved_at DATETIMEOFFSET NULL,
  rejected_by UNIQUEIDENTIFIER NULL CONSTRAINT FK_warehouse_documents_rejecter REFERENCES dbo.users(id),
  rejected_at DATETIMEOFFSET NULL,
  rejection_reason NVARCHAR(255) NULL,
  qr_code VARCHAR(120) NULL,
  qr_scanned_at DATETIMEOFFSET NULL,
  qr_scanned_by UNIQUEIDENTIFIER NULL CONSTRAINT FK_warehouse_documents_scanner REFERENCES dbo.users(id),
  qr_scanned_source VARCHAR(50) NULL,
  CONSTRAINT warehouse_documents_type_check CHECK (type IN ('receipt', 'issue')),
  CONSTRAINT warehouse_documents_status_check CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'completed', 'cancelled'))
);
CREATE UNIQUE INDEX uq_warehouse_documents_qr ON dbo.warehouse_documents(qr_code) WHERE qr_code IS NOT NULL;
CREATE INDEX idx_warehouse_documents_warehouse ON dbo.warehouse_documents(warehouse_id, created_at DESC);
CREATE INDEX idx_warehouse_documents_status ON dbo.warehouse_documents(status);
CREATE INDEX idx_warehouse_documents_qr_scanned ON dbo.warehouse_documents(qr_scanned_at) WHERE qr_scanned_at IS NOT NULL;

-- 16. warehouse_document_items
CREATE TABLE dbo.warehouse_document_items (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_warehouse_document_items PRIMARY KEY DEFAULT NEWID(),
  document_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_warehouse_document_items_doc REFERENCES dbo.warehouse_documents(id) ON DELETE CASCADE,
  product_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_warehouse_document_items_prod REFERENCES dbo.products(id),
  quantity INT NOT NULL,
  unit_cost DECIMAL(14, 2) NOT NULL DEFAULT 0,
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  actual_quantity INT NULL,
  CONSTRAINT warehouse_document_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT warehouse_document_items_unit_cost_check CHECK (unit_cost >= 0),
  CONSTRAINT warehouse_document_items_actual_qty_check CHECK (actual_quantity IS NULL OR actual_quantity >= 0),
  CONSTRAINT UQ_warehouse_document_items_doc_prod UNIQUE (document_id, product_id)
);
CREATE INDEX idx_warehouse_document_items_product ON dbo.warehouse_document_items(product_id);

-- 17. warehouse_document_scan_events
CREATE TABLE dbo.warehouse_document_scan_events (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_warehouse_document_scan_events PRIMARY KEY DEFAULT NEWID(),
  document_item_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_wh_doc_scan_item REFERENCES dbo.warehouse_document_items(id) ON DELETE CASCADE,
  request_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT UQ_wh_doc_scan_request UNIQUE,
  identifier VARCHAR(100) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  scanned_by UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_wh_doc_scan_user REFERENCES dbo.users(id),
  scanned_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX idx_document_scans_item ON dbo.warehouse_document_scan_events(document_item_id);

-- 18. orders
CREATE TABLE dbo.orders (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_orders PRIMARY KEY DEFAULT NEWID(),
  order_number VARCHAR(40) NOT NULL CONSTRAINT UQ_orders_order_number UNIQUE,
  channel VARCHAR(20) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
  customer_name NVARCHAR(150) NULL,
  customer_phone VARCHAR(30) NULL,
  total_amount DECIMAL(14, 2) NOT NULL DEFAULT 0,
  created_by UNIQUEIDENTIFIER NULL CONSTRAINT FK_orders_creator REFERENCES dbo.users(id),
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  warehouse_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_orders_warehouse REFERENCES dbo.warehouses(id),
  shipping_address_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_orders_shipping_addr REFERENCES dbo.customer_addresses(id),
  pos_session_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_orders_pos_session REFERENCES dbo.pos_sessions(id),
  shipping_address_snapshot NVARCHAR(MAX) NULL,
  reservation_expires_at DATETIMEOFFSET NULL,
  idempotency_key VARCHAR(120) NULL,
  CONSTRAINT orders_channel_check CHECK (channel IN ('pos', 'web', 'mobile')),
  CONSTRAINT orders_status_check CHECK (status IN ('pending', 'confirmed', 'ready_to_pack', 'packed', 'handover', 'shipping', 'delivered', 'cancelled', 'returned')),
  CONSTRAINT orders_payment_status_check CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  CONSTRAINT orders_total_amount_check CHECK (total_amount >= 0),
  CONSTRAINT orders_pos_session_required CHECK ((channel = 'pos' AND pos_session_id IS NOT NULL) OR (channel <> 'pos' AND pos_session_id IS NULL))
);
CREATE UNIQUE INDEX uq_orders_actor_idempotency ON dbo.orders(created_by, channel, idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_orders_created ON dbo.orders(created_at DESC);
CREATE INDEX idx_orders_status ON dbo.orders(status);
CREATE INDEX idx_orders_warehouse ON dbo.orders(warehouse_id);
CREATE INDEX idx_orders_shipping_address ON dbo.orders(shipping_address_id);
CREATE INDEX idx_orders_pos_session ON dbo.orders(pos_session_id);
CREATE INDEX idx_orders_reservation_expiry ON dbo.orders(reservation_expires_at) WHERE status = 'pending' AND payment_status = 'unpaid';

-- 19. order_items
CREATE TABLE dbo.order_items (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_order_items PRIMARY KEY DEFAULT NEWID(),
  order_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_order_items_order REFERENCES dbo.orders(id) ON DELETE CASCADE,
  product_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_order_items_product REFERENCES dbo.products(id),
  quantity INT NOT NULL,
  unit_price DECIMAL(14, 2) NOT NULL,
  line_total AS (CAST(quantity * unit_price AS DECIMAL(14, 2))) PERSISTED,
  CONSTRAINT order_items_quantity_check CHECK (quantity > 0),
  CONSTRAINT order_items_unit_price_check CHECK (unit_price >= 0),
  CONSTRAINT UQ_order_items_order_product UNIQUE (order_id, product_id)
);

-- 20. inventory_reservations
CREATE TABLE dbo.inventory_reservations (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_inventory_reservations PRIMARY KEY DEFAULT NEWID(),
  order_item_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT UQ_inventory_reservations_item UNIQUE CONSTRAINT FK_inv_res_order_item REFERENCES dbo.order_items(id) ON DELETE CASCADE,
  warehouse_id UNIQUEIDENTIFIER NOT NULL,
  product_id UNIQUEIDENTIFIER NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  closed_at DATETIMEOFFSET NULL,
  expires_at DATETIMEOFFSET NULL,
  CONSTRAINT inventory_reservations_status_check CHECK (status IN ('active', 'consumed', 'released', 'expired')),
  CONSTRAINT inventory_reservations_closed_check CHECK ((status = 'active' AND closed_at IS NULL) OR (status <> 'active' AND closed_at IS NOT NULL)),
  CONSTRAINT FK_inv_res_inventory FOREIGN KEY (warehouse_id, product_id) REFERENCES dbo.inventory(warehouse_id, product_id)
);
CREATE INDEX idx_reservations_active_stock ON dbo.inventory_reservations(warehouse_id, product_id) WHERE status = 'active';
CREATE INDEX idx_inventory_reservations_expiry ON dbo.inventory_reservations(expires_at, warehouse_id, product_id) WHERE status = 'active' AND expires_at IS NOT NULL;

-- 21. inventory_transactions
CREATE TABLE dbo.inventory_transactions (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_inventory_transactions PRIMARY KEY DEFAULT NEWID(),
  warehouse_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_inv_tx_warehouse REFERENCES dbo.warehouses(id),
  product_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_inv_tx_product REFERENCES dbo.products(id),
  type VARCHAR(20) NOT NULL,
  quantity INT NOT NULL,
  reference_code VARCHAR(80) NULL,
  note NVARCHAR(255) NULL,
  created_by UNIQUEIDENTIFIER NULL CONSTRAINT FK_inv_tx_creator REFERENCES dbo.users(id),
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  quantity_delta INT NULL,
  quantity_before INT NULL,
  quantity_after INT NULL,
  order_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_inv_tx_order REFERENCES dbo.orders(id),
  order_item_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_inv_tx_order_item REFERENCES dbo.order_items(id),
  document_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_inv_tx_document REFERENCES dbo.warehouse_documents(id),
  operation_key VARCHAR(160) NULL,
  pos_order_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_inv_tx_pos_order REFERENCES dbo.orders(id),
  reference_id AS (COALESCE(order_id, pos_order_id, document_id)) PERSISTED,
  CONSTRAINT inventory_transaction_type_check CHECK (type IN ('receipt', 'issue', 'adjustment')),
  CONSTRAINT inventory_transaction_quantity_check CHECK (quantity > 0),
  CONSTRAINT inventory_transaction_delta_check CHECK (
    quantity_delta IS NULL OR (
      quantity_delta <> 0 AND ABS(CAST(quantity_delta AS BIGINT)) = quantity
      AND (type <> 'receipt' OR quantity_delta > 0)
      AND (type <> 'issue' OR quantity_delta < 0)
    )
  ),
  CONSTRAINT inventory_transaction_balance_check CHECK (
    quantity_before IS NULL OR (
      quantity_before >= 0 AND quantity_after >= 0
      AND CAST(quantity_after AS BIGINT) - quantity_before = quantity_delta
    )
  ),
  CONSTRAINT inventory_transaction_single_reference CHECK (
    (CASE WHEN order_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN pos_order_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN document_id IS NOT NULL THEN 1 ELSE 0 END) <= 1
  )
);
CREATE UNIQUE INDEX uq_inventory_transaction_operation ON dbo.inventory_transactions(operation_key) WHERE operation_key IS NOT NULL;
CREATE INDEX idx_inventory_transactions_created ON dbo.inventory_transactions(created_at DESC);
CREATE INDEX idx_inventory_transactions_stock_time ON dbo.inventory_transactions(warehouse_id, product_id, created_at DESC);
CREATE INDEX idx_inventory_transactions_reference ON dbo.inventory_transactions(reference_id);

-- 22. api_idempotency_keys
CREATE TABLE dbo.api_idempotency_keys (
  user_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_api_idem_user REFERENCES dbo.users(id),
  operation VARCHAR(30) NOT NULL CHECK (operation IN ('customer.checkout', 'pos.sale')),
  [key] VARCHAR(120) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  order_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_api_idem_order REFERENCES dbo.orders(id),
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT PK_api_idempotency_keys PRIMARY KEY (user_id, operation, [key])
);

-- 23. order_status_history
CREATE TABLE dbo.order_status_history (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_order_status_history PRIMARY KEY DEFAULT NEWID(),
  order_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_order_status_history_order REFERENCES dbo.orders(id) ON DELETE CASCADE,
  status VARCHAR(30) NOT NULL,
  note NVARCHAR(255) NULL,
  changed_by UNIQUEIDENTIFIER NULL CONSTRAINT FK_order_status_history_user REFERENCES dbo.users(id),
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  from_status VARCHAR(30) NULL,
  CONSTRAINT order_status_history_status_check CHECK (
    status IN ('pending', 'confirmed', 'ready_to_pack', 'packed', 'handover', 'shipping', 'delivered', 'cancelled', 'returned')
    AND (from_status IS NULL OR from_status IN ('pending', 'confirmed', 'ready_to_pack', 'packed', 'handover', 'shipping', 'delivered', 'cancelled', 'returned'))
  )
);
CREATE INDEX idx_order_status_history_order ON dbo.order_status_history(order_id, created_at ASC);

-- 24. bank_transfer_requests
CREATE TABLE dbo.bank_transfer_requests (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_bank_transfer_requests PRIMARY KEY DEFAULT NEWID(),
  order_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_bank_transfer_order REFERENCES dbo.orders(id),
  submitted_by UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_bank_transfer_submitter REFERENCES dbo.users(id),
  bank_reference VARCHAR(100) NOT NULL,
  note NVARCHAR(255) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  reviewed_by UNIQUEIDENTIFIER NULL CONSTRAINT FK_bank_transfer_reviewer REFERENCES dbo.users(id),
  review_note NVARCHAR(255) NULL,
  confirmed_bank_reference VARCHAR(100) NULL,
  confirmed_amount DECIMAL(14, 2) NULL,
  submitted_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  reviewed_at DATETIMEOFFSET NULL,
  CONSTRAINT UQ_bank_transfer_order_ref UNIQUE (order_id, bank_reference)
);
CREATE UNIQUE INDEX uq_pending_transfer_order ON dbo.bank_transfer_requests(order_id) WHERE status = 'pending';

-- 25. payments
CREATE TABLE dbo.payments (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_payments PRIMARY KEY DEFAULT NEWID(),
  order_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_payments_order REFERENCES dbo.orders(id) ON DELETE CASCADE,
  method VARCHAR(20) NOT NULL,
  amount DECIMAL(14, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'paid',
  transaction_reference VARCHAR(100) NULL,
  received_by UNIQUEIDENTIFIER NULL CONSTRAINT FK_payments_receiver REFERENCES dbo.users(id),
  paid_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  refunded_at DATETIMEOFFSET NULL,
  transfer_request_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_payments_transfer_req REFERENCES dbo.bank_transfer_requests(id),
  refund_reference VARCHAR(100) NULL,
  refunded_by UNIQUEIDENTIFIER NULL CONSTRAINT FK_payments_refunder REFERENCES dbo.users(id),
  CONSTRAINT payments_method_check CHECK (method IN ('cash', 'card', 'transfer')),
  CONSTRAINT payments_amount_check CHECK (amount > 0),
  CONSTRAINT payments_status_check CHECK (status IN ('paid', 'refunded'))
);
CREATE UNIQUE INDEX uq_payments_transfer_request ON dbo.payments(transfer_request_id) WHERE transfer_request_id IS NOT NULL;
CREATE UNIQUE INDEX uq_confirmed_bank_reference ON dbo.payments(transaction_reference) WHERE transfer_request_id IS NOT NULL;
CREATE INDEX idx_payments_order ON dbo.payments(order_id);
CREATE INDEX idx_payments_paid_at ON dbo.payments(paid_at DESC);

-- 26. manual_refunds
CREATE TABLE dbo.manual_refunds (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_manual_refunds PRIMARY KEY DEFAULT NEWID(),
  order_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT UQ_manual_refunds_order UNIQUE CONSTRAINT FK_manual_refunds_order REFERENCES dbo.orders(id),
  amount DECIMAL(14, 2) NOT NULL CHECK (amount > 0),
  bank_reference VARCHAR(100) NOT NULL CONSTRAINT UQ_manual_refunds_bank_ref UNIQUE,
  confirmed_by UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_manual_refunds_user REFERENCES dbo.users(id),
  note NVARCHAR(255) NULL,
  confirmed_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

-- 27. shipments
CREATE TABLE dbo.shipments (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_shipments PRIMARY KEY DEFAULT NEWID(),
  order_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT UQ_shipments_order UNIQUE CONSTRAINT FK_shipments_order REFERENCES dbo.orders(id) ON DELETE CASCADE,
  tracking_number VARCHAR(60) NOT NULL CONSTRAINT UQ_shipments_tracking UNIQUE,
  carrier NVARCHAR(100) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'assigned',
  assigned_to UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_shipments_assignee REFERENCES dbo.users(id),
  created_by UNIQUEIDENTIFIER NULL CONSTRAINT FK_shipments_creator REFERENCES dbo.users(id),
  note NVARCHAR(255) NULL,
  picked_up_at DATETIMEOFFSET NULL,
  delivered_at DATETIMEOFFSET NULL,
  failed_at DATETIMEOFFSET NULL,
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT shipments_status_check CHECK (status IN ('assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'returned'))
);
CREATE INDEX idx_shipments_assigned_status ON dbo.shipments(assigned_to, status);
CREATE INDEX idx_shipments_status ON dbo.shipments(status);

-- 28. shipment_status_history
CREATE TABLE dbo.shipment_status_history (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_shipment_status_history PRIMARY KEY DEFAULT NEWID(),
  shipment_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_shipment_history_shipment REFERENCES dbo.shipments(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL,
  note NVARCHAR(255) NULL,
  changed_by UNIQUEIDENTIFIER NULL CONSTRAINT FK_shipment_history_user REFERENCES dbo.users(id),
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT shipment_history_status_check CHECK (status IN ('assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'returned'))
);
CREATE INDEX idx_shipment_history_shipment ON dbo.shipment_status_history(shipment_id, created_at ASC);

-- 29. order_processing_tasks
CREATE TABLE dbo.order_processing_tasks (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_order_processing_tasks PRIMARY KEY DEFAULT NEWID(),
  order_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT UQ_order_processing_tasks_order UNIQUE CONSTRAINT FK_order_tasks_order REFERENCES dbo.orders(id) ON DELETE CASCADE,
  assigned_to UNIQUEIDENTIFIER NULL CONSTRAINT FK_order_tasks_assignee REFERENCES dbo.users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'assigned',
  note NVARCHAR(255) NULL,
  assigned_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  completed_at DATETIMEOFFSET NULL,
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  updated_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT order_processing_tasks_status_check CHECK (status IN ('assigned', 'picking', 'ready_to_pack', 'cancelled'))
);
CREATE INDEX idx_order_processing_tasks_assigned ON dbo.order_processing_tasks(assigned_to, status);
CREATE INDEX idx_order_processing_tasks_status ON dbo.order_processing_tasks(status);

-- 30. order_scan_events
CREATE TABLE dbo.order_scan_events (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_order_scan_events PRIMARY KEY DEFAULT NEWID(),
  order_item_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_order_scan_item REFERENCES dbo.order_items(id) ON DELETE CASCADE,
  request_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT UQ_order_scan_request UNIQUE,
  identifier VARCHAR(100) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  scanned_by UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_order_scan_user REFERENCES dbo.users(id),
  scanned_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX idx_order_scans_item ON dbo.order_scan_events(order_item_id);

-- 31. order_return_receipts
CREATE TABLE dbo.order_return_receipts (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_order_return_receipts PRIMARY KEY DEFAULT NEWID(),
  order_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT UQ_order_return_receipts_order UNIQUE CONSTRAINT FK_order_return_order REFERENCES dbo.orders(id),
  warehouse_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_order_return_warehouse REFERENCES dbo.warehouses(id),
  received_by UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_order_return_user REFERENCES dbo.users(id),
  note NVARCHAR(255) NULL,
  received_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET()
);

-- 32. order_return_receipt_items
CREATE TABLE dbo.order_return_receipt_items (
  receipt_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_return_items_receipt REFERENCES dbo.order_return_receipts(id) ON DELETE CASCADE,
  order_item_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_return_items_order_item REFERENCES dbo.order_items(id),
  received_quantity INT NOT NULL CHECK (received_quantity > 0),
  restock_quantity INT NOT NULL,
  CONSTRAINT PK_order_return_receipt_items PRIMARY KEY (receipt_id, order_item_id),
  CONSTRAINT order_return_receipt_items_restock_check CHECK (restock_quantity >= 0 AND restock_quantity <= received_quantity)
);

-- 33. forecast_runs
CREATE TABLE dbo.forecast_runs (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_forecast_runs PRIMARY KEY DEFAULT NEWID(),
  model_name VARCHAR(80) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  lookback_days INT NOT NULL,
  horizon_days INT NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  mae DECIMAL(14, 4) NULL,
  rmse DECIMAL(14, 4) NULL,
  created_by UNIQUEIDENTIFIER NULL CONSTRAINT FK_forecast_runs_creator REFERENCES dbo.users(id),
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  completed_at DATETIMEOFFSET NULL,
  warehouse_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_forecast_runs_warehouse REFERENCES dbo.warehouses(id),
  metadata NVARCHAR(MAX) NOT NULL DEFAULT N'{}',
  CONSTRAINT forecast_runs_status_check CHECK (status IN ('running', 'completed', 'failed')),
  CONSTRAINT forecast_runs_lookback_check CHECK (lookback_days > 0),
  CONSTRAINT forecast_runs_horizon_check CHECK (horizon_days > 0)
);
CREATE INDEX idx_forecast_runs_created ON dbo.forecast_runs(created_at DESC);

-- 34. forecast_values
CREATE TABLE dbo.forecast_values (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_forecast_values PRIMARY KEY DEFAULT NEWID(),
  run_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_forecast_values_run REFERENCES dbo.forecast_runs(id) ON DELETE CASCADE,
  product_id UNIQUEIDENTIFIER NOT NULL CONSTRAINT FK_forecast_values_product REFERENCES dbo.products(id),
  warehouse_id UNIQUEIDENTIFIER NULL CONSTRAINT FK_forecast_values_warehouse REFERENCES dbo.warehouses(id),
  forecast_date DATE NOT NULL,
  predicted_quantity DECIMAL(18, 6) NOT NULL,
  lower_bound DECIMAL(18, 6) NOT NULL DEFAULT 0,
  upper_bound DECIMAL(18, 6) NOT NULL,
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT forecast_values_quantity_check CHECK (predicted_quantity >= 0),
  CONSTRAINT forecast_values_bounds_check CHECK (lower_bound >= 0 AND upper_bound >= predicted_quantity),
  CONSTRAINT UQ_forecast_values_run_prod_wh_date UNIQUE (run_id, product_id, warehouse_id, forecast_date)
);
CREATE UNIQUE INDEX uq_forecast_global_value ON dbo.forecast_values(run_id, product_id, forecast_date) WHERE warehouse_id IS NULL;
CREATE INDEX idx_forecast_values_product_date ON dbo.forecast_values(product_id, forecast_date);
CREATE INDEX idx_forecast_values_run ON dbo.forecast_values(run_id);

-- 35. data_exchange_jobs
CREATE TABLE dbo.data_exchange_jobs (
  id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_data_exchange_jobs PRIMARY KEY DEFAULT NEWID(),
  operation VARCHAR(20) NOT NULL,
  data_type VARCHAR(30) NOT NULL,
  file_name NVARCHAR(255) NULL,
  file_format VARCHAR(10) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'processing',
  total_rows INT NOT NULL DEFAULT 0,
  success_rows INT NOT NULL DEFAULT 0,
  error_rows INT NOT NULL DEFAULT 0,
  errors NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
  created_by UNIQUEIDENTIFIER NULL CONSTRAINT FK_data_exchange_creator REFERENCES dbo.users(id),
  created_at DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
  completed_at DATETIMEOFFSET NULL,
  error_details NVARCHAR(MAX) NOT NULL DEFAULT N'[]',
  CONSTRAINT data_exchange_operation_check CHECK (operation IN ('import', 'export')),
  CONSTRAINT data_exchange_type_check CHECK (data_type IN ('categories', 'products', 'inventory', 'orders', 'sales')),
  CONSTRAINT data_exchange_status_check CHECK (status IN ('processing', 'completed', 'failed')),
  CONSTRAINT data_exchange_rows_check CHECK (total_rows >= 0 AND success_rows >= 0 AND error_rows >= 0)
);
CREATE INDEX idx_data_exchange_jobs_user_created ON dbo.data_exchange_jobs(created_by, created_at DESC);
CREATE INDEX idx_data_exchange_jobs_status ON dbo.data_exchange_jobs(status);
GO

-- 36. VIEW: inventory_reservation_discrepancies
CREATE VIEW dbo.inventory_reservation_discrepancies AS
SELECT
  i.warehouse_id,
  i.product_id,
  i.quantity,
  i.reserved_quantity,
  CAST(COALESCE(SUM(CASE WHEN r.status = 'active' THEN r.quantity ELSE 0 END), 0) AS BIGINT) AS expected_reserved_quantity
FROM dbo.inventory i
LEFT JOIN dbo.inventory_reservations r
  ON r.warehouse_id = i.warehouse_id AND r.product_id = i.product_id
GROUP BY i.warehouse_id, i.product_id, i.quantity, i.reserved_quantity
HAVING i.reserved_quantity <> COALESCE(SUM(CASE WHEN r.status = 'active' THEN r.quantity ELSE 0 END), 0);
GO

-- 37. VIEW: inventory_reservation_reconciliation
CREATE VIEW dbo.inventory_reservation_reconciliation AS
SELECT
  i.warehouse_id,
  i.product_id,
  i.quantity,
  i.reserved_quantity,
  CAST(COALESCE(SUM(CASE WHEN r.status = 'active' THEN r.quantity ELSE 0 END), 0) AS BIGINT) AS active_reserved_quantity,
  CAST(CASE WHEN i.reserved_quantity = COALESCE(SUM(CASE WHEN r.status = 'active' THEN r.quantity ELSE 0 END), 0) THEN 1 ELSE 0 END AS BIT) AS is_balanced
FROM dbo.inventory i
LEFT JOIN dbo.inventory_reservations r
  ON r.warehouse_id = i.warehouse_id AND r.product_id = i.product_id
GROUP BY i.warehouse_id, i.product_id, i.quantity, i.reserved_quantity;
GO

-- 38. TRIGGER: trg_orders_enforce_state_transition
CREATE TRIGGER dbo.trg_orders_enforce_state_transition
ON dbo.orders
AFTER UPDATE
AS
BEGIN
  SET NOCOUNT ON;
  IF NOT UPDATE(status) RETURN;

  IF EXISTS (
    SELECT 1
    FROM inserted i
    JOIN deleted d ON d.id = i.id
    WHERE i.status <> d.status
      AND NOT (
        (d.status = 'pending' AND i.status IN ('confirmed', 'cancelled')) OR
        (d.status = 'confirmed' AND i.status IN ('ready_to_pack', 'cancelled')) OR
        (d.status = 'ready_to_pack' AND i.status IN ('packed', 'cancelled')) OR
        (d.status = 'packed' AND i.status = 'handover') OR
        (d.status = 'handover' AND i.status IN ('shipping', 'returned')) OR
        (d.status = 'shipping' AND i.status IN ('delivered', 'returned')) OR
        (d.status = 'delivered' AND i.status = 'returned')
      )
  )
  BEGIN
    ;THROW 50001, 'Invalid order state transition', 1;
  END
END;
GO
