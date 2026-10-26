BEGIN;
ALTER TABLE forecast_runs ADD COLUMN warehouse_id UUID REFERENCES warehouses(id);
ALTER TABLE forecast_runs ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
-- Adopt scope for old runs only if all values clearly belong to exactly one warehouse.
UPDATE forecast_runs r SET warehouse_id = v.warehouse_id FROM (
  SELECT run_id, MIN(warehouse_id::text)::uuid AS warehouse_id FROM forecast_values
  GROUP BY run_id HAVING COUNT(DISTINCT warehouse_id) = 1 AND COUNT(warehouse_id) = COUNT(*)
) v WHERE v.run_id = r.id;
CREATE UNIQUE INDEX uq_forecast_global_value ON forecast_values(run_id, product_id, forecast_date) WHERE warehouse_id IS NULL;
COMMIT;
