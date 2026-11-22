import { pool } from '../src/config/database.js';

async function unifyAndClean() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const centralWhId = '43efd948-a5dc-4d39-b41a-02ef6733037c';

    // Lấy id của SP-001 hoặc GD-BINH-750 làm sản phẩm đại diện
    const sp001 = await client.query("SELECT id FROM products WHERE sku = 'SP-001' OR sku = 'GD-BINH-750' LIMIT 1");
    const sp001Id = sp001.rows[0].id;

    // 1. Chuyển order_items đang trỏ tới sản phẩm test sang SP-001
    await client.query(
      `UPDATE order_items 
       SET product_id = $1 
       WHERE product_id IN (
         SELECT id FROM products 
         WHERE sku LIKE 'LIMITED-RACE%' OR sku LIKE 'TEST-SKU%' OR sku LIKE 'IMP-SKU%' OR sku = 'SP-NEW-001'
       )`,
      [sp001Id]
    );

    // 2. Xóa các ràng buộc bảng phụ của các sản phẩm rác
    await client.query(
      `DELETE FROM inventory_reservations 
       WHERE product_id IN (
         SELECT id FROM products 
         WHERE sku LIKE 'LIMITED-RACE%' OR sku LIKE 'TEST-SKU%' OR sku LIKE 'IMP-SKU%' OR sku = 'SP-NEW-001'
       )`
    );

    await client.query(
      `DELETE FROM forecast_values 
       WHERE product_id IN (
         SELECT id FROM products 
         WHERE sku LIKE 'LIMITED-RACE%' OR sku LIKE 'TEST-SKU%' OR sku LIKE 'IMP-SKU%' OR sku = 'SP-NEW-001'
       )`
    );

    await client.query(
      `DELETE FROM inventory_transactions 
       WHERE product_id IN (
         SELECT id FROM products 
         WHERE sku LIKE 'LIMITED-RACE%' OR sku LIKE 'TEST-SKU%' OR sku LIKE 'IMP-SKU%' OR sku = 'SP-NEW-001'
       )`
    );

    // 3. Xóa inventory của các sản phẩm rác
    await client.query(
      `DELETE FROM inventory 
       WHERE product_id IN (
         SELECT id FROM products 
         WHERE sku LIKE 'LIMITED-RACE%' OR sku LIKE 'TEST-SKU%' OR sku LIKE 'IMP-SKU%' OR sku = 'SP-NEW-001'
       )`
    );

    // 4. Xóa sạch các sản phẩm rác khỏi bảng products
    const delRes = await client.query(
      `DELETE FROM products 
       WHERE sku LIKE 'LIMITED-RACE%' OR sku LIKE 'TEST-SKU%' OR sku LIKE 'IMP-SKU%' OR sku = 'SP-NEW-001'`
    );
    console.log(`Đã dọn sạch ${delRes.rowCount} sản phẩm rác.`);

    // 5. Chuẩn hóa lại SKU, tên và hình ảnh cho toàn bộ 12 sản phẩm chính thức
    await client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT');

    const skuMap = [
      // Đồ gia dụng
      {
        oldSku: 'SP-001',
        newSku: 'GD-BINH-750',
        name: 'Bình nước inox 750ml',
        imageUrl: 'https://vn-test-11.slatic.net/p/561d54f9ce27f33e44c568b33a250146.png'
      },
      {
        oldSku: 'IMP-DEMO-BINH-001',
        newSku: 'GD-BINH-500',
        name: 'Bình giữ nhiệt inox 500ml',
        imageUrl: 'https://product.hstatic.net/200000574527/product/binh-giu-nhiet-inox-carlmann-bes523-g_8f13c758374f49ed91db9727a21034cf_1024x1024.jpg'
      },
      {
        oldSku: 'IMP-DEMO-LY-001',
        newSku: 'GD-LY-300',
        name: 'Bộ 6 ly thủy tinh 300ml',
        imageUrl: 'https://img.lazcdn.com/g/p/21c807a3de66d33b026844b70d6824e6.jpg_720x720q80.jpg'
      },

      // Thực phẩm đóng gói
      {
        oldSku: 'SP-002',
        newSku: 'TP-CAFE-500',
        name: 'Cà phê rang xay 500g',
        imageUrl: 'https://product.hstatic.net/1000288770/product/ca_phe_rang_xay_pha_phin_trung_nguyen_gourmet_blend_bo_2_goi_x_500g_37c3ae5eb0d4486ba90627ce12bf2f75.jpg'
      },
      {
        oldSku: 'IMP-DEMO-CAFE-001',
        newSku: 'TP-CAFE-250',
        name: 'Cà phê rang xay Arabica 250g',
        imageUrl: 'https://product.hstatic.net/200000662087/product/ca-phe-rang-goi-250g_arabica_02_6e257532ed1d416186ee848ea1613ee3_master.jpg'
      },

      // Đồ uống
      {
        oldSku: 'SP-003',
        newSku: 'DU-NUOC-500',
        name: 'Nước suối đóng chai 500ml',
        imageUrl: 'https://product.hstatic.net/1000301274/product/_10100995__nuoc_suoi_aquafina_500ml_chai_23249e397601447daa01bfa350fa66c1_1024x1024.png'
      },
      {
        oldSku: 'IMP-DEMO-NUOC-001',
        newSku: 'DU-KHOANG-500',
        name: 'Nước khoáng thiên nhiên 500ml',
        imageUrl: 'https://lzd-img-global.slatic.net/g/p/6969d418e3ddc466548c2aa4c28d0ab3.png_720x720q80.png'
      },
      {
        oldSku: 'IMP-DEMO-TRA-001',
        newSku: 'DU-TRA-OLONG',
        name: 'Trà ô long túi lọc hộp 20 gói',
        imageUrl: 'https://product.hstatic.net/1000284648/product/tra_o_long_tui_loc_phuc_long_c6383c20813747fc88bb9e10f0757a7f_1024x1024.png'
      },

      // Chăm sóc cá nhân
      {
        oldSku: 'UAT-20261113-001',
        newSku: 'CS-BAN-CHAI',
        name: 'Bàn chải đánh răng lông mềm',
        imageUrl: 'https://media.hasaki.vn/wysiwyg/minhchau/ban-chai-danh-rang-p-s-long-to-mem-mai-sieu-mem.jpg'
      },
      {
        oldSku: 'UAT-20261113-002',
        newSku: 'CS-KHAN-MAT',
        name: 'Khăn mặt cotton cao cấp 34x75cm',
        imageUrl: 'https://product.hstatic.net/1000165376/product/khan_mat_cotton_mb01_kem_the_gioi_khan_bong_0f5725e53ba24747b8f2c472bec65d54.jpg'
      },

      // Phụ kiện công nghệ
      {
        oldSku: 'UAT-20261113-003',
        newSku: 'CN-CAP-USBC',
        name: 'Cáp sạc USB-C bọc dù 1 mét',
        imageUrl: 'https://product.hstatic.net/200000348419/product/cap_sac_apple_usb_c_boc_du_0_39e8a6b3f7764a4aa138ab7c4a007127_master.png'
      },
      {
        oldSku: 'UAT-20261113-004',
        newSku: 'CN-GIA-DO',
        name: 'Giá đỡ điện thoại để bàn gấp gọn',
        imageUrl: 'https://product.hstatic.net/200000567141/product/ia-do-dien-thoai-ipad-de-ban-xep-gon-choetech-h88-bk-hang-chinh-hang-1_92bdb90a2c45487c86fc052da25acb78_master.jpg'
      },
    ];

    for (const item of skuMap) {
      await client.query(
        'UPDATE products SET sku = $1, name = $2, image_url = $3, is_active = true WHERE sku = $4 OR sku = $1',
        [item.newSku, item.name, item.imageUrl, item.oldSku]
      );
    }

    // 6. Cân đối lại reserved_quantity cho GD-BINH-750 (SP-001 cũ)
    const reservedCalc = await client.query(
      `SELECT COALESCE(SUM(oi.quantity), 0)::int as actual_reserved 
       FROM order_items oi 
       JOIN orders o ON o.id = oi.order_id 
       WHERE oi.product_id = $1 AND o.status IN ('pending', 'confirmed', 'ready_to_pack')`,
      [sp001Id]
    );
    const actualRes = reservedCalc.rows[0].actual_reserved;

    await client.query(
      `UPDATE inventory 
       SET reserved_quantity = $1, updated_at = NOW() 
       WHERE product_id = $2 AND warehouse_id = $3`,
      [actualRes, sp001Id, centralWhId]
    );

    await client.query('COMMIT');
    console.log('Toàn bộ danh mục & tồn kho sản phẩm đã chuẩn hóa THỐNG NHẤT 100%!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi khi chuẩn hóa:', err);
  } finally {
    client.release();
    process.exit(0);
  }
}

unifyAndClean();
