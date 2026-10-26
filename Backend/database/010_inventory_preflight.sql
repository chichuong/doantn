-- Read-only. Run after 001-009 and before 010, while the old API is stopped.
-- Grid 1: must return no rows.
SELECT id, order_number, channel, status, warehouse_id, created_at FROM orders
WHERE channel IN ('web', 'mobile') AND status IN ('pending', 'confirmed', 'processing') AND warehouse_id IS NULL;

-- Grid 2: must return no rows before migration 010.
WITH expected AS (
  SELECT o.warehouse_id, oi.product_id, SUM(oi.quantity) AS reserved
  FROM orders o JOIN order_items oi ON oi.order_id = o.id
  WHERE o.channel IN ('web', 'mobile') AND o.status IN ('pending', 'confirmed', 'processing')
  GROUP BY o.warehouse_id, oi.product_id
)
SELECT COALESCE(i.warehouse_id, e.warehouse_id) AS warehouse_id,
  COALESCE(i.product_id, e.product_id) AS product_id,
  i.quantity, i.reserved_quantity, COALESCE(e.reserved, 0) AS expected_reserved
FROM inventory i FULL JOIN expected e ON e.warehouse_id = i.warehouse_id AND e.product_id = i.product_id
WHERE COALESCE(i.reserved_quantity, 0) <> COALESCE(e.reserved, 0) OR (e.reserved IS NOT NULL AND i.product_id IS NULL);

-- Grid 3: contributing orders for every mismatched counter.
WITH expected AS (
  SELECT o.warehouse_id, oi.product_id, SUM(oi.quantity)::integer AS expected_reserved
  FROM orders o JOIN order_items oi ON oi.order_id = o.id
  WHERE o.channel IN ('web', 'mobile') AND o.status IN ('pending', 'confirmed', 'processing')
  GROUP BY o.warehouse_id, oi.product_id
), mismatches AS (
  SELECT COALESCE(i.warehouse_id, e.warehouse_id) AS warehouse_id,
    COALESCE(i.product_id, e.product_id) AS product_id
  FROM inventory i FULL JOIN expected e
    ON e.warehouse_id = i.warehouse_id AND e.product_id = i.product_id
  WHERE COALESCE(i.reserved_quantity, 0) <> COALESCE(e.expected_reserved, 0)
    OR (e.expected_reserved IS NOT NULL AND i.product_id IS NULL)
)
SELECT o.id AS order_id, o.order_number, o.status, o.warehouse_id,
  oi.id AS order_item_id, oi.product_id, p.sku, oi.quantity
FROM mismatches m
LEFT JOIN orders o ON o.warehouse_id = m.warehouse_id
  AND o.channel IN ('web', 'mobile') AND o.status IN ('pending', 'confirmed', 'processing')
LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.product_id = m.product_id
LEFT JOIN products p ON p.id = m.product_id
ORDER BY o.created_at, o.order_number, p.sku;

-- Informational POS evidence for migration 010.
SELECT o.id, o.order_number, o.status, o.warehouse_id,
  ARRAY_AGG(DISTINCT t.warehouse_id) FILTER (WHERE t.id IS NOT NULL) AS issue_warehouses
FROM orders o LEFT JOIN inventory_transactions t ON t.reference_code = o.order_number AND t.type = 'issue'
WHERE o.channel = 'pos' GROUP BY o.id ORDER BY o.created_at;

-- Must return no rows before migration 011 creates a normalized unique index.
SELECT LOWER(BTRIM(name)) AS normalized_name, ARRAY_AGG(id) AS category_ids, ARRAY_AGG(name) AS names
FROM categories GROUP BY LOWER(BTRIM(name)) HAVING COUNT(*) > 1;
