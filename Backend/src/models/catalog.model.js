import { query } from '../config/database.js';
export const getProduct = async (id) => {
  const result = await query(`SELECT p.id, p.sku, p.barcode, p.name, p.description, p.category_id,
    c.name AS category_name, p.sale_price,
    COALESCE((SELECT SUM(i.quantity - i.reserved_quantity) FROM inventory i JOIN warehouses w ON w.id = i.warehouse_id
      WHERE i.product_id = p.id AND w.is_active = TRUE), 0)::bigint AS available_quantity
    FROM products p LEFT JOIN categories c ON c.id = p.category_id WHERE p.id = $1 AND p.is_active = TRUE`, [id]);
  return result.rows[0] || null;
};
