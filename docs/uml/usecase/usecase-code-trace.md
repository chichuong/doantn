# Báo cáo Truy vết Use Case với Source Code Thực tế (Code Traceability Report)

Tài liệu này chứng minh **100% các Use Case** xuất hiện trên sơ đồ Tổng quát và 8 sơ đồ Chi tiết đều có căn cứ trực tiếp từ giao diện (Frontend Web / Mobile / Firmware IoT), tầng định tuyến & phân quyền (Routes / Middlewares), tầng xử lý nghiệp vụ (Services / Models) và lược đồ Cơ sở dữ liệu (Database Migrations).

---

## 1. Kiến trúc Phân tầng & Cơ chế Bảo vệ Quyền trong Source Code

1. **Xác thực người dùng & thiết bị IoT (`Backend/src/middlewares/auth.middleware.js`):**
   - Người dùng Web/Mobile xác thực qua JWT HS256 (`Authorization: Bearer <token>`), đối chiếu trực tiếp trạng thái `users.status === 'active'` và nạp mảng `permissions` từ bảng `role_permissions` cùng `warehouse_ids` từ `user_warehouses`.
   - Thiết bị phần cứng `Camera IoT ESP32-S3` xác thực qua header `X-Device-Token` khớp `env.iotDeviceToken`, gắn cờ `request.isIotDevice = true`.
2. **Kiểm soát quyền hạn kép (`requireRole` + `requirePermission` + `requireWarehouseAccess`):**
   - `requireRole(...roles)` kiểm tra `request.user.role_code`.
   - `requirePermission(...perms)` kiểm tra toàn bộ quyền yêu cầu phải nằm trong `request.user.permissions`.
   - `requireWarehouseAccess(source)` (`Backend/src/middlewares/warehouse-access.middleware.js`) kiểm tra nhân sự chỉ thao tác trên kho được phân công (hoặc kho trung tâm `WH-HCM-01`).

---

## 2. Bảng Truy vết Toàn diện từ Giao diện -> API -> Service/Model -> Database

### Phân hệ 01: Tài khoản, Xác thực và Phân quyền (`01-tai-khoan-va-phan-quyen.puml`)

| Mã UC | Tên Use Case | Giao diện (Web / Mobile) | Route & Middleware | Controller & Service / Model | Bảng CSDL liên quan |
|---|---|---|---|---|---|
| `UC_AUTH_01` | Đăng ký tài khoản khách hàng | `Frontend_Web/src/pages/LoginPage.jsx` (`handleVerifyAndRegister`)<br>`Frontend_Mobile/.../auth/register_screen.dart` | `POST /api/v1/auth/register` (`loginRateLimit`) | `auth.controller.register` -> `auth.service.register` -> `auth.model.createCustomer` | `users`, `roles` |
| `UC_AUTH_02` | Xác thực mã OTP qua Email | `LoginPage.jsx` (`handleSendRegisterOtp`, `handleSendForgotOtp`) | `POST /api/v1/auth/register/send-otp`<br>`POST /api/v1/auth/forgot-password` | `auth.service.sendRegisterOtp`, `sendForgotPasswordOtp`, `verifySavedOtp` -> `utils/email.sendOtpEmail` | In-memory `otpStore` + Resend/SMTP |
| `UC_AUTH_03` | Đăng nhập hệ thống | `LoginPage.jsx` (`handleLogin`)<br>`login_screen.dart` | `POST /api/v1/auth/login` (`loginRateLimit`) | `auth.controller.login` -> `auth.service.login` -> `auth.model.findUserAuthorization` | `users`, `roles`, `role_permissions`, `user_warehouses` |
| `UC_AUTH_04` | Khôi phục mật khẩu quên | `LoginPage.jsx` (`handleResetPassword`) | `POST /api/v1/auth/reset-password` | `auth.controller.resetPassword` -> `auth.service.resetPasswordWithOtp` | `users`, `audit_logs` |
| `UC_AUTH_05` | Xem thông tin tài khoản cá nhân | `AuthContext.jsx`, `Navbar.jsx`, `profile_screen.dart`, `warehouse_profile_screen.dart`, `shipper_profile_screen.dart` | `GET /api/v1/auth/me` (`authenticate`) | `auth.controller.me` -> `auth.service.getMe` | `users`, `roles` |
| `UC_AUTH_06` | Quản lý tài khoản người dùng | `Frontend_Web/src/pages/UsersPage.jsx` (Tab Tài khoản) | `GET/POST/PATCH /api/v1/auth/users` (`auth.users.read/create/update`) | `auth.service.getUsers`, `addUser`, `editUser` -> `auth.model.js` | `users`, `audit_logs` |
| `UC_AUTH_07` | Phân công kho làm việc cho nhân sự | API Quản trị kho nhân sự (`authApi.js`) | `GET/PUT /api/v1/auth/users/:userId/warehouses` (`requireRole('admin')`) | `warehouse-access.controller.list/replace` -> `warehouse-access.model.js` | `user_warehouses` |
| `UC_AUTH_08` | Quản lý vai trò hệ thống | `UsersPage.jsx` (Tab Vai trò & Quyền) | `GET/POST/PATCH /api/v1/auth/roles` (`auth.roles.read/create/update`) | `auth.service.getRoles`, `addRole`, `editRole` | `roles`, `audit_logs` |
| `UC_AUTH_09` | Thiết lập quyền hạn cho vai trò | `UsersPage.jsx` (`handleSaveRolePermissions`) | `PUT /api/v1/auth/roles/:roleId/permissions` (`auth.roles.update`) | `auth.service.setRolePermissions` -> `auth.model.replaceRolePermissions` | `role_permissions`, `audit_logs` |
| `UC_AUTH_10` | Tra cứu danh mục quyền hạn | `UsersPage.jsx` (`loadRolesAndPermissions`) | `GET /api/v1/auth/permissions` (`auth.permissions.read`) | `auth.service.getPermissions` -> `auth.model.listPermissions` | `permissions` |

