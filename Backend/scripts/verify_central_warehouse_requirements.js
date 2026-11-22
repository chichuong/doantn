import { pool, query, closeDatabase } from '../src/config/database.js';
import { getCentralWarehouse, getCentralWarehouseId } from '../src/services/central-warehouse.service.js';
import * as customerService from '../src/services/customer.service.js';
import * as posService from '../src/services/pos.service.js';
import * as warehouseService from '../src/services/warehouse.service.js';
import * as managerService from '../src/services/manager.service.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== BẮT ĐẦU KIỂM THỬ HỆ THỐNG MỘT KHO TRUNG TÂM KARAT RETAIL ===\n');

  try {
    // ------------------------------------------------------------------------
    // Case 12: Migration/seed an toàn, không tạo nhiều kho trung tâm trùng nhau
    // ------------------------------------------------------------------------
    console.log('Test 12: Kiểm tra kho trung tâm duy nhất và migration an toàn...');
    const centralWh = await getCentralWarehouse();
    assert(centralWh && centralWh.code === 'WH-HCM-01', `Kho trung tâm xác định: ${centralWh?.name} (${centralWh?.code})`);

    const activeWhRes = await query(`SELECT COUNT(*)::int AS count FROM warehouses WHERE is_active = TRUE`);
    assert(activeWhRes.rows[0].count === 1, `Chỉ có đúng 1 kho active trong toàn hệ thống (hiện tại: ${activeWhRes.rows[0].count})`);

    const centralWhId = await getCentralWarehouseId();
    assert(centralWhId === centralWh.id, `centralWarehouseId khớp id kho trung tâm (${centralWhId})`);

    // Lấy 1 user khách hàng mẫu và 1 user nhân viên
    const custUser = (await query(`SELECT u.id, u.email FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code = 'customer' LIMIT 1`)).rows[0];
    const staffUser = (await query(`SELECT u.id, u.email FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code = 'warehouse' LIMIT 1`)).rows[0];
    const adminUser = (await query(`SELECT u.id, u.email FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code = 'admin' LIMIT 1`)).rows[0];

    assert(custUser, `Có tài khoản Customer để test: ${custUser?.email}`);
    assert(staffUser, `Có tài khoản Warehouse để test: ${staffUser?.email}`);
    assert(adminUser, `Có tài khoản Admin để test: ${adminUser?.email}`);

    // Lấy 1 sản phẩm mẫu
    const prod = (await query(`SELECT id, sku, name, sale_price FROM products WHERE is_active = TRUE LIMIT 1`)).rows[0];
    assert(prod, `Có sản phẩm mẫu: ${prod?.name} (${prod?.sku})`);

    // Đảm bảo có tồn kho ban đầu cho sản phẩm tại kho trung tâm
    await query(`
      MERGE INTO inventory AS target
      USING (SELECT $1 AS warehouse_id, $2 AS product_id) AS source
      ON target.warehouse_id = source.warehouse_id AND target.product_id = source.product_id
      WHEN MATCHED THEN UPDATE SET quantity = GREATEST(target.quantity, 50), updated_at = NOW()
      WHEN NOT MATCHED THEN INSERT (warehouse_id, product_id, quantity, reserved_quantity, updated_at) VALUES (source.warehouse_id, source.product_id, 50, 0, NOW());
    `, [centralWhId, prod.id]);

    // ------------------------------------------------------------------------
    // Case 3: Customer xem đúng giá bán và tồn kho từ kho trung tâm
    // ------------------------------------------------------------------------
    console.log('\nTest 3: Customer xem danh mục sản phẩm, giá bán và tồn kho...');
    const catalog = await customerService.catalog({ search: prod.sku, limit: 5 });
    const catProd = catalog.data.find(p => p.id === prod.id);
    assert(catProd, `Tìm thấy sản phẩm trong Catalog`);
    assert(Number(catProd.sale_price) === Number(prod.sale_price), `Giá bán hiển thị đúng giá thực tế: ${catProd?.sale_price}`);
    assert(Number(catProd.available_quantity) >= 50, `Tồn kho khả dụng phản ánh đúng kho trung tâm: ${catProd?.available_quantity}`);

    // ------------------------------------------------------------------------
    // Case 1 & 2: Customer đặt hàng KHÔNG gửi warehouseId -> Tự động gắn kho trung tâm
    // ------------------------------------------------------------------------
    console.log('\nTest 1 & 2: Customer đặt hàng mà KHÔNG gửi warehouseId...');
    // Dọn giỏ hàng cũ nếu có trước khi test
    await query(`DELETE FROM cart_items ci USING carts c WHERE ci.cart_id = c.id AND c.user_id = $1`, [custUser.id]);
    // Cho sản phẩm vào giỏ hàng
    await customerService.addCartItem(custUser.id, { productId: prod.id, quantity: 2 });
    // Checkout KHÔNG gửi warehouseId
    const orderCreated = await customerService.createOrder(custUser.id, {
      customerName: 'Khách hàng Test Online',
      customerPhone: '0901234567',
      note: 'Test đơn không gửi warehouseId',
      channel: 'mobile'
    });
    assert(orderCreated && orderCreated.id, `Đơn hàng tạo thành công: ${orderCreated?.order_number}`);
    assert(orderCreated.warehouse_id === centralWhId, `Đơn hàng tự động gắn với kho trung tâm WH-HCM-01 (${orderCreated.warehouse_id})`);

    // ------------------------------------------------------------------------
    // Case 4: POS bán hàng làm thay đổi tồn kho tại kho trung tâm
    // ------------------------------------------------------------------------
    console.log('\nTest 4: Bán hàng tại quầy POS cập nhật tồn kho trung tâm...');
    // Lấy tồn kho trước POS
    const stockBeforePos = (await query(`SELECT quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2`, [centralWhId, prod.id])).rows[0].quantity;
    // Mở ca POS
    let posSession;
    try {
      posSession = await posService.open({ openingCash: 100000 }, adminUser.id);
    } catch (e) {
      posSession = await posService.currentSession(adminUser.id);
    }
    assert(posSession && posSession.warehouse_id === centralWhId, `Ca POS mở tại kho trung tâm (${posSession?.warehouse_id})`);

    // Thực hiện bán hàng POS
    const saleResult = await posService.create({
      sessionId: posSession.id,
      paymentMethod: 'cash',
      items: [{ productId: prod.id, quantity: 1 }]
    }, adminUser.id);
    assert(saleResult && saleResult.id, `Giao dịch POS thành công: ${saleResult?.order_number}`);

    const stockAfterPos = (await query(`SELECT quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2`, [centralWhId, prod.id])).rows[0].quantity;
    assert(stockAfterPos === stockBeforePos - 1, `Tồn kho trung tâm đã giảm đúng 1 sản phẩm sau POS (${stockBeforePos} -> ${stockAfterPos})`);

    // Đóng ca POS
    await posService.close(posSession.id, { closingCash: 100000 }, adminUser.id);

    // ------------------------------------------------------------------------
    // Case 5: Phiếu nhập kho được duyệt nhưng chưa hoàn tất thì CHƯA tăng tồn kho
    // ------------------------------------------------------------------------
    console.log('\nTest 5: Tạo và duyệt phiếu nhập kho (chưa hoàn tất -> tồn kho không đổi)...');
    const stockBeforeDoc = (await query(`SELECT quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2`, [centralWhId, prod.id])).rows[0].quantity;

    const receiptDoc = await warehouseService.createWarehouseDocument({
      type: 'receipt',
      supplierName: 'Nhà cung cấp Vàng Bạc Đá Quý',
      note: 'Phiếu nhập kiểm thử',
      items: [{ productId: prod.id, quantity: 10, unitCost: 100000 }]
    }, staffUser.id);
    assert(receiptDoc && receiptDoc.status === 'pending', `Phiếu nhập tạo thành công, status: ${receiptDoc?.status}`);
    assert(receiptDoc.warehouse_id === centralWhId, `Phiếu nhập tự động gắn với kho trung tâm`);

    // Admin duyệt phiếu
    const approvedDoc = await warehouseService.approve(receiptDoc.id, adminUser.id, 'admin');
    assert(approvedDoc.status === 'approved', `Phiếu nhập đã được phê duyệt, status: ${approvedDoc.status}`);
    assert(approvedDoc.qr_code && approvedDoc.qr_code.startsWith('DOC:'), `Phiếu đã được sinh mã QR: ${approvedDoc.qr_code}`);

    const stockAfterApprove = (await query(`SELECT quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2`, [centralWhId, prod.id])).rows[0].quantity;
    assert(stockAfterApprove === stockBeforeDoc, `Tồn kho KHÔNG ĐỔI sau khi duyệt phiếu (${stockBeforeDoc} == ${stockAfterApprove})`);

    // ------------------------------------------------------------------------
    // Case 6: Quét QR chỉ đối soát, KHÔNG tự động cộng tồn kho
    // ------------------------------------------------------------------------
    console.log('\nTest 6: Quét QR đối soát thiết bị IoT / App kho...');
    const scannedDoc = await warehouseService.recordQrScan(approvedDoc.id, staffUser.id, 'esp32_s3_camera');
    assert(scannedDoc.qr_scanned_at !== null, `Đã ghi nhận thời gian quét QR: ${scannedDoc.qr_scanned_at}`);
    assert(scannedDoc.status === 'approved', `Trạng thái phiếu vẫn là approved, chưa completed`);

    const stockAfterQr = (await query(`SELECT quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2`, [centralWhId, prod.id])).rows[0].quantity;
    assert(stockAfterQr === stockBeforeDoc, `Tồn kho KHÔNG ĐỔI sau khi quét QR (${stockBeforeDoc} == ${stockAfterQr})`);

    // ------------------------------------------------------------------------
    // Case 7: Hoàn tất phiếu nhập kho cập nhật tồn kho đúng MỘT LẦN (Idempotent)
    // ------------------------------------------------------------------------
    console.log('\nTest 7: Hoàn tất phiếu nhập kho và kiểm tra idempotent...');
    const completedReceipt = await warehouseService.complete(approvedDoc.id, staffUser.id, {
      actualItems: [{ productId: prod.id, actualQuantity: 10 }]
    });
    assert(completedReceipt.status === 'completed', `Phiếu nhập đã hoàn tất, status: ${completedReceipt.status}`);

    const stockAfterComplete = (await query(`SELECT quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2`, [centralWhId, prod.id])).rows[0].quantity;
    assert(stockAfterComplete === stockBeforeDoc + 10, `Tồn kho trung tâm TĂNG ĐÚNG 10 sản phẩm (${stockBeforeDoc} -> ${stockAfterComplete})`);

    // Thử gọi lại complete lần 2 trên cùng phiếu
    await warehouseService.complete(approvedDoc.id, staffUser.id, {
      actualItems: [{ productId: prod.id, actualQuantity: 10 }]
    });
    const stockAfterRepeat = (await query(`SELECT quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2`, [centralWhId, prod.id])).rows[0].quantity;
    assert(stockAfterRepeat === stockAfterComplete, `Gọi hoàn tất lần 2 KHÔNG làm tăng tồn kho lần nữa (${stockAfterRepeat} == ${stockAfterComplete})`);

    // ------------------------------------------------------------------------
    // Case 8: Phiếu xuất kho trừ tồn kho đúng một lần
    // ------------------------------------------------------------------------
    console.log('\nTest 8: Phiếu xuất kho và trừ tồn kho...');
    const issueDoc = await warehouseService.createWarehouseDocument({
      type: 'issue',
      note: 'Phiếu xuất kiểm thử',
      items: [{ productId: prod.id, quantity: 5, unitCost: 100000 }]
    }, staffUser.id);
    await warehouseService.approve(issueDoc.id, adminUser.id, 'admin');
    await warehouseService.recordQrScan(issueDoc.id, staffUser.id, 'mobile_app');

    const stockBeforeIssueComplete = (await query(`SELECT quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2`, [centralWhId, prod.id])).rows[0].quantity;
    await warehouseService.complete(issueDoc.id, staffUser.id, {
      actualItems: [{ productId: prod.id, actualQuantity: 5 }]
    });
    const stockAfterIssueComplete = (await query(`SELECT quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2`, [centralWhId, prod.id])).rows[0].quantity;
    assert(stockAfterIssueComplete === stockBeforeIssueComplete - 5, `Tồn kho trung tâm ĐÃ GIẢM ĐÚNG 5 sản phẩm (${stockBeforeIssueComplete} -> ${stockAfterIssueComplete})`);

    // ------------------------------------------------------------------------
    // Case 9: Ngăn hoàn tất phiếu không hợp lệ hoặc xuất vượt số lượng duyệt
    // ------------------------------------------------------------------------
    console.log('\nTest 9: Ngăn hoàn tất phiếu không hợp lệ hoặc vượt quyền...');
    let rejectedAsExpected = false;
    try {
      // Tạo phiếu xuất số lượng 3 nhưng cố hoàn tất xuất 99
      const overIssueDoc = await warehouseService.createWarehouseDocument({
        type: 'issue',
        items: [{ productId: prod.id, quantity: 3, unitCost: 100000 }]
      }, staffUser.id);
      await warehouseService.approve(overIssueDoc.id, adminUser.id, 'admin');
      await warehouseService.recordQrScan(overIssueDoc.id, staffUser.id, 'mobile_app');
      await warehouseService.complete(overIssueDoc.id, staffUser.id, {
        actualItems: [{ productId: prod.id, actualQuantity: 99 }]
      });
    } catch (e) {
      rejectedAsExpected = true;
    }
    assert(rejectedAsExpected, `Đã ngăn chặn thành công việc xuất vượt số lượng duyệt`);

    // ------------------------------------------------------------------------
    // Case 10 & 11: Customer, Warehouse, Shipper và tính nhất quán dữ liệu
    // ------------------------------------------------------------------------
    console.log('\nTest 10 & 11: Kiểm tra tính nhất quán và hoạt động đa vai trò...');
    const invWarehouse = await warehouseService.inventory({});
    assert(invWarehouse.data.length > 0, `Nhân viên kho tra cứu được tồn kho trung tâm (${invWarehouse.data.length} dòng)`);

    const customerCatalog = await customerService.catalog({ limit: 10 });
    assert(customerCatalog.data.length > 0, `Customer tra cứu được danh mục (${customerCatalog.data.length} sản phẩm)`);

    console.log('\n======================================================');
    console.log(`KẾT QUẢ KIỂM THỬ: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');

    if (failed > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('LỖI KIỂM THỬ KHÔNG MONG MUỐN:', err);
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

runTests();
