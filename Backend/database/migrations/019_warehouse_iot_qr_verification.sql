BEGIN;

-- Add QR verification tracking columns to warehouse_documents
ALTER TABLE warehouse_documents ADD COLUMN IF NOT EXISTS qr_scanned_at TIMESTAMPTZ;
ALTER TABLE warehouse_documents ADD COLUMN IF NOT EXISTS qr_scanned_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE warehouse_documents ADD COLUMN IF NOT EXISTS qr_scanned_source VARCHAR(50);

CREATE INDEX IF NOT EXISTS idx_warehouse_documents_qr_scanned ON warehouse_documents(qr_scanned_at) WHERE qr_scanned_at IS NOT NULL;

COMMIT;