---

### Phân hệ 02: Sản phẩm, Danh mục và Thiết lập Kho (`02-san-pham-danh-muc-va-kho.puml`)

| Mã UC | Tên Use Case | Giao diện (Web / Mobile) | Route & Middleware | Controller & Service / Model | Bảng CSDL liên quan |
|---|---|---|---|---|---|
| `UC_CAT_01` | Quản lý danh mục sản phẩm | `Frontend_Web/src/pages/ProductsPage.jsx` (Tab Danh mục) | `GET/POST/PATCH /api/v1/manager/categories` (`manager.categories.read/manage`) | `category.controller.js` -> `category.service.js` -> `category.model.js` | `categories` |
| `UC_CAT_02` | Thêm mới sản phẩm và mã SKU | `ProductsPage.jsx` (`openAddProduct`, `handleSaveProduct`) | `POST /api/v1/manager/products` (`manager.products.manage`) | `manager.controller.createProduct` -> `manager.service.addProduct` -> `manager.model.createProduct` | `products`, `categories` |
| `UC_CAT_03` | Cập nhật giá, ngưỡng tồn và trạng thái bán | `ProductsPage.jsx` (`openEditProduct`, `handleSaveProduct`) | `PATCH /api/v1/manager/products/:productId` (`manager.products.manage`) | `manager.controller.updateProduct` -> `manager.service.editProduct` -> `manager.model.updateProduct` | `products` |
| `UC_CAT_04` | Tra cứu danh sách sản phẩm | `ProductsPage.jsx` (`loadProducts`) | `GET /api/v1/manager/products` (`manager.products.read`) | `manager.service.products` -> `manager.model.listProducts` | `products`, `categories` |
| `UC_CAT_05` | Thiết lập và cập nhật kho hàng | Quản trị kho (`managerApi.js`) | `POST/PATCH /api/v1/manager/warehouses` (`manager.warehouses.manage`) | `manager.service.addWarehouse`, `editWarehouse` -> `manager.model.js` | `warehouses` |
| `UC_CAT_06` | Xem danh sách các kho vận hành | `InventoryPage.jsx`, `DataExchangePage.jsx`, `ForecastingPage.jsx` | `GET /api/v1/manager/warehouses` (`manager.warehouses.read`) | `manager.service.warehouses` -> `manager.model.listWarehouses` | `warehouses`, `inventory` |
| `UC_CAT_07` | Tra cứu sản phẩm đang kinh doanh | `ShopPage.jsx`, `warehouse_documents_screen.dart` (`getCatalogProducts`) | `GET /api/v1/catalog/products`, `/:productId`, `/categories` | `catalog.routes.js` -> `customer.service.catalog`, `catalog.model.getProduct` | `products`, `categories`, `inventory` |

