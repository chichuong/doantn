import { pool, closeDatabase } from '../src/config/database.js';

const client = await pool.connect();
try {
  await client.query('BEGIN');
  const candidates = await client.query(`
    SELECT id, sku, name
    FROM products
    WHERE sku LIKE 'TEST-SKU-%'
       OR sku LIKE 'LIMITED-RACE-%'
       OR sku LIKE 'IMP-SKU-%'
       OR sku = 'SP-NEW-001'
       OR LOWER(name) LIKE '%test%'
       OR LOWER(name) LIKE '%kiểm thử%'
       OR LOWER(name) LIKE '%sản phẩm mẫu%'
       OR LOWER(name) LIKE '%sản phẩm import%'
       OR LOWER(name) LIKE '%sản phẩm số lượng giới hạn%'
    FOR UPDATE
  `);

  const ids = candidates.rows.map((row) => row.id);
  let removedCartItems = 0;
  if (ids.length) {
    removedCartItems = (await client.query(
      'DELETE FROM cart_items WHERE product_id = ANY($1::uuid[])',
      [ids]
    )).rowCount;
    await client.query(
      'UPDATE products SET is_active = FALSE, updated_at = NOW() WHERE id = ANY($1::uuid[])',
      [ids]
    );
  }

  await client.query('COMMIT');
  console.log(JSON.stringify({
    archivedProducts: candidates.rows.length,
    removedCartItems,
    products: candidates.rows
  }, null, 2));
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await closeDatabase();
}
