BEGIN;
CREATE TABLE bank_transfer_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  submitted_by UUID NOT NULL REFERENCES users(id),
  bank_reference VARCHAR(100) NOT NULL,
  note VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected')),
  reviewed_by UUID REFERENCES users(id),
  review_note VARCHAR(255),
  confirmed_bank_reference VARCHAR(100),
  confirmed_amount NUMERIC(14,2),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  UNIQUE (order_id, bank_reference)
);
CREATE UNIQUE INDEX uq_pending_transfer_order ON bank_transfer_requests(order_id) WHERE status = 'pending';
CREATE TABLE manual_refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id),
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  bank_reference VARCHAR(100) NOT NULL UNIQUE,
  confirmed_by UUID NOT NULL REFERENCES users(id),
  note VARCHAR(255),
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE payments ADD COLUMN transfer_request_id UUID UNIQUE REFERENCES bank_transfer_requests(id);
ALTER TABLE payments ADD COLUMN refund_reference VARCHAR(100);
ALTER TABLE payments ADD COLUMN refunded_by UUID REFERENCES users(id);
-- Only manually confirmed online transfers use this field, so legacy POS references remain untouched.
CREATE UNIQUE INDEX uq_confirmed_bank_reference ON payments(transaction_reference)
  WHERE transfer_request_id IS NOT NULL;

INSERT INTO permissions (code, name, module, action, description) VALUES
  ('payments.customer.manage', 'Thong tin chuyen khoan', 'payments', 'customer.manage', 'Xem QR va gui thong tin chuyen khoan cua don ca nhan'),
  ('payments.transfers.read', 'Xem doi soat', 'payments', 'transfers.read', 'Xem yeu cau xac nhan chuyen khoan'),
  ('payments.transfers.review', 'Doi soat chuyen khoan', 'payments', 'transfers.review', 'Xac nhan hoac tu choi sau khi doi soat ngan hang'),
  ('payments.refunds.confirm', 'Xac nhan hoan tien', 'payments', 'refunds.confirm', 'Ghi nhan hoan tien thu cong da thuc hien')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE (r.code IN ('admin', 'customer') AND p.code = 'payments.customer.manage')
  OR (r.code IN ('admin', 'manager') AND p.code IN ('payments.transfers.read', 'payments.transfers.review', 'payments.refunds.confirm'))
ON CONFLICT DO NOTHING;
COMMIT;