---

### Phân hệ 03: Nhập kho, Xuất kho và Đối soát QR/IoT (`03-nhap-xuat-kho-va-doi-soat-qr.puml`)

| Mã UC | Tên Use Case | Giao diện / Thiết bị | Route & Middleware | Controller & Service / Model | Bảng CSDL liên quan |
|---|---|---|---|---|---|
| `UC_WH_01` | Lập phiếu yêu cầu nhập kho | `warehouse_documents_screen.dart` (`_CreateDocumentModal`)<br>`ForecastingPage.jsx` (`handleCreateBatchReplenishDoc`) | `POST /api/v1/warehouse/documents` (`warehouse.documents.create`)<br>`POST /api/v1/manager/documents` (`manager.documents.read`) | `warehouse.controller.createDocument` -> `warehouse.service.createWarehouseDocument` -> `warehouse.model.createDocument` | `warehouse_documents`, `warehouse_document_items` |
| `UC_WH_02` | Lập phiếu yêu cầu xuất kho | `warehouse_documents_screen.dart` (`type = 'issue'`) | `POST /api/v1/warehouse/documents` (`warehouse.documents.create`) | `warehouse.service.createWarehouseDocument` | `warehouse_documents`, `warehouse_document_items` |
| `UC_WH_03` | Tra cứu và xem chi tiết chứng từ kho | `WarehouseApprovalsPage.jsx`<br>`warehouse_documents_screen.dart` | `GET /api/v1/warehouse/documents`, `/:documentId`<br>`GET /api/v1/manager/documents`, `/:documentId` | `warehouse.service.documents`, `documentDetail` -> `warehouse.model.listDocuments`, `getDocument` | `warehouse_documents`, `warehouse_document_items` |
| `UC_WH_04` | Phê duyệt phiếu và sinh mã QR đối soát | `WarehouseApprovalsPage.jsx` (`handleApprove`, QR Modal) | `POST /api/v1/manager/documents/:documentId/approve` (`warehouse.documents.approve`) | `warehouse.controller.approveDocument` -> `warehouse.model.approveDocument` | `warehouse_documents` (`qr_code`) |
| `UC_WH_05` | Từ chối yêu cầu nhập xuất kho | `WarehouseApprovalsPage.jsx` (`handleReject`) | `POST /api/v1/manager/documents/:documentId/reject` (`warehouse.documents.approve`) | `warehouse.controller.rejectDocument` -> `warehouse.model.rejectDocument` | `warehouse_documents` (`rejection_reason`) |
| `UC_WH_06` | Quét mã QR phiếu kho đối soát | `ESP32_S3_Camera_QR.ino` (`queryBackendDocument`)<br>`IotCameraScannerModal.jsx`<br>`warehouse_scan_screen.dart` | `GET /api/v1/warehouse/documents/lookup`, `/:identifier`<br>`GET /api/v1/manager/documents/lookup` | `warehouse.controller.lookupByQr` -> `warehouse.model.getDocumentByQr`, `recordDocumentQrScan` | `warehouse_documents` (`qr_scanned_at`, `qr_scanned_source`), `audit_logs` |
| `UC_WH_07` | Quét mã SKU kiểm đếm dòng hàng trong phiếu | API Kiểm đếm dòng chứng từ kho | `GET /api/v1/warehouse/documents/:documentId/check`<br>`POST /api/v1/warehouse/documents/:documentId/scan` (`warehouse.documents.complete`) | `document-scan.controller.js` -> `document-scan.model.scanDocumentItem` | `warehouse_document_scan_events` |
| `UC_WH_08` | Xác nhận hoàn tất nhập xuất và cập nhật tồn | `warehouse_documents_screen.dart` (`_confirmExecution`)<br>`warehouse_scan_screen.dart` (`_completeScannedDocument`) | `POST /api/v1/warehouse/documents/:documentId/complete` (`warehouse.documents.complete`) | `warehouse.controller.completeDocument` -> `warehouse.model.completeDocument` -> `inventory.model.changeStock` | `warehouse_documents`, `warehouse_document_items`, `inventory`, `inventory_transactions` |
| `UC_WH_09` | Đồng bộ cấu hình Wi-Fi và trạng thái Camera IoT | `ESP32_S3_Camera_QR.ino` (`sendBackendHeartbeat`, `tryParseAndApplyWiFiQR`)<br>`IotCameraScannerModal.jsx` (`handleOneClickSyncPcWifi`) | `POST /api/v1/warehouse/iot/heartbeat`<br>`GET /iot/status`, `POST /iot/sync-pc-wifi` | `warehouse.controller.recordIotHeartbeat`, `getIotStatus`, `syncPcWifiToIot` -> `iot-wifi-sync.service.js` | Trạng thái thiết bị IoT (`latestIotDeviceState`) + NVS Flash ESP32 |

