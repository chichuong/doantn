import { query, pool, closeDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import app from '../src/app.js';
import http from 'node:http';

async function main() {
  console.log('================================================================');
  console.log('  KIỂM THỬ TÍCH HỢP TOÀN DIỆN: KHO HÀNG & IOT ESP32-S3 QR VERIFY');
  console.log('================================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}/api/v1`;

  const request = async (method, url, { body, token, headers = {} } = {}) => {
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };
    if (token) reqHeaders['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${url}`, {
      method,
      headers: reqHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  };

  // 1. Đăng nhập các vai trò
  console.log('--- 1. XÁC THỰC VAI TRÒ ---');
  const whLogin = await request('POST', '/auth/login', {
    body: { email: 'warehouse@example.com', password: 'Warehouse@123' }
  });
  if (whLogin.status !== 200) throw new Error('Warehouse login failed');
  const whToken = whLogin.data.data.accessToken;
  console.log('✓ Nhân viên kho đăng nhập thành công (JWT Bearer)');

  const mgrLogin = await request('POST', '/auth/login', {
    body: { email: 'manager@example.com', password: 'Manager@123' }
  });
  if (mgrLogin.status !== 200) throw new Error('Manager login failed');
  const mgrToken = mgrLogin.data.data.accessToken;
  console.log('✓ Quản lý đăng nhập thành công (JWT Bearer)');

  // 2. Kiểm tra xác thực IoT bằng X-Device-Token
  console.log('\n--- 2. XÁC THỰC THIẾT BỊ IOT QUA X-Device-Token ---');
  const invalidIotRes = await request('GET', '/warehouse/documents', {
    headers: { 'X-Device-Token': 'wrong_invalid_token' }
  });
  if (invalidIotRes.status !== 401) {
    throw new Error(`Kỳ vọng 401 cho token sai, nhận được: ${invalidIotRes.status}`);
  }
  console.log('✓ Thiết bị IoT dùng token sai bị chặn đúng chuẩn (401)');

  const validIotRes = await request('GET', '/warehouse/documents', {
    headers: { 'X-Device-Token': env.iotDeviceToken }
  });
  if (validIotRes.status !== 200) {
    throw new Error(`Kỳ vọng 200 cho token đúng, nhận được: ${validIotRes.status}`);
  }
  console.log('✓ Thiết bị IoT dùng X-Device-Token hợp lệ truy cập thành công (200)');

  // 3. Quy trình tạo phiếu nhập kho & kiểm tra ràng buộc quét QR
  console.log('\n--- 3. QUY TRÌNH PHIẾU NHẬP KHO & RÀNG BUỘC QUÉT QR ---');
  const whRow = (await query("SELECT id FROM warehouses WHERE code = 'WH-HCM-01'")).rows[0];
  const prodRow = (await query("SELECT id, sku, barcode FROM products WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1")).rows[0];
  const initStock = (await query("SELECT quantity, reserved_quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2", [whRow.id, prodRow.id])).rows[0];
  console.log(`Tồn kho ban đầu của SP-001: ${initStock.quantity}`);

  const createRes = await request('POST', '/warehouse/documents', {
    token: whToken,
    body: {
      warehouseId: whRow.id,
      type: 'receipt',
      supplierName: 'Nha Cung Cap IoT Test',
      note: 'Nhap hang kiem thu IoT ESP32',
      items: [{ productId: prodRow.id, quantity: 20, unitCost: 100000 }]
    }
  });
  if (createRes.status !== 201) throw new Error('Create document failed');
  const createdDoc = createRes.data.data;
  console.log(`✓ Phiếu nhập kho được tạo: ${createdDoc.document_number}, trạng thái = ${createdDoc.status}`);

  // Thử hoàn tất khi chưa duyệt -> phải bị 409
  const unapprovedComplete = await request('POST', `/warehouse/documents/${createdDoc.id}/complete`, { token: whToken });
  if (unapprovedComplete.status !== 409) throw new Error('Expected 409 for unapproved document completion');
  console.log('✓ Phiếu chưa duyệt không thể hoàn tất (409)');

  // Manager duyệt phiếu -> sinh QR code
  const approveRes = await request('POST', `/manager/documents/${createdDoc.id}/approve`, { token: mgrToken });
  if (approveRes.status !== 200) throw new Error('Approve document failed');
  const approvedDoc = approveRes.data.data;
  console.log(`✓ Quản lý duyệt phiếu thành công: Trạng thái = ${approvedDoc.status}, Mã QR = ${approvedDoc.qr_code}`);

  // TEST QUAN TRỌNG: Gọi trực tiếp API complete khi chưa quét QR -> Backend BẮT BUỘC CHẶN 409
  console.log('\n--- 4. KIỂM THỬ BẢO VỆ BACKEND: CHƯA QUÉT QR THÌ KHÔNG THỂ HOÀN TẤT ---');
  const prematureComplete = await request('POST', `/warehouse/documents/${approvedDoc.id}/complete`, {
    token: whToken,
    body: { items: [{ productId: prodRow.id, actualQuantity: 20 }] }
  });
  if (prematureComplete.status !== 409) {
    throw new Error(`Kỳ vọng 409 khi chưa quét QR, nhận được: ${prematureComplete.status}`);
  }
  console.log(`✓ Backend từ chối hoàn tất khi chưa quét QR đối soát (409): "${prematureComplete.data.message}"`);

  // Quét mã không tồn tại -> 404, không mở khóa phiếu nào
  const fakeLookup = await request('GET', '/warehouse/documents/lookup/DOC:NK-FAKEDOC-999', {
    headers: { 'X-Device-Token': env.iotDeviceToken }
  });
  if (fakeLookup.status !== 404) throw new Error('Expected 404 for non-existent QR');
  console.log('✓ Mã QR không tồn tại bị từ chối 404 chuẩn xác');

  // 5. ESP32-S3 Camera quét QR phiếu thật
  console.log('\n--- 5. MÔ PHỎNG ESP32-S3 CAMERA QUÉT QR & GỌI API LOOKUP ---');
  const iotLookupRes = await request('GET', `/warehouse/documents/lookup?identifier=${encodeURIComponent(approvedDoc.qr_code)}`, {
    headers: { 'X-Device-Token': env.iotDeviceToken }
  });
  if (iotLookupRes.status !== 200) throw new Error('IoT QR lookup failed');
  const lookupData = iotLookupRes.data.data;
  console.log(`✓ ESP32-S3 gửi mã QR thành công, Backend nhận diện: ${lookupData.document_number}`);
  console.log(`  qr_scanned_at: ${lookupData.qr_scanned_at}, qr_scanned_source: ${lookupData.qr_scanned_source}`);
  if (!lookupData.qr_scanned_at || lookupData.qr_scanned_source !== 'esp32_s3_camera') {
    throw new Error('Lỗi: Backend không ghi nhận qr_scanned_at hoặc qr_scanned_source của ESP32');
  }

  // Flutter gọi getDocument -> kiểm tra có nhận được trạng thái đã quét hay không
  const flutterCheckDoc = await request('GET', `/warehouse/documents/${approvedDoc.id}`, { token: whToken });
  if (flutterCheckDoc.status !== 200 || !flutterCheckDoc.data.data.qr_scanned_at) {
    throw new Error('Flutter getDocument không thấy cờ qr_scanned_at');
  }
  console.log(`✓ Flutter gọi API lấy thông tin: Thấy cờ xác thực QR (${flutterCheckDoc.data.data.qr_scanned_source}) lúc ${flutterCheckDoc.data.data.qr_scanned_at}`);

  // 6. Hoàn tất nhận hàng và kiểm tra cập nhật tồn kho trong PostgreSQL
  console.log('\n--- 6. HOÀN TẤT PHIẾU VÀ ĐỐI CHIẾU DATABASE ---');
  const completeRes = await request('POST', `/warehouse/documents/${approvedDoc.id}/complete`, {
    token: whToken,
    body: {
      items: [{ productId: prodRow.id, actualQuantity: 20 }]
    }
  });
  if (completeRes.status !== 200) throw new Error('Complete document failed: ' + JSON.stringify(completeRes.data));
  console.log('✓ Nhân viên kho hoàn tất phiếu: Trạng thái = completed');

  const afterStock = (await query("SELECT quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2", [whRow.id, prodRow.id])).rows[0];
  const expectedStock = Number(initStock.quantity) + 20;
  if (Number(afterStock.quantity) !== expectedStock) {
    throw new Error(`Stock mismatch: Expected ${expectedStock}, got ${afterStock.quantity}`);
  }
  console.log(`✓ Tồn kho trong PostgreSQL cập nhật chính xác: ${initStock.quantity} -> ${afterStock.quantity} (+20)`);

  // Kiểm tra thẻ kho (inventory_transactions)
  const txRow = (await query(
    "SELECT type, quantity, reference_code FROM inventory_transactions WHERE reference_code = $1",
    [approvedDoc.document_number]
  )).rows[0];
  if (!txRow || txRow.type !== 'receipt' || Number(txRow.quantity) !== 20) {
    throw new Error('Thẻ kho (inventory_transactions) không khớp!');
  }
  console.log(`✓ Thẻ kho (inventory_transactions) ghi nhận chuẩn xác: Mã ${txRow.reference_code}, SL: ${txRow.quantity}`);

  // Thử hoàn tất lần 2 -> Idempotency không được tăng thêm tồn kho
  await request('POST', `/warehouse/documents/${approvedDoc.id}/complete`, { token: whToken });
  const finalStock = (await query("SELECT quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2", [whRow.id, prodRow.id])).rows[0];
  if (Number(finalStock.quantity) !== expectedStock) {
    throw new Error('Lỗi: Tồn kho bị nhân đôi khi hoàn tất lặp!');
  }
  console.log('✓ Idempotency bảo vệ thành công: Tồn kho không bị thay đổi lần 2');

  // 7. KIỂM THỬ PHIẾU XUẤT KHO (ISSUE)
  console.log('\n--- 7. KIỂM THỬ LUỒNG PHIẾU XUẤT KHO (ISSUE) ---');
  const createOutRes = await request('POST', '/warehouse/documents', {
    token: whToken,
    body: {
      warehouseId: whRow.id,
      type: 'issue',
      note: 'Xuat hang kiem thu IoT',
      items: [{ productId: prodRow.id, quantity: 5, unitCost: 100000 }]
    }
  });
  if (createOutRes.status !== 201) throw new Error('Create issue document failed');
  const outDoc = createOutRes.data.data;
  console.log(`✓ Phiếu xuất kho được tạo: ${outDoc.document_number}`);

  // Manager duyệt phiếu xuất
  const approveOutRes = await request('POST', `/manager/documents/${outDoc.id}/approve`, { token: mgrToken });
  const approvedOutDoc = approveOutRes.data.data;
  console.log(`✓ Phiếu xuất được duyệt: ${approvedOutDoc.qr_code}`);

  // Thử hoàn tất phiếu xuất khi chưa quét QR -> phải bị 409
  const prematureOutComplete = await request('POST', `/warehouse/documents/${approvedOutDoc.id}/complete`, { token: whToken });
  if (prematureOutComplete.status !== 409) throw new Error('Expected 409 for premature issue complete');
  console.log('✓ Phiếu xuất chưa quét QR bị chặn hoàn tất (409)');

  // Quét QR phiếu xuất qua ESP32
  const scanOutRes = await request('GET', `/warehouse/documents/lookup/${encodeURIComponent(approvedOutDoc.qr_code)}`, {
    headers: { 'X-Device-Token': env.iotDeviceToken }
  });
  if (scanOutRes.status !== 200 || !scanOutRes.data.data.qr_scanned_at) {
    throw new Error('Scan issue QR failed');
  }
  console.log('✓ ESP32 quét QR phiếu xuất thành công, ghi nhận vết quét');

  // Hoàn tất xuất kho 5 sản phẩm
  const completeOutRes = await request('POST', `/warehouse/documents/${approvedOutDoc.id}/complete`, {
    token: whToken,
    body: { items: [{ productId: prodRow.id, actualQuantity: 5 }] }
  });
  if (completeOutRes.status !== 200) throw new Error('Complete issue failed');
  console.log('✓ Hoàn tất xuất kho thành công');

  const stockAfterOut = (await query("SELECT quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2", [whRow.id, prodRow.id])).rows[0];
  const expectedOutStock = expectedStock - 5;
  if (Number(stockAfterOut.quantity) !== expectedOutStock) {
    throw new Error(`Issue stock mismatch: Expected ${expectedOutStock}, got ${stockAfterOut.quantity}`);
  }
  console.log(`✓ Tồn kho xuất trừ chuẩn xác: ${expectedStock} -> ${stockAfterOut.quantity} (-5)`);

  console.log('\n================================================================');
  console.log('🎉 TẤT CẢ CÁC BÀI KIỂM THỬ TÍCH HỢP ĐỀU VƯỢT QUA 100%! 🎉');
  console.log('================================================================');

  server.close();
  await closeDatabase();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('\n❌ BÀI KIỂM THỬ THẤT BẠI:', err);
  await closeDatabase();
  process.exit(1);
});
