CREATE TABLE IF NOT EXISTS forecast_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name VARCHAR(80) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'running',
  lookback_days INTEGER NOT NULL,
  horizon_days INTEGER NOT NULL,
  from_date DATE NOT NULL,
  to_date DATE NOT NULL,
  mae NUMERIC(14, 4),
  rmse NUMERIC(14, 4),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT forecast_runs_status_check CHECK (status IN ('running', 'completed', 'failed')),
  CONSTRAINT forecast_runs_lookback_check CHECK (lookback_days > 0),
  CONSTRAINT forecast_runs_horizon_check CHECK (horizon_days > 0)
);

CREATE TABLE IF NOT EXISTS forecast_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES forecast_runs(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  warehouse_id UUID REFERENCES warehouses(id),
  forecast_date DATE NOT NULL,
  predicted_quantity NUMERIC(14, 2) NOT NULL,
  lower_bound NUMERIC(14, 2) NOT NULL DEFAULT 0,
  upper_bound NUMERIC(14, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT forecast_values_quantity_check CHECK (predicted_quantity >= 0),
  CONSTRAINT forecast_values_bounds_check CHECK (lower_bound >= 0 AND upper_bound >= predicted_quantity),
  UNIQUE (run_id, product_id, warehouse_id, forecast_date)
);

CREATE INDEX IF NOT EXISTS idx_forecast_runs_created ON forecast_runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forecast_values_product_date ON forecast_values(product_id, forecast_date);
CREATE INDEX IF NOT EXISTS idx_forecast_values_run ON forecast_values(run_id);

INSERT INTO permissions (code, name, module, action, description)
VALUES
  ('forecasting.run', 'Chay du bao', 'forecasting', 'run', 'Chay mo hinh du bao nhu cau'),
  ('forecasting.read', 'Xem ket qua du bao', 'forecasting', 'read', 'Xem ket qua va metric du bao'),
  ('forecasting.alerts.read', 'Xem canh bao thieu hang', 'forecasting', 'alerts.read', 'Xem canh bao ton kho theo du bao')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN ('forecasting.run', 'forecasting.read', 'forecasting.alerts.read')
WHERE r.code IN ('admin', 'manager')
ON CONFLICT DO NOTHING;