---

### Phân hệ 04: Tồn kho, Cảnh báo Tồn thấp và Điều chỉnh Tồn (`04-ton-kho-va-dieu-chinh-ton.puml`)

| Mã UC | Tên Use Case | Giao diện (Web / Mobile) | Route & Middleware | Controller & Service / Model | Bảng CSDL liên quan |
|---|---|---|---|---|---|
| `UC_INV_01` | Tra cứu tồn kho thực tế, giữ chỗ và khả dụng | `InventoryPage.jsx`<br>`PosPage.jsx`<br>`warehouse_inventory_screen.dart` | `GET /api/v1/manager/inventory`<br>`GET /api/v1/warehouse/inventory`<br>`GET /api/v1/pos/products` | `manager.service.inventory` / `warehouse.service.inventory` -> `manager.model.listInventory` | `inventory`, `products`, `warehouses` |
| `UC_INV_02` | Lọc cảnh báo sản phẩm sắp hết hàng | `InventoryPage.jsx` (`lowStockOnly`)<br>`warehouse_inventory_screen.dart` (`lowStock`) | `?lowStock=true` trên `/manager/inventory` và `/warehouse/inventory` | `manager.model.listInventory` (`i.quantity - i.reserved_quantity <= p.reorder_level`) | `inventory`, `products` |
| `UC_INV_03` | Quét mã SKU tra cứu nhanh tồn kho kệ | `warehouse_scan_screen.dart` (`scanProduct`) | `GET /api/v1/warehouse/scan` (`warehouse.inventory.read`) | `warehouse.controller.scan` -> `warehouse.model.findProductByIdentifier` | `products`, `inventory` |
| `UC_INV_04` | Điều chỉnh tăng giảm tồn kho | `InventoryPage.jsx` + `AdjustStockModal.jsx` | `POST /api/v1/manager/inventory/adjustments` (`manager.inventory.adjust`) | `manager.service.adjustStock` -> `manager.model.adjustInventory` -> `inventory.model.changeStock` | `inventory`, `inventory_transactions` |
| `UC_INV_05` | Xem lịch sử giao dịch biến động tồn kho | Tra cứu kiểm toán tồn kho (`inventoryApi.js`) | `GET /api/v1/manager/inventory/transactions` (`manager.inventory.read`) | `manager.service.inventoryTransactions` -> `manager.model.listInventoryTransactions` | `inventory_transactions` |
| `UC_INV_06` | Xem chi tiết lượng tồn giữ chỗ theo đơn hàng | Tra cứu giữ chỗ tồn kho (`inventoryApi.js`) | `GET /api/v1/manager/inventory/:warehouseId/:productId/reservations` (`manager.inventory.read`) | `manager.service.inventoryReservations` -> `manager.model.getInventoryReservations` | `inventory_reservations`, `orders` |
| `UC_INV_07` | Đối soát sai lệch tồn giữ chỗ (Discrepancies) | Đối soát chênh lệch giữ chỗ (`inventoryApi.js`) | `GET /api/v1/manager/inventory/discrepancies` (`manager.inventory.read`) | `manager.service.inventoryDiscrepancies` -> `manager.model.listInventoryDiscrepancies` | View `inventory_reservation_discrepancies` |

---

