import { pool, query, closeDatabase } from '../src/config/database.js';
import { getCentralWarehouse, getCentralWarehouseId } from '../src/services/central-warehouse.service.js';
import * as customerService from '../src/services/customer.service.js';
import * as posService from '../src/services/pos.service.js';
import * as warehouseService from '../src/services/warehouse.service.js';
import * as orderProcessingService from '../src/services/order-processing.service.js';
import * as shippingService from '../src/services/shipping.service.js';
import * as warehouseWorkflowService from '../src/services/warehouse-workflow.service.js';
import { ORDER_STATUS } from '../src/domain/order-state-machine.js';
import crypto from 'crypto';

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
  console.log('================================================================');
  console.log('  KIỂM THỬ TOÀN DIỆN LUỒNG ĐẶT HÀNG FLUTTER CUSTOMER (18 CASES)');
  console.log('================================================================\n');

  try {
    const centralWh = await getCentralWarehouse();
    const centralWhId = await getCentralWarehouseId();
    console.log(`Kho trung tâm hệ thống: ${centralWh.name} (${centralWh.code}) - ID: ${centralWhId}\n`);

    // Lấy 2 user customer để test phân quyền IDOR
    const customers = (await query(`
      SELECT u.id, u.email FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE r.code = 'customer'
      ORDER BY u.created_at ASC
      LIMIT 2
    `)).rows;

    if (customers.length < 2) {
      // Tạo thêm 1 customer nếu mới có 1
      await query(`
        IF NOT EXISTS (SELECT 1 FROM users WHERE email = 'customer2@example.com')
        INSERT INTO users (email, password_hash, full_name, status, role_id)
        SELECT 'customer2@example.com', '$2a$12$FZxw2YiL8k47bnZdwptdA./rCWnU8MbGRooyBDFKXx08355SpXjuq', 'Customer Test 2', 'active', r.id
        FROM roles r WHERE r.code = 'customer';
        UPDATE users SET status = 'active' WHERE email = 'customer2@example.com';
      `);
      const newCust = await query(`SELECT id, email FROM users WHERE email = 'customer2@example.com'`);
      customers.push(newCust.rows[0]);
    }

    const customerA = customers[0];
    const customerB = customers[1];
    const staffUser = (await query(`SELECT u.id, u.email, r.code as role_code FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code = 'warehouse' LIMIT 1`)).rows[0];
    const processorUser = (await query(`SELECT u.id, u.email, r.code as role_code FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code = 'order_processor' LIMIT 1`)).rows[0];
    const shipperUser = (await query(`SELECT u.id, u.email, r.code as role_code FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code = 'shipper' LIMIT 1`)).rows[0];
    const adminUser = (await query(`SELECT u.id, u.email, r.code as role_code FROM users u JOIN roles r ON r.id = u.role_id WHERE r.code = 'admin' LIMIT 1`)).rows[0];

    // Lấy sản phẩm test
    const prod = (await query(`SELECT id, sku, barcode, name, sale_price FROM products WHERE is_active = TRUE ORDER BY created_at ASC LIMIT 1`)).rows[0];
    assert(prod, `Sản phẩm kiểm thử: ${prod.name} (${prod.sku}) - Giá bán thẩm quyền: ${prod.sale_price}`);

    // Đảm bảo tồn kho ban đầu cho sản phẩm tại kho trung tâm
    await query(`
      MERGE INTO inventory AS target
      USING (SELECT $1 AS warehouse_id, $2 AS product_id) AS source
      ON target.warehouse_id = source.warehouse_id AND target.product_id = source.product_id
      WHEN MATCHED THEN UPDATE SET quantity = GREATEST(target.quantity, 100), updated_at = NOW()
      WHEN NOT MATCHED THEN INSERT (warehouse_id, product_id, quantity, reserved_quantity, updated_at) VALUES (source.warehouse_id, source.product_id, 100, 0, NOW());
    `, [centralWhId, prod.id]);

    // Đảm bảo customerA có ít nhất 1 địa chỉ hợp lệ
    let addr = (await query(`SELECT id, address_line FROM customer_addresses WHERE user_id = $1 LIMIT 1`, [customerA.id])).rows[0];
    if (!addr) {
      addr = await customerService.addAddress(customerA.id, {
        recipientName: 'Nguyen Van A',
        phone: '0988123456',
        addressLine: '123 Nguyen Trai, Q5',
        province: 'TP Ho Chi Minh',
        isDefault: true
      });
    }

    // ------------------------------------------------------------------------
    // CASE 1: Lấy danh sách sản phẩm (Catalog)
    // ------------------------------------------------------------------------
    console.log('\n--- Case 1: Lấy danh sách sản phẩm ---');
    const catalog = await customerService.catalog({ search: prod.sku, limit: 10 });
    const found = catalog.data.find(p => p.id === prod.id);
    assert(found, `Tìm thấy sản phẩm ${prod.sku} trong Catalog`);
    assert(Number(found.sale_price) === Number(prod.sale_price), `Giá bán trong catalog khớp giá DB: ${found.sale_price}`);
    assert(Number(found.available_quantity) > 0, `Tồn kho khả dụng > 0 (${found.available_quantity})`);

    // ------------------------------------------------------------------------
    // CASE 2: Thêm sản phẩm vào giỏ hàng
    // ------------------------------------------------------------------------
    console.log('\n--- Case 2: Thêm sản phẩm vào giỏ hàng ---');
    await query(`DELETE FROM cart_items ci USING carts c WHERE ci.cart_id = c.id AND c.user_id = $1`, [customerA.id]);
    await customerService.addCartItem(customerA.id, { productId: prod.id, quantity: 2 });
    let cart = await customerService.cart(customerA.id);
    let itemInCart = cart.items.find(i => i.product_id === prod.id);
    assert(itemInCart && Number(itemInCart.quantity) === 2, `Sản phẩm đã thêm vào giỏ với số lượng: ${itemInCart?.quantity}`);

    // ------------------------------------------------------------------------
    // CASE 3: Tăng và giảm số lượng trong giỏ
    // ------------------------------------------------------------------------
    console.log('\n--- Case 3: Tăng và giảm số lượng trong giỏ hàng ---');
    // Tăng lên 5
    await customerService.addCartItem(customerA.id, { productId: prod.id, quantity: 5 });
    cart = await customerService.cart(customerA.id);
    itemInCart = cart.items.find(i => i.product_id === prod.id);
    assert(Number(itemInCart.quantity) === 5, `Tăng số lượng thành 5 thành công`);
    // Giảm xuống 3
    await customerService.addCartItem(customerA.id, { productId: prod.id, quantity: 3 });
    cart = await customerService.cart(customerA.id);
    itemInCart = cart.items.find(i => i.product_id === prod.id);
    assert(Number(itemInCart.quantity) === 3, `Giảm số lượng về 3 thành công`);

    // ------------------------------------------------------------------------
    // CASE 4: Xóa sản phẩm khỏi giỏ hàng
    // ------------------------------------------------------------------------
    console.log('\n--- Case 4: Xóa sản phẩm khỏi giỏ hàng ---');
    await customerService.deleteCartItem(customerA.id, prod.id);
    cart = await customerService.cart(customerA.id);
    itemInCart = cart.items.find(i => i.product_id === prod.id);
    assert(!itemInCart, `Sản phẩm đã được xóa khỏi giỏ hàng`);

    // Thêm lại 2 sản phẩm để chuẩn bị đặt hàng
    await customerService.addCartItem(customerA.id, { productId: prod.id, quantity: 2 });

    // ------------------------------------------------------------------------
    // CASE 5 & 6: Đặt hàng KHÔNG gửi warehouseId & Đơn gắn kho trung tâm
    // ------------------------------------------------------------------------
    console.log('\n--- Case 5 & 6: Đặt hàng không gửi warehouseId & Gắn kho trung tâm ---');
    const orderCreated = await customerService.createOrder(customerA.id, {
      addressId: addr.id,
      customerName: 'Nguyen Van A',
      customerPhone: '0988123456',
      note: 'Giao giờ hành chính',
      channel: 'mobile'
      // HOÀN TOÀN KHÔNG TRUYỀN warehouseId
    });
    assert(orderCreated && orderCreated.id, `Đơn hàng tạo thành công: ${orderCreated.order_number}`);
    assert(orderCreated.warehouse_id === centralWhId, `Đơn hàng tự động gắn với kho trung tâm WH-HCM-01 (${orderCreated.warehouse_id})`);
    assert(orderCreated.channel === 'mobile', `Kênh đặt hàng ghi nhận đúng: ${orderCreated.channel}`);

    // ------------------------------------------------------------------------
    // CASE 7: Giá và tổng tiền được Backend tính thẩm quyền chính xác
    // ------------------------------------------------------------------------
    console.log('\n--- Case 7: Giá và tổng tiền được Backend tính chính xác ---');
    const expectedTotal = Number(prod.sale_price) * 2;
    assert(Number(orderCreated.total_amount) === expectedTotal, `Tổng tiền Backend tính thẩm quyền: ${orderCreated.total_amount} (kỳ vọng: ${expectedTotal})`);

    // ------------------------------------------------------------------------
    // CASE 8: Đặt hàng vượt tồn kho khả dụng bị từ chối
    // ------------------------------------------------------------------------
    console.log('\n--- Case 8: Đặt hàng với số lượng vượt tồn kho bị từ chối ---');
    let overStockRejected = false;
    try {
      await customerService.addCartItem(customerA.id, { productId: prod.id, quantity: 999999 });
      await customerService.createOrder(customerA.id, { addressId: addr.id, channel: 'mobile' });
    } catch (e) {
      overStockRejected = (e.statusCode === 409 || e.code === 'INSUFFICIENT_STOCK');
    }
    assert(overStockRejected, `Backend từ chối đặt hàng khi số lượng vượt tồn khả dụng (409 INSUFFICIENT_STOCK)`);

    // ------------------------------------------------------------------------
    // CASE 9: Đặt hàng với sản phẩm không tồn tại / ngừng bán bị từ chối
    // ------------------------------------------------------------------------
    console.log('\n--- Case 9: Đặt hàng với sản phẩm không tồn tại bị từ chối ---');
    let invalidProductRejected = false;
    try {
      await customerService.addCartItem(customerA.id, { productId: '00000000-0000-0000-0000-000000000000', quantity: 1 });
    } catch (e) {
      invalidProductRejected = (e.statusCode === 404 || e.statusCode === 400);
    }
    assert(invalidProductRejected, `Backend từ chối khi thêm sản phẩm không tồn tại vào giỏ`);

    // ------------------------------------------------------------------------
    // CASE 10: Đặt hàng với địa chỉ không thuộc người dùng bị từ chối
    // ------------------------------------------------------------------------
    console.log('\n--- Case 10: Đặt hàng với địa chỉ của người khác bị từ chối ---');
    // Tạo địa chỉ của Customer B
    const addrB = await customerService.addAddress(customerB.id, {
      recipientName: 'Customer B',
      phone: '0977111222',
      addressLine: '456 Hai Ba Trung',
      province: 'TP Ho Chi Minh'
    });
    let addressHijackRejected = false;
    try {
      await customerService.addCartItem(customerA.id, { productId: prod.id, quantity: 1 });
      // Customer A cố dùng địa chỉ của Customer B
      await customerService.createOrder(customerA.id, { addressId: addrB.id, channel: 'mobile' });
    } catch (e) {
      addressHijackRejected = (e.statusCode === 400 || e.code === 'ADDRESS_NOT_FOUND');
    }
    assert(addressHijackRejected, `Backend chặn Customer A dùng địa chỉ của Customer B (400 ADDRESS_NOT_FOUND)`);

    // ------------------------------------------------------------------------
    // CASE 11: Hai request đặt hàng đồng thời không làm bán vượt tồn kho (Race Condition)
    // ------------------------------------------------------------------------
    console.log('\n--- Case 11: Kiểm thử Race Condition / 2 request đồng thời ---');
    // Tạo sản phẩm riêng chỉ có đúng 1 tồn kho duy nhất
    const limitedProdRes = await query(`
      INSERT INTO products (sku, barcode, name, sale_price, cost_price, is_active)
      VALUES ('LIMITED-RACE-' || floor(random()*10000), 'BAR-' || floor(random()*10000), 'Sản phẩm số lượng giới hạn', 200000, 150000, TRUE)
      RETURNING id, sku, sale_price
    `);
    const limProd = limitedProdRes.rows[0];
    await query(`INSERT INTO inventory (warehouse_id, product_id, quantity, reserved_quantity) VALUES ($1, $2, 1, 0)`, [centralWhId, limProd.id]);

    // Cho 1 cái vào giỏ Customer A và 1 cái vào giỏ Customer B
    await query(`DELETE FROM cart_items ci USING carts c WHERE ci.cart_id = c.id AND c.user_id = $1`, [customerA.id]);
    await query(`DELETE FROM cart_items ci USING carts c WHERE ci.cart_id = c.id AND c.user_id = $1`, [customerB.id]);
    await customerService.addCartItem(customerA.id, { productId: limProd.id, quantity: 1 });
    await customerService.addCartItem(customerB.id, { productId: limProd.id, quantity: 1 });

    // Cả 2 đặt hàng đồng thời cùng 1 mili-giây
    const results = await Promise.allSettled([
      customerService.createOrder(customerA.id, { addressId: addr.id, channel: 'mobile' }),
      customerService.createOrder(customerB.id, { addressId: addrB.id, channel: 'mobile' })
    ]);

    const successes = results.filter(r => r.status === 'fulfilled');
    const rejects = results.filter(r => r.status === 'rejected');
    assert(successes.length === 1, `Chỉ có đúng 1 request thành công (kết quả: ${successes.length})`);
    assert(rejects.length === 1, `1 request còn lại bị từ chối do hết tồn kho khả dụng`);

    const limStock = (await query(`SELECT quantity, reserved_quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2`, [centralWhId, limProd.id])).rows[0];
    assert(limStock.quantity === 1 && limStock.reserved_quantity === 1, `Tồn kho không bao giờ bị âm: quantity=1, reserved=1`);

    // ------------------------------------------------------------------------
    // CASE 12: Nhấn đặt hàng nhiều lần không tạo đơn trùng (Idempotency)
    // ------------------------------------------------------------------------
    console.log('\n--- Case 12: Idempotency Key chống tạo đơn trùng lặp ---');
    await customerService.addCartItem(customerA.id, { productId: prod.id, quantity: 1 });
    const idemKey = `IDEM-TEST-${Date.now()}`;
    // Gọi lần 1
    const order1 = await customerService.createOrder(customerA.id, { addressId: addr.id, channel: 'mobile' }, idemKey);
    // Gọi lần 2 với cùng idemKey
    const order2 = await customerService.createOrder(customerA.id, { addressId: addr.id, channel: 'mobile' }, idemKey);
    assert(order1.id === order2.id, `Gửi lại cùng Idempotency-Key trả về cùng đơn hàng cũ (${order1.order_number} == ${order2.order_number})`);

    // ------------------------------------------------------------------------
    // CASE 13: Đơn hàng được lưu đầy đủ trong PostgreSQL
    // ------------------------------------------------------------------------
    console.log('\n--- Case 13: Kiểm tra tính toàn vẹn dữ liệu đơn hàng trong PostgreSQL ---');
    const dbOrder = (await query(`SELECT * FROM orders WHERE id = $1`, [orderCreated.id])).rows[0];
    const dbItems = (await query(`SELECT * FROM order_items WHERE order_id = $1`, [orderCreated.id])).rows;
    const dbReservations = (await query(`SELECT * FROM inventory_reservations r JOIN order_items oi ON oi.id = r.order_item_id WHERE oi.order_id = $1`, [orderCreated.id])).rows;
    const dbStatusHistory = (await query(`SELECT * FROM order_status_history WHERE order_id = $1`, [orderCreated.id])).rows;

    assert(dbOrder && dbOrder.status === 'pending', `Đơn lưu trong bảng orders với status = 'pending'`);
    assert(dbItems.length === 1 && Number(dbItems[0].quantity) === 2, `Bảng order_items lưu đúng sản phẩm và số lượng`);
    assert(dbReservations.length === 1 && dbReservations[0].status === 'active', `Bảng inventory_reservations có dòng giữ chỗ active`);
    assert(dbStatusHistory.length >= 1, `Bảng order_status_history ghi nhận lịch sử tạo đơn`);

    // ------------------------------------------------------------------------
    // CASE 14: Customer xem được đơn hàng vừa tạo (List & Detail)
    // ------------------------------------------------------------------------
    console.log('\n--- Case 14: Customer xem danh sách và chi tiết đơn hàng ---');
    const myOrders = await customerService.orders(customerA.id, {});
    const myOrderInList = myOrders.data.find(o => o.id === orderCreated.id);
    assert(myOrderInList, `Đơn hàng xuất hiện trong danh sách đơn của Customer A`);

    const orderDetail = await customerService.orderDetail(customerA.id, orderCreated.id);
    assert(orderDetail && orderDetail.items.length > 0, `Xem chi tiết đơn hàng thành công, có danh sách sản phẩm`);

    // ------------------------------------------------------------------------
    // CASE 15: Phân quyền IDOR - Customer B không thể xem đơn của Customer A
    // ------------------------------------------------------------------------
    console.log('\n--- Case 15: Customer B không thể xem đơn của Customer A (Chống IDOR) ---');
    let idorBlocked = false;
    try {
      await customerService.orderDetail(customerB.id, orderCreated.id);
    } catch (e) {
      idorBlocked = (e.statusCode === 404);
    }
    assert(idorBlocked, `Customer B bị từ chối 404 khi cố truy cập đơn hàng của Customer A`);

    // ------------------------------------------------------------------------
    // CASE 16: Hủy đơn tuân thủ quy tắc trạng thái và giải phóng tồn kho
    // ------------------------------------------------------------------------
    console.log('\n--- Case 16: Hủy đơn hàng và giải phóng tồn kho ---');
    // Kiểm tra reserved_quantity trước khi hủy
    const reservedBeforeCancel = (await query(`SELECT reserved_quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2`, [centralWhId, prod.id])).rows[0].reserved_quantity;
    await customerService.cancel(customerA.id, orderCreated.id, 'Khách hàng đổi ý');
    const cancelledOrder = await customerService.orderDetail(customerA.id, orderCreated.id);
    assert(cancelledOrder.status === 'cancelled', `Trạng thái đơn đã chuyển sang 'cancelled'`);

    const reservedAfterCancel = (await query(`SELECT reserved_quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2`, [centralWhId, prod.id])).rows[0].reserved_quantity;
    assert(reservedAfterCancel === reservedBeforeCancel - 2, `Lượng giữ chỗ (reserved_quantity) đã được giải phóng (-2)`);

    // Thử hủy lần 2: Không được làm giảm thêm
    await customerService.cancel(customerA.id, orderCreated.id, 'Hủy lại');
    const reservedAfterRepeat = (await query(`SELECT reserved_quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2`, [centralWhId, prod.id])).rows[0].reserved_quantity;
    assert(reservedAfterRepeat === reservedAfterCancel, `Hủy lại không làm giảm tồn kho lần nữa (Idempotent)`);

    // ------------------------------------------------------------------------
    // CASE 17: Vòng đời đơn hàng qua Warehouse và Shipper
    // ------------------------------------------------------------------------
    console.log('\n--- Case 17: Vòng đời đơn hàng qua Warehouse và Shipper ---');
    // Tạo đơn mới để chạy qua toàn bộ vòng đời
    await customerService.addCartItem(customerA.id, { productId: prod.id, quantity: 1 });
    const fullOrder = await customerService.createOrder(customerA.id, { addressId: addr.id, channel: 'mobile' });
    assert(fullOrder.status === 'pending', `Đơn mới tạo: status = 'pending'`);

    // 1. Quản trị xác nhận đơn -> confirmed
    await orderProcessingService.confirm(fullOrder.id, { note: 'Xác nhận đơn online' }, adminUser.id);
    let checkOrder = (await query(`SELECT status FROM orders WHERE id = $1`, [fullOrder.id])).rows[0];
    assert(checkOrder.status === 'confirmed', `Đơn đã xác nhận: status = 'confirmed'`);

    // 2. Phân công cho nhân viên kho lấy hàng
    await orderProcessingService.assign(fullOrder.id, { assignedTo: processorUser.id, note: 'Phân công lấy hàng' }, adminUser);

    // 3. Nhân viên bắt đầu lấy hàng (picking)
    await orderProcessingService.update(fullOrder.id, { status: 'picking', note: 'Bắt đầu nhặt hàng' }, processorUser);

    // 4. Quét mã sản phẩm khi lấy hàng (warehouseWorkflowService.scan)
    const scanRequestId = crypto.randomUUID();
    await warehouseWorkflowService.scan(fullOrder.id, { identifier: prod.sku, quantity: 1, requestId: scanRequestId }, processorUser.id);

    // 5. Chuyển sang ready_to_pack
    await orderProcessingService.update(fullOrder.id, { status: 'ready_to_pack', note: 'Đã lấy đủ hàng' }, processorUser);
    checkOrder = (await query(`SELECT status FROM orders WHERE id = $1`, [fullOrder.id])).rows[0];
    assert(checkOrder.status === 'ready_to_pack', `Đơn sẵn sàng đóng gói: status = 'ready_to_pack'`);

    // 6. Nhân viên kho đóng gói xuất kho -> pack
    const stockBeforePack = (await query(`SELECT quantity, reserved_quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2`, [centralWhId, prod.id])).rows[0];
    await warehouseService.pack(fullOrder.id, centralWhId, staffUser.id);
    checkOrder = (await query(`SELECT status FROM orders WHERE id = $1`, [fullOrder.id])).rows[0];
    assert(checkOrder.status === 'packed', `Đơn đã đóng gói thành công: status = 'packed'`);

    const stockAfterPack = (await query(`SELECT quantity, reserved_quantity FROM inventory WHERE warehouse_id = $1 AND product_id = $2`, [centralWhId, prod.id])).rows[0];
    assert(stockAfterPack.quantity === stockBeforePack.quantity - 1, `Tồn kho THỰC TẾ (quantity) đã trừ 1 khi đóng gói xuất kho`);
    assert(stockAfterPack.reserved_quantity === stockBeforePack.reserved_quantity - 1, `Lượng giữ chỗ (reserved_quantity) đã trừ 1`);

    // 7. Tạo vận đơn bàn giao cho Shipper -> handover
    const trackingNumber = `TRK${Date.now()}`;
    const shipment = await shippingService.create({
      orderId: fullOrder.id,
      assignedTo: shipperUser.id,
      trackingNumber,
      carrier: 'Karat Express'
    }, adminUser);
    checkOrder = (await query(`SELECT status FROM orders WHERE id = $1`, [fullOrder.id])).rows[0];
    assert(checkOrder.status === 'handover', `Đơn đã bàn giao Shipper: status = 'handover'`);

    // 8. Shipper nhận đơn đi giao -> shipping
    await shippingService.updateStatus(shipment.id, { status: 'picked_up', note: 'Shipper đã nhận hàng đi giao' }, shipperUser);
    checkOrder = (await query(`SELECT status FROM orders WHERE id = $1`, [fullOrder.id])).rows[0];
    assert(checkOrder.status === 'shipping', `Đơn đang giao hàng: status = 'shipping'`);

    // 9. Shipper giao hàng thành công -> delivered
    await shippingService.updateStatus(shipment.id, { status: 'in_transit', note: 'Đang trên đường giao' }, shipperUser);
    await shippingService.updateStatus(shipment.id, { status: 'delivered', note: 'Khách đã nhận hàng và ký tên' }, shipperUser);
    checkOrder = (await query(`SELECT status, payment_status FROM orders WHERE id = $1`, [fullOrder.id])).rows[0];
    assert(checkOrder.status === 'delivered', `Đơn giao thành công: status = 'delivered'`);

    // 9. Khi đã giao, Customer KHÔNG THỂ hủy đơn
    let cancelDeliveredBlocked = false;
    try {
      await customerService.cancel(customerA.id, fullOrder.id, 'Huy sau khi nhan');
    } catch (e) {
      cancelDeliveredBlocked = (e.statusCode === 409);
    }
    assert(cancelDeliveredBlocked, `Customer không thể hủy đơn đã giao (409)`);

    // ------------------------------------------------------------------------
    // CASE 18: Tồn kho trên Flutter và Web POS nhất quán
    // ------------------------------------------------------------------------
    console.log('\n--- Case 18: Tồn kho trên Flutter và Web POS nhất quán ---');
    const customerStock = (await customerService.catalog({ search: prod.sku })).data.find(p => p.id === prod.id);
    const posProduct = await posService.lookupProduct(prod.sku, centralWhId);
    const warehouseStock = (await warehouseService.inventory({ productId: prod.id })).data[0];

    assert(customerStock.available_quantity === posProduct.available_quantity,
      `Tồn khả dụng Customer (${customerStock.available_quantity}) == POS (${posProduct.available_quantity})`);
    assert(customerStock.available_quantity === warehouseStock.available_quantity,
      `Tồn khả dụng Customer (${customerStock.available_quantity}) == Warehouse (${warehouseStock.available_quantity})`);

    console.log('\n================================================================');
    console.log(`  KẾT QUẢ KIỂM THỬ: ${passed} PASSED, ${failed} FAILED (TỔNG CỘNG ${passed + failed} TEST CHECKS)`);
    console.log('================================================================\n');

    if (failed > 0) process.exitCode = 1;
  } catch (err) {
    console.error('LỖI KIỂM THỬ:', err);
    process.exitCode = 1;
  } finally {
    await closeDatabase();
  }
}

runTests();
