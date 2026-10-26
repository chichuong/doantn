import { query, closeDatabase } from '../src/config/database.js';

async function checkSchema() {
  try {
    console.log('--- TABLES IN PUBLIC SCHEMA ---');
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log(tables.rows.map(r => r.table_name).join(', '));

    console.log('\n--- CHECKING CONSTRAINTS & FOREIGN KEYS ---');
    const fkQuery = await query(`
      SELECT
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name;
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