### Phân hệ 05: Bán hàng Tại quầy POS (`05-ban-hang-pos.puml`)

| Mã UC | Tên Use Case | Giao diện (Web) | Route & Middleware | Controller & Service / Model | Bảng CSDL liên quan |
|---|---|---|---|---|---|
| `UC_POS_01` | Mở ca bán hàng POS | `PosPage.jsx`, `Navbar.jsx`, `OpenShiftModal.jsx` | `GET /api/v1/pos/sessions/current`<br>`POST /api/v1/pos/sessions/open` (`pos.sessions.manage`) | `pos.service.open` -> `pos.model.openSession` | `pos_sessions` |
| `UC_POS_02` | Chốt và đóng ca POS | `PosPage.jsx`, `Navbar.jsx`, `CloseShiftModal.jsx` | `POST /api/v1/pos/sessions/:sessionId/close` (`pos.sessions.manage`) | `pos.service.close` -> `pos.model.closeSession` | `pos_sessions` |
| `UC_POS_03` | Tra cứu và quét mã SKU sản phẩm POS | `PosPage.jsx` (`handleSkuSearch`, `loadWarehouseProducts`) | `GET /api/v1/pos/products`<br>`GET /api/v1/pos/products/lookup` (`pos.products.read`) | `pos.service.listProducts`, `lookupProduct` -> `pos.model.findSaleProduct` | `products`, `inventory` |
| `UC_POS_04` | Áp dụng chiết khấu đơn tại quầy | `PosPage.jsx` (`discountAmount`), `PosContext.jsx`, `PaymentModal.jsx` | Xử lý tính toán tổng thu tại quầy trong `PosContext.jsx` | `PosContext` (`subtotal`, `discountAmount`, `finalTotal`) | Phiên giỏ hàng POS |
| `UC_POS_05` | Lập đơn và thanh toán tại quầy POS | `PosPage.jsx`, `PaymentModal.jsx` | `POST /api/v1/pos/sales` (`pos.sales.create`) | `pos.service.create` -> `pos.model.createSale` | `orders`, `order_items`, `payments`, `order_status_history`, `api_idempotency_keys` |
| `UC_POS_06` | Trừ tồn kho trực tiếp tại kho quầy | Thực thi tự động trong `createSale` | Nội bộ transaction `POST /api/v1/pos/sales` | `inventory.service.directDeductStock` -> `inventory.model.changeStock` | `inventory`, `inventory_transactions` |
| `UC_POS_07` | Xem lịch sử và phiếu hóa đơn điện tử POS | `ReceiptModal.jsx`, `OrdersPage.jsx` (`isSalesOnly`), `OrderDetailModal.jsx` | `GET /api/v1/pos/sales`, `GET /api/v1/pos/sales/:saleId` (`pos.sales.read`) | `pos.service.sales`, `saleDetail` -> `pos.model.listSales`, `getSale` | `orders`, `order_items`, `payments` |
| `UC_POS_08` | Hủy giao dịch POS và hoàn tồn kho | `posApi.js` (`voidSale`) | `POST /api/v1/pos/sales/:saleId/void` (`pos.sales.void`) | `pos.service.voidSaleById` -> `pos.model.voidSale` | `orders`, `payments`, `inventory`, `inventory_transactions`, `order_status_history` |

---

### Phân hệ 06: Mua sắm Trực tuyến, Thanh toán & Đối soát (`06-mua-sam-online-va-thanh-toan.puml`)

