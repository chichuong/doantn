import { query, closeDatabase } from '../src/config/database.js';

async function checkSchema() {
  try {
    console.log('--- TABLES IN DBO SCHEMA ---');
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'dbo' 
      ORDER BY table_name;
    `);
    console.log(tables.rows.map(r => r.table_name).join(', '));

    console.log('\n--- CHECKING CONSTRAINTS & FOREIGN KEYS ---');
    const fkQuery = await query(`
      SELECT
        OBJECT_NAME(f.parent_object_id) AS table_name,
        COL_NAME(fc.parent_object_id, fc.parent_column_id) AS column_name,
        OBJECT_NAME(f.referenced_object_id) AS foreign_table_name,
        COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS foreign_column_name
      FROM sys.foreign_keys AS f
      INNER JOIN sys.foreign_key_columns AS fc ON f.object_id = fc.constraint_object_id
      ORDER BY table_name, column_name;
    `);
    console.log(`Total Foreign Keys: ${fkQuery.rowCount}`);

    console.log('\n--- CHECKING ORPHAN DATA ---');
    // Check order_items with invalid product_id
    const orphanOrderItems = await query(`
      SELECT COUNT(*) as count FROM order_items oi
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE p.id IS NULL;
    `);
    console.log(`Orphan order_items (product_id not in products): ${orphanOrderItems.rows[0].count}`);

    // Check inventory with invalid product or warehouse
    const orphanInventory = await query(`
      SELECT COUNT(*) as count FROM inventory i
      LEFT JOIN products p ON p.id = i.product_id
      LEFT JOIN warehouses w ON w.id = i.warehouse_id
      WHERE p.id IS NULL OR w.id IS NULL;
    `);
    console.log(`Orphan inventory (invalid product or warehouse): ${orphanInventory.rows[0].count}`);

    // Check negative inventory
    const negativeStock = await query(`
      SELECT COUNT(*) as count FROM inventory
      WHERE quantity < 0 OR reserved_quantity < 0 OR reserved_quantity > quantity;
    `);
    console.log(`Negative or invalid stock records: ${negativeStock.rows[0].count}`);

    // Check duplicate SKUs
    const dupSku = await query(`
      SELECT sku, count(*) FROM products GROUP BY sku HAVING count(*) > 1;
    `);
    console.log(`Duplicate SKUs: ${dupSku.rowCount}`);

    // Check duplicate barcodes
    const dupBarcode = await query(`
      SELECT barcode, count(*) FROM products WHERE barcode IS NOT NULL GROUP BY barcode HAVING count(*) > 1;
    `);
    console.log(`Duplicate barcodes: ${dupBarcode.rowCount}`);

    // Check orders total calculation consistency
    const inconsistentOrders = await query(`
      SELECT o.id, o.order_number, o.total_amount, SUM(oi.line_total) as sum_lines
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      GROUP BY o.id, o.order_number, o.total_amount
      HAVING o.total_amount != SUM(oi.line_total);
    `);
    console.log(`Orders with total_amount mismatch: ${inconsistentOrders.rowCount}`);

  } catch (err) {
    console.error('Schema check error:', err);
  } finally {
    await closeDatabase();
  }
}

checkSchema();
