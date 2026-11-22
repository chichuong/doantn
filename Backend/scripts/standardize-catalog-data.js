import { pool } from '../src/config/database.js';

async function standardize() {
  const centralWhId = '43efd948-a5dc-4d39-b41a-02ef6733037c';

  // 1. Cập nhật tên sản phẩm chuẩn tiếng Việt có dấu
  const updates = [
    { sku: 'SP-001', name: 'Bình nước inox 750ml', description: 'Bình nước giữ nhiệt inox 304 cao cấp' },
    { sku: 'SP-002', name: 'Cà phê rang xay 500g', description: 'Cà phê Robusta & Arabica nguyên chất' },
    { sku: 'SP-003', name: 'Nước suối đóng chai 500ml', description: 'Nước khoáng tinh khiết đóng chai' },
  ];

  for (const u of updates) {
    await pool.query('UPDATE products SET name = $1, description = $2 WHERE sku = $3', [u.name, u.description, u.sku]);
  }

  // 2. Cấp tồn kho thực tế cho 5 sản phẩm demo đang bị "Hết hàng" (0 tồn)
  const demoProducts = await pool.query("SELECT id, sku FROM products WHERE sku LIKE 'IMP-DEMO%'");
  for (const p of demoProducts.rows) {
    await pool.query(
      `INSERT INTO inventory (warehouse_id, product_id, quantity, reserved_quantity, updated_at)
       VALUES ($1, $2, 60, 0, NOW())
       ON CONFLICT (warehouse_id, product_id)
       DO UPDATE SET quantity = 60, reserved_quantity = 0, updated_at = NOW()`,
      [centralWhId, p.id]
    );
  }

  // 3. Chuẩn hóa tên danh mục có dấu chuẩn
  await pool.query("UPDATE categories SET name = 'Đồ gia dụng' WHERE name = 'Do gia dung'");
  await pool.query("UPDATE categories SET name = 'Thực phẩm đóng gói' WHERE name = 'Thuc pham dong goi'");
  await pool.query("UPDATE categories SET name = 'Đồ uống' WHERE name = 'Do uong'");

  console.log('Standardization complete!');
  process.exit(0);
}

standardize().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