| Mã UC | Tên Use Case | Giao diện (Web / Mobile) | Route & Middleware | Controller & Service / Model | Bảng CSDL liên quan |
|---|---|---|---|---|---|
| `UC_CUS_01` | Xem và tìm kiếm sản phẩm trực tuyến | `ShopPage.jsx` (Tab Sản phẩm)<br>`catalog_screen.dart` | `GET /api/v1/customer/catalog` (`customer.catalog.read`) | `customer.service.catalog` -> `customer.model.listCatalog` | `products`, `categories`, `inventory` |
| `UC_CUS_02` | Quản lý giỏ hàng trực tuyến | `ShopPage.jsx` (Tab Giỏ hàng)<br>`cart_screen.dart` | `GET /api/v1/customer/cart`<br>`PUT /cart/items`, `DELETE /cart/items/:productId` (`customer.cart.manage`) | `customer.service.cart`, `addCartItem`, `deleteCartItem` -> `customer.model.js` | `carts`, `cart_items` |
| `UC_CUS_03` | Quản lý sổ địa chỉ nhận hàng | `ShopPage.jsx` (Tab Địa chỉ)<br>`profile_screen.dart`, `checkout_screen.dart` | `GET/POST/PATCH/DELETE /api/v1/customer/addresses` (`customer.addresses.manage`) | `customer.service.addresses`, `addAddress`, `editAddress`, `removeAddress` | `customer_addresses` |
| `UC_CUS_04` | Đặt hàng trực tuyến (COD / VietQR) | `ShopPage.jsx` (`handlePlaceOrder`)<br>`checkout_screen.dart` | `POST /api/v1/customer/checkout` (`customer.orders.create`) | `customer.service.createOrder` -> `customer.model.checkout` | `orders`, `order_items`, `payments`, `carts`, `api_idempotency_keys` |
| `UC_CUS_05` | Giữ chỗ tồn kho tạm thời | Thực thi tự động trong `checkout` | Nội bộ transaction `POST /api/v1/customer/checkout` | `inventory.service.reserveStock` | `inventory` (`reserved_quantity`), `inventory_reservations` |
| `UC_CUS_06` | Xem hướng dẫn VietQR và gửi mã chuyển khoản | `ShopPage.jsx` (VietQR), API Thanh toán khách hàng | `GET /api/v1/payments/orders/:orderId/instructions`<br>`POST /api/v1/payments/orders/:orderId/transfers` (`payments.customer.manage`) | `payment.service.instructions`, `submit` -> `payment.model.submitTransfer` | `bank_transfer_requests`, `orders` |
| `UC_CUS_07` | Theo dõi lịch sử và tiến trình đơn hàng | `ShopPage.jsx` (Tab Đơn hàng)<br>`orders_screen.dart`, `order_detail_screen.dart` | `GET /api/v1/customer/orders`, `/:orderId` (`customer.orders.read`) | `customer.service.orders`, `orderDetail` -> `customer.model.listOrders`, `getOrder` | `orders`, `order_status_history`, `shipments` |
| `UC_CUS_08` | Hủy đơn đặt hàng và giải phóng tồn giữ chỗ | `ShopPage.jsx` (`handleCancelOrder`)<br>`order_detail_screen.dart`<br>`StateActions.jsx` (Quản lý hủy) | `POST /api/v1/customer/orders/:orderId/cancel` (`customer.orders.cancel`)<br>`POST /api/v1/manager/orders/:orderId/cancel` (`manager.orders.cancel`) | `order-cancellation.model.cancelOnlineOrder` -> `inventory.service.releaseReservation` | `orders`, `inventory_reservations`, `inventory`, `order_status_history` |
| `UC_CUS_09` | Đối soát và duyệt yêu cầu chuyển khoản ngân hàng | Phân hệ Đối soát thanh toán (`payment.routes.js`) | `GET /api/v1/payments/transfers` (`payments.transfers.read`)<br>`POST /api/v1/payments/transfers/:requestId/review` (`payments.transfers.review`) | `payment.service.list`, `review` -> `payment.model.reviewTransfer` | `bank_transfer_requests`, `payments`, `orders`, `inventory_reservations` |
| `UC_CUS_10` | Xác nhận hoàn tiền thủ công | Phân hệ Hoàn tiền thủ công (`payment.routes.js`) | `POST /api/v1/payments/orders/:orderId/refund` (`payments.refunds.confirm`) | `payment.service.refund` -> `payment.model.confirmRefund` | `manual_refunds`, `payments`, `orders`, `order_return_receipts` |

---

### Phân hệ 07: Xử lý Đơn hàng, Đóng gói và Giao nhận (`07-xu-ly-don-dong-goi-va-giao-nhan.puml`)

| Mã UC | Tên Use Case | Giao diện (Web / Mobile) | Route & Middleware | Controller & Service / Model | Bảng CSDL liên quan |
|---|---|---|---|---|---|
| `UC_FUL_01` | Tra cứu danh sách và tiến trình đơn hàng | `OrdersPage.jsx`, `OrderDetailModal.jsx`<br>`warehouse_orders_screen.dart` | `GET /api/v1/manager/orders`<br>`GET /api/v1/order-processing/orders`, `/:orderId`<br>`GET /api/v1/warehouse/orders` | `manager.service.orders`, `order-processing.service.orders/detail`, `warehouse.service.orders` | `orders`, `order_processing_tasks`, `order_status_history` |
| `UC_FUL_02` | Xác nhận tiếp nhận đơn trực tuyến | `StateActions.jsx` (`targetStatus === 'confirmed'`) | `POST /api/v1/order-processing/orders/:orderId/confirm` (`order_processing.orders.confirm`) | `order-processing.service.confirm` -> `order-processing.model.confirmOrder` | `orders`, `order_processing_tasks`, `inventory_reservations` |
| `UC_FUL_03` | Phân công nhân viên xử lý đơn | Phân công xử lý đơn (`orderApi.js`) | `POST /api/v1/order-processing/orders/:orderId/assign` (`order_processing.orders.assign`) | `order-processing.service.assign` -> `order-processing.model.assignOrder` | `order_processing_tasks`, `user_warehouses` |
| `UC_FUL_04` | Cập nhật trạng thái lấy hàng và sẵn sàng đóng gói | `StateActions.jsx` (`targetStatus === 'ready_to_pack'`) | `PATCH /api/v1/order-processing/orders/:orderId/task` (`order_processing.tasks.update`) | `order-processing.service.update` -> `order-processing.model.updateTask` | `order_processing_tasks`, `orders` |
| `UC_FUL_05` | Quét mã SKU kiểm tra sản phẩm theo dòng đơn | `pack_order_screen.dart` (`_scanItem`, `_loadCheck`) | `GET /api/v1/warehouse/orders/:orderId/check`<br>`POST /api/v1/warehouse/orders/:orderId/scan` (`warehouse.orders.scan`) | `warehouse-workflow.service.check/scan` -> `warehouse-workflow.model.scanOrderItem` | `order_scan_events`, `order_items` |
| `UC_FUL_06` | Đóng gói kiện hàng và khấu trừ tồn giữ chỗ | `pack_order_screen.dart` (`_packOrder`)<br>`StateActions.jsx` (`targetStatus === 'packed'`) | `POST /api/v1/warehouse/orders/:orderId/pack` (`warehouse.orders.pack`) | `warehouse.service.pack` -> `warehouse.model.packOrder` -> `consumeReservation` | `orders`, `inventory_reservations`, `inventory`, `inventory_transactions` |
| `UC_FUL_07` | Tạo vận đơn và bàn giao nhân viên giao | `StateActions.jsx` (`targetStatus === 'handover'`) | `POST /api/v1/shipping/shipments` (`shipping.shipments.create`, `shipping.shipments.assign`) | `shipping.service.create` -> `shipping.model.createShipment` | `shipments`, `shipment_status_history`, `orders` |
| `UC_FUL_08` | Quét mã vận đơn và xem chi tiết giao hàng | `shipments_screen.dart`, `shipper_scan_screen.dart`, `shipment_detail_screen.dart` | `GET /api/v1/shipping/scan`<br>`GET /api/v1/shipping/shipments`, `/:shipmentId` (`shipping.shipments.read`) | `shipping.service.scan`, `list`, `detail` -> `shipping.model.js` | `shipments`, `shipment_status_history` |
| `UC_FUL_09` | Cập nhật trạng thái giao hàng (Nhận/Giao/Hoàn) | `shipment_detail_screen.dart` (`_updateStatus`)<br>`StateActions.jsx` | `PATCH /api/v1/shipping/shipments/:shipmentId/status` (`shipping.shipments.update`) | `shipping.service.updateStatus` -> `shipping.model.updateShipmentStatus` | `shipments`, `shipment_status_history`, `orders`, `order_status_history` |
| `UC_FUL_10` | Tiếp nhận hàng hoàn trả và nhập lại kho | `StateActions.jsx` (`returnOrder`), `warehouse_service.dart` (`getReturnReceipt`) | `GET/POST /api/v1/warehouse/orders/:orderId/return-receipt` (`warehouse.orders.returns`) | `warehouse-workflow.service.receiveReturn` -> `warehouse-workflow.model.receiveOrderReturn` | `order_return_receipts`, `order_return_receipt_items`, `inventory`, `inventory_transactions` |

---

### Phân hệ 08: AI Dự báo Nhu cầu, Báo cáo & Trao đổi Dữ liệu (`08-ai-du-bao-bao-cao-va-du-lieu.puml`)

| Mã UC | Tên Use Case | Giao diện / Service ngoài | Route & Middleware | Controller & Service / Model | Bảng CSDL liên quan |
|---|---|---|---|---|---|
| `UC_RPT_01` | Khởi chạy mô hình dự báo nhu cầu AI | `ForecastingPage.jsx`, `CreateForecastModal.jsx` + `Forecasting/src/api/main.py` (`POST /forecast`) | `POST /api/v1/forecasting/runs` (`forecasting.run`) | `forecasting.service.run` -> `forecasting-python.service.forecastWithPython` -> `forecasting.model.createForecastRun` | `forecast_runs`, `forecast_values`, `orders`, `order_items` |
| `UC_RPT_02` | Xem kết quả và chỉ số đánh giá dự báo (MAE/RMSE) | `ForecastingPage.jsx`, `ForecastDetailModal.jsx`, `ModelTechSection.jsx` | `GET /api/v1/forecasting/runs`, `/:runId` (`forecasting.read`) | `forecasting.service.runs`, `getRun` -> `forecasting.model.js` | `forecast_runs`, `forecast_values` |
| `UC_RPT_03` | Xem cảnh báo nguy cơ thiếu hàng theo dự báo | `ForecastingPage.jsx` (`processedProducts`, `alerts`) | `GET /api/v1/forecasting/alerts` (`forecasting.alerts.read`) | `forecasting.service.alerts` -> `forecasting.model.getForecastAlerts` | `forecast_values`, `inventory` |
| `UC_RPT_04` | Lập phiếu nhập đề xuất tự động từ dự báo AI | `ForecastingPage.jsx` (`handleCreateBatchReplenishDoc`) | `POST /api/v1/manager/documents` (`manager.documents.read`) | `warehouse.controller.createDocument` -> `warehouse.service.createWarehouseDocument` | `warehouse_documents`, `warehouse_document_items` |
| `UC_RPT_05` | Xem bảng tổng quan kinh doanh | `DashboardPage.jsx` (`fetchData`) | `GET /api/v1/manager/dashboard` (`manager.dashboard.read`) | `manager.service.dashboard` -> `manager.model.getDashboardSummary` | `orders`, `products`, `inventory`, `users` |
| `UC_RPT_06` | Xem báo cáo doanh thu đa kênh và theo ngày | `DashboardPage.jsx` (`byChannel`, `byDay`, `handleExportCsv`) | `GET /api/v1/manager/reports/sales` (`manager.reports.read`) | `manager.service.salesReport` -> `manager.model.getSalesReport` | `orders` |
| `UC_RPT_07` | Nhập dữ liệu hàng loạt từ file Excel / CSV | `DataExchangePage.jsx` (Tab Nhập dữ liệu) | `POST /api/v1/data-exchange/import/:dataType` (`data_exchange.import`) | `data-exchange.service.importFile` -> `data-exchange.model.js`, `data-exchange-extra.model.js` | `categories`, `products`, `inventory`, `inventory_transactions`, `data_exchange_jobs` |
| `UC_RPT_08` | Xuất dữ liệu và báo cáo ra Excel / CSV | `DataExchangePage.jsx` (Tab Xuất dữ liệu) | `GET /api/v1/data-exchange/export/:dataType` (`data_exchange.export`) | `data-exchange.service.exportFile` -> `utils/spreadsheet.rowsToSheet` | `categories`, `products`, `inventory`, `orders`, `data_exchange_jobs` |
| `UC_RPT_09` | Tra cứu lịch sử tác vụ nhập xuất dữ liệu | `DataExchangePage.jsx` (Tab Lịch sử) | `GET /api/v1/data-exchange/jobs` (`data_exchange.jobs.read`) | `data-exchange.service.jobs` -> `data-exchange.model.listJobs` | `data_exchange_jobs` |
