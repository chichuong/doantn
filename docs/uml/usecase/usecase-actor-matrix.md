# Ma trận Đối chiếu Actor — Use Case — Permission — Source Code

## 1. Tổng hợp Vai trò (Actors) và Hệ thống Phân quyền (RBAC)

Hệ thống Karat Retail triển khai mô hình phân quyền RBAC trên PostgreSQL/SQL Server gồm **7 vai trò con người** (`roles`), **58 quyền hạn chi tiết** (`permissions`), **1 thiết bị phần cứng ngoài** (`Camera IoT ESP32-S3`) và **2 hệ thống tích hợp ngoài** (`Dịch vụ AI Dự báo nhu cầu`, `Dịch vụ Email OTP`).

> **Ghi chú xác minh Database Runtime & Seed:** Khảo sát thực hiện trực tiếp trên toàn bộ chuỗi 20 file migration (`Backend/database/migrations/001_admin_auth.sql` đến `020_single_central_warehouse_setup.sql`), file dữ liệu khởi tạo `Backend/database/cloud_seed_data.json` và tầng middleware `Backend/src/middlewares/auth.middleware.js`, `warehouse-access.middleware.js`. Không kết nối runtime tới máy chủ DB từ xa nên trạng thái phân quyền được xác minh từ schema + migrations + seed data chuẩn của dự án.

| Mã Role / Actor | Tên Actor trên UML | Loại Actor | Số quyền mặc định | Nguồn chứng minh |
|---|---|---|---|---|
| `admin` | Quản trị viên | Con người (kế thừa `Quản lý`) | 58 / 58 quyền | `001_admin_auth.sql`, `014_staff_warehouse_access.sql`, `cloud_seed_data.json` |
| `manager` | Quản lý | Con người | 33 quyền | `002_manager_operations.sql`, `018_warehouse_approval_and_qr_workflow.sql`, `020_single_central_warehouse_setup.sql`, `cloud_seed_data.json` |
| `sales` | Nhân viên bán hàng | Con người | 5 quyền (`pos.*`) | `004_pos_operations.sql`, `pos.routes.js` |
| `warehouse` | Nhân viên kho | Con người | 8 quyền (`warehouse.*` trừ `approve`) | `003_warehouse_operations.sql`, `011_catalog_and_warehouse_workflows.sql`, `warehouse.routes.js` |
| `order_processor` | Nhân viên xử lý đơn | Con người | 2 quyền (`order_processing.orders.read`, `tasks.update`) | `008_order_processing_operations.sql`, `order-processing.routes.js` |
| `shipper` | Nhân viên giao hàng | Con người | 2 quyền (`shipping.shipments.read`, `update`) | `006_shipping_operations.sql`, `shipping.routes.js` |
| `customer` | Khách hàng | Con người | 7 quyền (`customer.*`, `payments.customer.manage`) | `005_customer_operations.sql`, `012_manual_transfer_payments.sql` |
| *(Tài khoản hợp lệ)* | Người dùng hệ thống | Actor tổng quát (Phân hệ 01) | Đăng nhập / Quên mật khẩu / Xem `/me` | `auth.routes.js` (`POST /login`, `POST /forgot-password`, `POST /reset-password`, `GET /me`) |
| `esp32_s3_camera` | Camera IoT ESP32-S3 | Thiết bị ngoài (`<<Thiết bị>>`) | Xác thực qua `X-Device-Token` | `Hardware_IoT/ESP32_S3_Camera_QR/ESP32_S3_Camera_QR.ino`, `auth.middleware.js` (dòng 8–23) |
| `forecast_service` | Dịch vụ AI Dự báo nhu cầu | Hệ thống ngoài (`<<Hệ thống ngoài>>`) | Xác thực qua `X-Service-Token` | `Forecasting/src/api/main.py` (`POST /forecast`), `forecasting-python.service.js` |
| `email_service` | Dịch vụ Email OTP | Hệ thống ngoài (`<<Hệ thống ngoài>>`) | Kết nối Resend API / SMTP | `Backend/src/utils/email.js` (`sendOtpEmail`), `auth.service.js` |

### Lưu ý quan trọng về Phân quyền thực tế phát hiện từ Source Code
1. **Quan hệ kế thừa `Quản trị viên --|> Quản lý`:** Trong `014_staff_warehouse_access.sql` và `cloud_seed_data.json`, `admin` sở hữu toàn bộ **58/58 permissions**, bao gồm đầy đủ **33 permissions** của `manager`, và mọi `requireRole` có `'manager'` trong toàn bộ `src/routes/*.js` đều có `'admin'`. Do đó `Quản trị viên` chuyên biệt hóa hợp lệ từ `Quản lý` theo chuẩn UML 2.5.1.
2. **Không tự gán quyền POS cho `Quản lý`:** Mặc dù `pos.routes.js` dòng 8 khai báo `requireRole('admin', 'sales', 'manager')`, nhưng mỗi route bên dưới đều kiểm tra `requirePermission('pos.*')`. Trong `004_pos_operations.sql` (dòng 60) và `cloud_seed_data.json`, các quyền `pos.*` **chỉ được gán cho `sales` và `admin`**, không gán cho `manager`. Vì vậy trên sơ đồ POS, `Quản lý` **không** được nối với các Use Case bán hàng tại quầy.
3. **Quyền của `Nhân viên xử lý đơn` (`order_processor`):** Mặc dù `order-processing.routes.js` dòng 12 cho phép role `'order_processor'` đi qua `requireRole`, nhưng `requirePermission('order_processing.orders.confirm')` chặn lại vì `008_order_processing_operations.sql` (dòng 42) và `cloud_seed_data.json` chỉ cấp cho `order_processor` 2 quyền `order_processing.orders.read` và `order_processing.tasks.update`. Do đó `UC_FUL_02` (Xác nhận tiếp nhận đơn trực tuyến) chỉ nối với `Quản lý` (và `Quản trị viên` kế thừa), không nối với `Nhân viên xử lý đơn`.

---

## 2. Ma trận Chi tiết: Actor — Use Case — Permission — Source Code — Trạng thái

### 2.1. Sơ đồ Tổng quát (`usecase-overview.puml`)

| Actor | Mã & Tên Use Case | Permission yêu cầu | Source Code chứng minh | Trạng thái |
|---|---|---|---|---|
| Nhân viên bán hàng, Quản trị viên | `UC_OV_01` — Bán hàng tại quầy POS | `pos.sessions.manage`, `pos.products.read`, `pos.sales.create`, `pos.sales.read`, `pos.sales.void` | `Backend/src/routes/pos.routes.js`, `Frontend_Web/src/pages/PosPage.jsx` | Đã triển khai |
| Quản trị viên | `UC_OV_02` — Quản trị tài khoản và phân quyền | `auth.users.*`, `auth.roles.*`, `auth.permissions.read` + `requireRole('admin')` (phân kho) | `Backend/src/routes/auth.routes.js`, `Frontend_Web/src/pages/UsersPage.jsx` | Đã triển khai |
| Quản lý *(Quản trị viên kế thừa)* | `UC_OV_03` — Quản lý sản phẩm, danh mục và kho hàng | `manager.categories.*`, `manager.products.*`, `manager.warehouses.*` | `Backend/src/routes/manager.routes.js`, `Frontend_Web/src/pages/ProductsPage.jsx` | Đã triển khai |
| Quản lý *(Quản trị viên kế thừa)* | `UC_OV_04` — Báo cáo doanh thu và trao đổi dữ liệu | `manager.dashboard.read`, `manager.reports.read`, `data_exchange.import`, `data_exchange.export`, `data_exchange.jobs.read` | `Backend/src/routes/manager.routes.js`, `data-exchange.routes.js`, `DashboardPage.jsx`, `DataExchangePage.jsx` | Đã triển khai |
| Quản lý *(Quản trị viên kế thừa)*, Nhân viên giao hàng | `UC_OV_05` — Quản lý vận đơn và giao nhận | `shipping.shipments.create`, `assign`, `read`, `update` | `Backend/src/routes/shipping.routes.js`, `Frontend_Mobile/karat_app/lib/features/shipper/` | Đã triển khai |
| Quản lý *(Quản trị viên kế thừa)*, Nhân viên kho | `UC_OV_06` — Quản lý tồn kho và điều chỉnh tồn | `manager.inventory.read`, `manager.inventory.adjust`, `warehouse.inventory.read` | `Backend/src/routes/manager.routes.js`, `warehouse.routes.js`, `InventoryPage.jsx` | Đã triển khai |
| Quản lý *(Quản trị viên kế thừa)*, Nhân viên kho, Camera IoT ESP32-S3 | `UC_OV_07` — Nhập xuất kho và đối soát mã QR | `warehouse.documents.*`, `manager.documents.read`, `X-Device-Token` | `Backend/src/routes/warehouse.routes.js`, `manager.routes.js`, `WarehouseApprovalsPage.jsx`, `ESP32_S3_Camera_QR.ino` | Đã triển khai |
| Quản lý *(Quản trị viên kế thừa)*, Nhân viên xử lý đơn, Nhân viên kho | `UC_OV_08` — Tiếp nhận, lấy hàng và đóng gói đơn | `order_processing.orders.*`, `order_processing.tasks.update`, `warehouse.orders.*` | `Backend/src/routes/order-processing.routes.js`, `warehouse.routes.js`, `OrdersPage.jsx`, `pack_order_screen.dart` | Đã triển khai |
| Quản lý *(Quản trị viên kế thừa)*, Dịch vụ AI Dự báo nhu cầu | `UC_OV_09` — Dự báo nhu cầu AI và cảnh báo thiếu hàng | `forecasting.run`, `forecasting.read`, `forecasting.alerts.read`, `X-Service-Token` | `Backend/src/routes/forecasting.routes.js`, `Forecasting/src/api/main.py`, `ForecastingPage.jsx` | Đã triển khai |
| Khách hàng, Quản lý *(Quản trị viên kế thừa)* | `UC_OV_10` — Đối soát thanh toán và hoàn tiền | `payments.customer.manage`, `payments.transfers.read`, `payments.transfers.review`, `payments.refunds.confirm` | `Backend/src/routes/payment.routes.js`, `Backend/src/services/payment.service.js` | Đã triển khai |
| Khách hàng, Quản trị viên | `UC_OV_11` — Mua sắm và đặt hàng trực tuyến | `customer.catalog.read`, `customer.cart.manage`, `customer.addresses.manage`, `customer.orders.*` | `Backend/src/routes/customer.routes.js`, `ShopPage.jsx`, `Frontend_Mobile/.../customer/` | Đã triển khai |
| Khách hàng *(và mọi người dùng)*, Dịch vụ Email OTP | `UC_OV_12` — Đăng ký, đăng nhập và khôi phục mật khẩu | Public endpoints (`/auth/login`, `/register/*`, `/forgot-password`, `/reset-password`) | `Backend/src/routes/auth.routes.js`, `LoginPage.jsx`, `email.js` | Đã triển khai |

---

### 2.2. Phân hệ 01: Tài khoản, Xác thực và Phân quyền (`01-tai-khoan-va-phan-quyen.puml`)

| Actor | Mã & Tên Use Case | Permission / Middleware | Source Code chứng minh | Trạng thái |
|---|---|---|---|---|
| Khách hàng | `UC_AUTH_01` — Đăng ký tài khoản khách hàng | Public (`loginRateLimit`) — chỉ tạo role `customer` | `auth.routes.js` (`POST /register`), `auth.service.js` (`register`), `LoginPage.jsx`, `register_screen.dart` | Đã triển khai |
| Khách hàng, Người dùng hệ thống, Dịch vụ Email OTP | `UC_AUTH_02` — Xác thực mã OTP qua Email (`<<include>>`) | Public (`loginRateLimit`) + `verifySavedOtp` | `auth.routes.js` (`POST /register/send-otp`), `auth.service.js` (`sendRegisterOtp`, `verifySavedOtp`), `utils/email.js` | Đã triển khai |
| Người dùng hệ thống *(mọi vai trò)* | `UC_AUTH_03` — Đăng nhập hệ thống | Public (`loginRateLimit`) -> cấp JWT `Bearer` | `auth.routes.js` (`POST /login`), `auth.service.js` (`login`), `LoginPage.jsx`, `login_screen.dart` | Đã triển khai |
| Người dùng hệ thống *(mọi vai trò)* | `UC_AUTH_04` — Khôi phục mật khẩu quên | Public (`loginRateLimit`) | `auth.routes.js` (`POST /forgot-password`, `POST /reset-password`), `auth.service.js` (`resetPasswordWithOtp`) | Đã triển khai |
| Người dùng hệ thống *(mọi vai trò)* | `UC_AUTH_05` — Xem thông tin tài khoản cá nhân | `authenticate` (JWT hợp lệ) | `auth.routes.js` (`GET /me`), `auth.controller.js` (`me`), `profile_screen.dart` | Đã triển khai |
| Quản trị viên | `UC_AUTH_06` — Quản lý tài khoản người dùng | `auth.users.read`, `auth.users.create`, `auth.users.update` | `auth.routes.js` (`GET/POST/PATCH /users`), `UsersPage.jsx` | Đã triển khai |
| Quản trị viên | `UC_AUTH_07` — Phân công kho làm việc cho nhân sự | `requireRole('admin')` + `auth.users.read`, `auth.users.update` | `auth.routes.js` (`GET/PUT /users/:userId/warehouses`), `warehouse-access.controller.js` | Đã triển khai |
| Quản trị viên | `UC_AUTH_08` — Quản lý vai trò hệ thống | `auth.roles.read`, `auth.roles.create`, `auth.roles.update` | `auth.routes.js` (`GET/POST/PATCH /roles`), `UsersPage.jsx` | Đã triển khai |
| Quản trị viên | `UC_AUTH_09` — Thiết lập quyền hạn cho vai trò | `auth.roles.update` | `auth.routes.js` (`PUT /roles/:roleId/permissions`), `UsersPage.jsx` | Đã triển khai |
| Quản trị viên | `UC_AUTH_10` — Tra cứu danh mục quyền hạn | `auth.permissions.read` | `auth.routes.js` (`GET /permissions`), `UsersPage.jsx` | Đã triển khai |

---

### 2.3. Phân hệ 02: Sản phẩm, Danh mục và Thiết lập Kho (`02-san-pham-danh-muc-va-kho.puml`)

| Actor | Mã & Tên Use Case | Permission / Middleware | Source Code chứng minh | Trạng thái |
|---|---|---|---|---|
| Quản lý, Quản trị viên | `UC_CAT_01` — Quản lý danh mục sản phẩm | `requireRole('admin', 'manager')` + `manager.categories.read`, `manager.categories.manage` | `manager.routes.js` (`GET/POST/PATCH /categories`), `category.service.js`, `ProductsPage.jsx` | Đã triển khai |
| Quản lý, Quản trị viên | `UC_CAT_02` — Thêm mới sản phẩm và mã SKU | `requireRole('admin', 'manager')` + `manager.products.manage` | `manager.routes.js` (`POST /products`), `manager.service.js` (`addProduct`), `ProductsPage.jsx` | Đã triển khai |
| Quản lý, Quản trị viên | `UC_CAT_03` — Cập nhật giá, ngưỡng tồn và trạng thái bán | `requireRole('admin', 'manager')` + `manager.products.manage` | `manager.routes.js` (`PATCH /products/:productId`), `manager.service.js` (`editProduct`), `ProductsPage.jsx` | Đã triển khai |
| Quản lý, Quản trị viên | `UC_CAT_04` — Tra cứu danh sách sản phẩm | `requireRole('admin', 'manager')` + `manager.products.read` | `manager.routes.js` (`GET /products`), `ProductsPage.jsx` | Đã triển khai |
| Quản lý, Quản trị viên | `UC_CAT_05` — Thiết lập và cập nhật kho hàng | `requireRole('admin', 'manager')` + `manager.warehouses.manage` | `manager.routes.js` (`POST/PATCH /warehouses`), `manager.service.js` (`addWarehouse`, `editWarehouse`) | Đã triển khai |
| Quản lý, Quản trị viên | `UC_CAT_06` — Xem danh sách kho vận hành | `requireRole('admin', 'manager')` + `manager.warehouses.read` | `manager.routes.js` (`GET /warehouses`), `InventoryPage.jsx` | Đã triển khai |
| Khách hàng, Nhân viên kho | `UC_CAT_07` — Tra cứu sản phẩm đang kinh doanh | Public `/api/v1/catalog/*` hoặc `customer.catalog.read` | `catalog.routes.js` (`GET /products`, `GET /categories`), `warehouse_service.dart` (`getCatalogProducts`) | Đã triển khai |

---

### 2.4. Phân hệ 03: Nhập kho, Xuất kho và Đối soát QR/IoT (`03-nhap-xuat-kho-va-doi-soat-qr.puml`)

| Actor | Mã & Tên Use Case | Permission / Middleware | Source Code chứng minh | Trạng thái |
|---|---|---|---|---|
| Nhân viên kho, Quản lý, Quản trị viên | `UC_WH_01` — Lập phiếu yêu cầu nhập kho | `warehouse.documents.create` (App Kho) hoặc `manager.documents.read` (`POST /manager/documents` từ AI Web) | `warehouse.routes.js` (`POST /documents`), `manager.routes.js` (`POST /documents`), `warehouse_documents_screen.dart`, `ForecastingPage.jsx` | Đã triển khai |
| Nhân viên kho, Quản trị viên | `UC_WH_02` — Lập phiếu yêu cầu xuất kho | `requireRole('admin', 'warehouse', 'manager')` + `warehouse.documents.create` | `warehouse.routes.js` (`POST /documents` với `type='issue'`), `warehouse_documents_screen.dart` | Đã triển khai |
| Nhân viên kho, Quản lý, Quản trị viên | `UC_WH_03` — Tra cứu và xem chi tiết chứng từ kho | `warehouse.documents.read` hoặc `manager.documents.read` | `warehouse.routes.js` (`GET /documents`, `/:documentId`), `manager.routes.js`, `WarehouseApprovalsPage.jsx` | Đã triển khai |
| Quản lý, Quản trị viên | `UC_WH_04` — Phê duyệt phiếu và sinh mã QR đối soát | `requireRole('admin', 'manager')` + `warehouse.documents.approve` | `manager.routes.js` (`POST /documents/:documentId/approve`), `warehouse.model.js` (`approveDocument` sinh `DOC:<number>`) | Đã triển khai |
| Quản lý, Quản trị viên | `UC_WH_05` — Từ chối yêu cầu nhập xuất kho | `requireRole('admin', 'manager')` + `warehouse.documents.approve` | `manager.routes.js` (`POST /documents/:documentId/reject`), `warehouse.model.js` (`rejectDocument`) | Đã triển khai |
| Nhân viên kho, Camera IoT ESP32-S3, Quản lý, Quản trị viên | `UC_WH_06` — Quét mã QR phiếu kho đối soát | `warehouse.documents.read` / `manager.documents.read` / `X-Device-Token` | `warehouse.routes.js` (`GET /documents/lookup`), `warehouse.controller.js` (`lookupByQr`), `ESP32_S3_Camera_QR.ino` (`queryBackendDocument`), `IotCameraScannerModal.jsx`, `warehouse_scan_screen.dart` | Đã triển khai |
| Nhân viên kho, Quản trị viên | `UC_WH_07` — Quét mã SKU kiểm đếm dòng hàng trong phiếu (`<<extend>>`) | `warehouse.documents.complete` | `warehouse.routes.js` (`POST /documents/:documentId/scan`, `GET /check`), `document-scan.model.js` | Đã triển khai |
| Nhân viên kho, Quản trị viên | `UC_WH_08` — Xác nhận hoàn tất nhập xuất và cập nhật tồn | `warehouse.documents.complete` | `warehouse.routes.js` (`POST /documents/:documentId/complete`), `warehouse.model.js` (`completeDocument`), `warehouse_documents_screen.dart` | Đã triển khai |
| Camera IoT ESP32-S3, Quản lý, Quản trị viên | `UC_WH_09` — Đồng bộ cấu hình Wi-Fi và trạng thái Camera IoT | `X-Device-Token` (Heartbeat) / `manager.documents.read` (Web IoT Sync) | `warehouse.routes.js` (`/iot/heartbeat`, `/iot/status`, `/iot/sync-pc-wifi`), `iot-wifi-sync.service.js`, `IotCameraScannerModal.jsx`, `ESP32_S3_Camera_QR.ino` | Đã triển khai |

---

### 2.5. Phân hệ 04: Tồn kho, Cảnh báo Tồn thấp và Điều chỉnh Tồn (`04-ton-kho-va-dieu-chinh-ton.puml`)

| Actor | Mã & Tên Use Case | Permission / Middleware | Source Code chứng minh | Trạng thái |
|---|---|---|---|---|
| Quản lý, Quản trị viên, Nhân viên kho, Nhân viên bán hàng | `UC_INV_01` — Tra cứu tồn kho thực tế, giữ chỗ và khả dụng | `manager.inventory.read` / `warehouse.inventory.read` / `pos.products.read` | `manager.routes.js` (`GET /inventory`), `warehouse.routes.js` (`GET /inventory`), `pos.routes.js` (`GET /products`), `InventoryPage.jsx` | Đã triển khai |
| Quản lý, Quản trị viên, Nhân viên kho | `UC_INV_02` — Lọc cảnh báo sản phẩm sắp hết hàng (`<<extend>>`) | `manager.inventory.read` / `warehouse.inventory.read` (`?lowStock=true`) | `manager.model.js` (`quantity - reserved_quantity <= reorder_level`), `InventoryPage.jsx`, `warehouse_inventory_screen.dart` | Đã triển khai |
| Nhân viên kho, Quản trị viên | `UC_INV_03` — Quét mã SKU tra cứu nhanh tồn kho kệ | `warehouse.inventory.read` | `warehouse.routes.js` (`GET /scan`), `warehouse_scan_screen.dart` (`scanProduct`) | Đã triển khai |
| Quản lý, Quản trị viên | `UC_INV_04` — Điều chỉnh tăng giảm tồn kho | `requireRole('admin', 'manager')` + `manager.inventory.adjust` | `manager.routes.js` (`POST /inventory/adjustments`), `AdjustStockModal.jsx` | Đã triển khai |
| Quản lý, Quản trị viên | `UC_INV_05` — Xem lịch sử giao dịch biến động tồn kho | `requireRole('admin', 'manager')` + `manager.inventory.read` | `manager.routes.js` (`GET /inventory/transactions`), `manager.model.js` (`listInventoryTransactions`) | Đã triển khai |
| Quản lý, Quản trị viên | `UC_INV_06` — Xem chi tiết lượng tồn giữ chỗ theo đơn hàng | `requireRole('admin', 'manager')` + `manager.inventory.read` | `manager.routes.js` (`GET /inventory/:warehouseId/:productId/reservations`) | Đã triển khai |
| Quản lý, Quản trị viên | `UC_INV_07` — Đối soát sai lệch tồn giữ chỗ (Discrepancies) | `requireRole('admin', 'manager')` + `manager.inventory.read` | `manager.routes.js` (`GET /inventory/discrepancies`), view `inventory_reservation_discrepancies` | Đã triển khai |

---

### 2.6. Phân hệ 05: Bán hàng Tại quầy POS (`05-ban-hang-pos.puml`)

| Actor | Mã & Tên Use Case | Permission / Middleware | Source Code chứng minh | Trạng thái |
|---|---|---|---|---|
| Nhân viên bán hàng, Quản trị viên | `UC_POS_01` — Mở ca bán hàng POS | `pos.sessions.manage` + `requireWarehouseAccess('body')` | `pos.routes.js` (`POST /sessions/open`, `GET /sessions/current`), `OpenShiftModal.jsx` | Đã triển khai |
| Nhân viên bán hàng, Quản trị viên | `UC_POS_02` — Chốt và đóng ca POS | `pos.sessions.manage` + `requireWarehouseAccess('session')` | `pos.routes.js` (`POST /sessions/:sessionId/close`), `CloseShiftModal.jsx` | Đã triển khai |
| Nhân viên bán hàng, Quản trị viên | `UC_POS_03` — Tra cứu và quét mã SKU sản phẩm POS | `pos.products.read` + `requireWarehouseAccess('query')` | `pos.routes.js` (`GET /products`, `GET /products/lookup`), `PosPage.jsx` (`handleSkuSearch`) | Đã triển khai |
| Nhân viên bán hàng, Quản trị viên | `UC_POS_04` — Áp dụng chiết khấu đơn tại quầy (`<<extend>>`) | Thực hiện trong phiên giỏ hàng POS (`PosContext`) | `Frontend_Web/src/context/PosContext.jsx`, `PosPage.jsx` (`discountAmount`), `PaymentModal.jsx` | Đã triển khai (Frontend POS) |
| Nhân viên bán hàng, Quản trị viên | `UC_POS_05` — Lập đơn và thanh toán tại quầy POS | `pos.sales.create` + `requireWarehouseAccess('session')` | `pos.routes.js` (`POST /sales`), `pos.model.js` (`createSale`), `PaymentModal.jsx` | Đã triển khai |
| *(Hệ thống thực thi bắt buộc)* | `UC_POS_06` — Trừ tồn kho trực tiếp tại kho quầy (`<<include>>`) | Nội bộ transaction `createSale` | `pos.model.js` (`directDeductStock`), `inventory.service.js` | Đã triển khai |
| Nhân viên bán hàng, Quản trị viên | `UC_POS_07` — Xem lịch sử và phiếu hóa đơn điện tử POS | `pos.sales.read` | `pos.routes.js` (`GET /sales`, `GET /sales/:saleId`), `ReceiptModal.jsx`, `OrdersPage.jsx` | Đã triển khai |
| Nhân viên bán hàng, Quản trị viên | `UC_POS_08` — Hủy giao dịch POS và hoàn tồn kho | `pos.sales.void` + `requireWarehouseAccess('sale')` | `pos.routes.js` (`POST /sales/:saleId/void`), `pos.model.js` (`voidSale`) | Đã triển khai |

---

### 2.7. Phân hệ 06: Mua sắm Trực tuyến, Thanh toán & Đối soát (`06-mua-sam-online-va-thanh-toan.puml`)

| Actor | Mã & Tên Use Case | Permission / Middleware | Source Code chứng minh | Trạng thái |
|---|---|---|---|---|
| Khách hàng, Quản trị viên | `UC_CUS_01` — Xem và tìm kiếm sản phẩm trực tuyến | `customer.catalog.read` | `customer.routes.js` (`GET /catalog`), `ShopPage.jsx`, `catalog_screen.dart` | Đã triển khai |
| Khách hàng, Quản trị viên | `UC_CUS_02` — Quản lý giỏ hàng trực tuyến | `customer.cart.manage` | `customer.routes.js` (`GET /cart`, `PUT /cart/items`, `DELETE /cart/items/:productId`), `ShopPage.jsx`, `cart_screen.dart` | Đã triển khai |
| Khách hàng, Quản trị viên | `UC_CUS_03` — Quản lý sổ địa chỉ nhận hàng | `customer.addresses.manage` | `customer.routes.js` (`GET/POST/PATCH/DELETE /addresses`), `ShopPage.jsx`, `profile_screen.dart` | Đã triển khai |
| Khách hàng, Quản trị viên | `UC_CUS_04` — Đặt hàng trực tuyến (COD / VietQR) | `customer.orders.create` | `customer.routes.js` (`POST /checkout`), `customer.model.js` (`checkout`), `ShopPage.jsx`, `checkout_screen.dart` | Đã triển khai |
| *(Hệ thống thực thi bắt buộc)* | `UC_CUS_05` — Giữ chỗ tồn kho tạm thời (`<<include>>`) | Nội bộ transaction `checkout` | `customer.model.js` (`reserveStock` với `reservation_expires_at`), `inventory.service.js` | Đã triển khai |
| Khách hàng, Quản trị viên | `UC_CUS_06` — Xem hướng dẫn VietQR và gửi mã chuyển khoản (`<<extend>>`) | `payments.customer.manage` | `payment.routes.js` (`GET /orders/:orderId/instructions`, `POST /orders/:orderId/transfers`), `payment.service.js` | Đã triển khai |
| Khách hàng, Quản trị viên | `UC_CUS_07` — Theo dõi lịch sử và tiến trình đơn hàng | `customer.orders.read` | `customer.routes.js` (`GET /orders`, `GET /orders/:orderId`), `ShopPage.jsx`, `order_detail_screen.dart` | Đã triển khai |
| Khách hàng, Quản lý, Quản trị viên | `UC_CUS_08` — Hủy đơn đặt hàng và giải phóng tồn giữ chỗ | `customer.orders.cancel` (Khách) / `manager.orders.cancel` (Quản lý) | `customer.routes.js` (`POST /orders/:orderId/cancel`), `manager.routes.js`, `order-cancellation.model.js` | Đã triển khai |
| Quản lý, Quản trị viên | `UC_CUS_09` — Đối soát và duyệt yêu cầu chuyển khoản ngân hàng | `requireRole('admin', 'manager')` + `payments.transfers.read`, `payments.transfers.review` | `payment.routes.js` (`GET /transfers`, `POST /transfers/:requestId/review`), `payment.model.js` (`reviewTransfer`) | Đã triển khai |
| Quản lý, Quản trị viên | `UC_CUS_10` — Xác nhận hoàn tiền thủ công | `requireRole('admin', 'manager')` + `payments.refunds.confirm` | `payment.routes.js` (`POST /orders/:orderId/refund`), `payment.model.js` (`confirmRefund`) | Đã triển khai |

---

### 2.8. Phân hệ 07: Xử lý Đơn hàng, Đóng gói và Giao nhận (`07-xu-ly-don-dong-goi-va-giao-nhan.puml`)

| Actor | Mã & Tên Use Case | Permission / Middleware | Source Code chứng minh | Trạng thái |
|---|---|---|---|---|
| Quản lý, Quản trị viên, Nhân viên xử lý đơn, Nhân viên kho | `UC_FUL_01` — Tra cứu danh sách và tiến trình đơn hàng | `manager.orders.read` / `order_processing.orders.read` / `warehouse.orders.read` | `manager.routes.js`, `order-processing.routes.js`, `warehouse.routes.js`, `OrdersPage.jsx`, `warehouse_orders_screen.dart` | Đã triển khai |
| Quản lý, Quản trị viên | `UC_FUL_02` — Xác nhận tiếp nhận đơn trực tuyến | `order_processing.orders.confirm` | `order-processing.routes.js` (`POST /orders/:orderId/confirm`), `StateActions.jsx` | Đã triển khai |
| Quản lý, Quản trị viên | `UC_FUL_03` — Phân công nhân viên xử lý đơn | `requireRole('admin', 'manager')` + `order_processing.orders.assign` | `order-processing.routes.js` (`POST /orders/:orderId/assign`), `order-processing.model.js` (`assignOrder`) | Đã triển khai |
| Quản lý, Quản trị viên, Nhân viên xử lý đơn | `UC_FUL_04` — Cập nhật trạng thái lấy hàng và sẵn sàng đóng gói | `order_processing.tasks.update` | `order-processing.routes.js` (`PATCH /orders/:orderId/task`), `StateActions.jsx` | Đã triển khai |
| Nhân viên kho, Quản trị viên | `UC_FUL_05` — Quét mã SKU kiểm tra sản phẩm theo dòng đơn (`<<include>>`) | `warehouse.orders.scan` | `warehouse.routes.js` (`POST /orders/:orderId/scan`, `GET /check`), `pack_order_screen.dart` | Đã triển khai |
| Nhân viên kho, Quản lý, Quản trị viên | `UC_FUL_06` — Đóng gói kiện hàng và khấu trừ tồn giữ chỗ | `warehouse.orders.pack` | `warehouse.routes.js` (`POST /orders/:orderId/pack`), `warehouse.model.js` (`packOrder`), `pack_order_screen.dart`, `StateActions.jsx` | Đã triển khai |
| Quản lý, Quản trị viên | `UC_FUL_07` — Tạo vận đơn và bàn giao nhân viên giao | `requireRole('admin', 'manager')` + `shipping.shipments.create`, `shipping.shipments.assign` | `shipping.routes.js` (`POST /shipments`), `shipping.model.js` (`createShipment`), `StateActions.jsx` | Đã triển khai |
| Nhân viên giao hàng, Quản lý, Quản trị viên | `UC_FUL_08` — Quét mã vận đơn và xem chi tiết giao hàng | `shipping.shipments.read` | `shipping.routes.js` (`GET /scan`, `GET /shipments`, `/:shipmentId`), `shipper_scan_screen.dart`, `shipment_detail_screen.dart` | Đã triển khai |
| Nhân viên giao hàng, Quản lý, Quản trị viên | `UC_FUL_09` — Cập nhật trạng thái giao hàng (Nhận/Giao/Hoàn) | `shipping.shipments.update` | `shipping.routes.js` (`PATCH /shipments/:shipmentId/status`), `shipment_detail_screen.dart`, `StateActions.jsx` | Đã triển khai |
| Nhân viên kho, Quản lý, Quản trị viên | `UC_FUL_10` — Tiếp nhận hàng hoàn trả và nhập lại kho | `warehouse.orders.returns` | `warehouse.routes.js` (`POST /orders/:orderId/return-receipt`), `warehouse-workflow.model.js` (`receiveOrderReturn`) | Đã triển khai |

---

### 2.9. Phân hệ 08: AI Dự báo Nhu cầu, Báo cáo & Trao đổi Dữ liệu (`08-ai-du-bao-bao-cao-va-du-lieu.puml`)

| Actor | Mã & Tên Use Case | Permission / Middleware | Source Code chứng minh | Trạng thái |
|---|---|---|---|---|
| Quản lý, Quản trị viên, Dịch vụ AI Dự báo nhu cầu | `UC_RPT_01` — Khởi chạy mô hình dự báo nhu cầu AI | `requireRole('admin', 'manager')` + `forecasting.run` + `X-Service-Token` | `forecasting.routes.js` (`POST /runs`), `forecasting-python.service.js`, `Forecasting/src/api/main.py`, `CreateForecastModal.jsx` | Đã triển khai |
| Quản lý, Quản trị viên | `UC_RPT_02` — Xem kết quả và chỉ số đánh giá dự báo (MAE/RMSE) | `requireRole('admin', 'manager')` + `forecasting.read` | `forecasting.routes.js` (`GET /runs`, `GET /runs/:runId`), `ForecastingPage.jsx`, `ForecastDetailModal.jsx` | Đã triển khai |
| Quản lý, Quản trị viên | `UC_RPT_03` — Xem cảnh báo nguy cơ thiếu hàng theo dự báo | `requireRole('admin', 'manager')` + `forecasting.alerts.read` | `forecasting.routes.js` (`GET /alerts`), `forecasting.service.js` (`alerts`), `ForecastingPage.jsx` | Đã triển khai |
| Quản lý, Quản trị viên | `UC_RPT_04` — Lập phiếu nhập đề xuất tự động từ dự báo AI (`<<extend>>`) | `manager.documents.read` (`POST /manager/documents`) | `ForecastingPage.jsx` (`handleCreateBatchReplenishDoc` dòng 311–347), `manager.routes.js` (dòng 30) | Đã triển khai |
| Quản lý, Quản trị viên | `UC_RPT_05` — Xem bảng tổng quan kinh doanh (Dashboard) | `requireRole('admin', 'manager')` + `manager.dashboard.read` | `manager.routes.js` (`GET /dashboard`), `DashboardPage.jsx` | Đã triển khai |
| Quản lý, Quản trị viên | `UC_RPT_06` — Xem báo cáo doanh thu đa kênh và theo ngày | `requireRole('admin', 'manager')` + `manager.reports.read` | `manager.routes.js` (`GET /reports/sales`), `DashboardPage.jsx` | Đã triển khai |
| Quản lý, Quản trị viên | `UC_RPT_07` — Nhập dữ liệu hàng loạt từ file Excel / CSV | `requireRole('admin', 'manager')` + `data_exchange.import` | `data-exchange.routes.js` (`POST /import/:dataType`), `DataExchangePage.jsx` | Đã triển khai |
| Quản lý, Quản trị viên | `UC_RPT_08` — Xuất dữ liệu và báo cáo ra Excel / CSV | `requireRole('admin', 'manager')` + `data_exchange.export` | `data-exchange.routes.js` (`GET /export/:dataType`), `DataExchangePage.jsx` | Đã triển khai |
| Quản lý, Quản trị viên | `UC_RPT_09` — Tra cứu lịch sử tác vụ nhập xuất dữ liệu | `requireRole('admin', 'manager')` + `data_exchange.jobs.read` | `data-exchange.routes.js` (`GET /jobs`), `DataExchangePage.jsx` | Đã triển khai |

---

## 3. Báo cáo Đối chiếu 16 Hạng mục Khảo sát (Loại trừ các Chức năng Chưa Triển khai)

Tuân thủ tuyệt đối **Nguyên tắc 3 & 4 (Phần I)**: *Chỉ vẽ chức năng có căn cứ từ source code, không tự tạo nghiệp vụ chưa triển khai*:

| STT | Hạng mục khảo sát trong yêu cầu | Kết quả xác minh Source Code | Quyết định mô hình hóa UML |
|---|---|---|---|
| 1 | Tài khoản và phân quyền | Có đầy đủ bảng `users`, `roles`, `permissions`, `role_permissions`, `user_warehouses`, OTP Email, JWT, trang `UsersPage.jsx` | Đưa vào **Phân hệ 01** |
| 2 | Sản phẩm và danh mục | Có đầy đủ bảng `categories`, `products` (SKU, barcode, giá vốn, giá bán, `reorder_level`), trang `ProductsPage.jsx` | Đưa vào **Phân hệ 02** |
| 3 | Nhà cung cấp | **Chưa có bảng `suppliers` hay API/UI quản lý nhà cung cấp độc lập**; chỉ có một cột chuỗi văn bản tùy chọn `supplier_name VARCHAR(150)` trong `warehouse_documents` (`003_warehouse_operations.sql` dòng 7) | **KHÔNG tạo Use Case Quản lý nhà cung cấp** (ghi nhận là thuộc tính của phiếu nhập kho) |
| 4 | Nhập kho | Có đầy đủ quy trình tạo phiếu `receipt` (`pending` → `approved` sinh QR → quét QR IoT/App → `completed` cộng tồn) | Đưa vào **Phân hệ 03** |
| 5 | Xuất kho FEFO | Có xuất kho (`type = 'issue'`) và trừ tồn theo sản phẩm/kho, nhưng **KHÔNG có bảng lô hàng (`batches`/`lots`), KHÔNG có ngày hết hạn sản phẩm, KHÔNG có thuật toán FEFO** trong toàn bộ codebase | **KHÔNG vẽ Xuất kho theo FEFO**; chỉ vẽ đúng **Xuất kho & Đối soát QR** thực tế trong **Phân hệ 03** |
| 6 | Tồn kho và kiểm kê | Có quản lý tồn kho thực tế, giữ chỗ (`reserved_quantity`), khả dụng, cảnh báo chạm `reorder_level`, đối soát sai lệch giữ chỗ (`discrepancies`), và điều chỉnh tồn kho kiểm kê (`adjustments`) | Đưa vào **Phân hệ 04** |
| 7 | Chuyển kho | **KHÔNG có chức năng chuyển kho nội bộ**. Migration `020_single_central_warehouse_setup.sql` chủ đích chuyển hệ thống về mô hình 1 kho trung tâm duy nhất (`WH-HCM-01`) | **KHÔNG vẽ Use Case Chuyển kho** |
| 8 | Bán hàng POS | Có đầy đủ mở/đóng ca (`pos_sessions`), tìm/quét SKU, giỏ hàng POS, chiết khấu đơn tại quầy, thanh toán, trừ tồn trực tiếp, hủy đơn POS (`void`) | Đưa vào **Phân hệ 05** |
| 9 | Hóa đơn và thanh toán | Có hóa đơn điện tử K80/E-AWB (`ReceiptModal.jsx`, `OrderDetailModal.jsx`), thanh toán tiền mặt/thẻ/VietQR, gửi mã chuyển khoản, đối soát chuyển khoản (`bank_transfer_requests`) và xác nhận hoàn tiền (`manual_refunds`) | Đưa vào **Phân hệ 05 & Phân hệ 06** |
| 10 | RFID và Barcode | **KHÔNG có phần cứng hay giao thức RFID** trong source code. **CÓ đầy đủ QR Code & Barcode/SKU**: Camera IoT ESP32-S3 OV5640 (`quirc`), Webcam `BarcodeDetector`, Flutter `mobile_scanner` cho phiếu kho, sản phẩm và vận đơn | **KHÔNG vẽ RFID**; mô hình hóa chính xác **Quét QR/Barcode & Camera IoT ESP32-S3** trong **Phân hệ 03, 04, 05, 07** |
| 11 | Quản lý hạn sử dụng | **KHÔNG có cột `expiry_date` / `manufacture_date` cho sản phẩm/lô hàng** (chỉ có `reservation_expires_at` là thời hạn giữ chỗ giỏ/đơn online chưa thanh toán) | **KHÔNG vẽ Use Case Quản lý hạn sử dụng** |
| 12 | Cảnh báo cận hạn/hết hạn | **KHÔNG có cảnh báo cận hạn/hết hạn sử dụng**; hệ thống chỉ triển khai **Cảnh báo tồn kho thấp (`lowStock <= reorder_level`)** và **Cảnh báo nguy cơ thiếu hàng theo AI dự báo** | **KHÔNG vẽ Cảnh báo cận hạn/hết hạn**; mô hình hóa đúng Cảnh báo thiếu hàng/tồn thấp |
| 13 | Khuyến mãi và giảm giá | **KHÔNG có bảng `promotions` / `vouchers` / `coupons` hay API quản lý chương trình khuyến mãi**. Chỉ có ô nhập **Chiết khấu / Giảm giá trực tiếp** trên màn hình thu ngân `PosPage.jsx` (dòng 422–435) | **KHÔNG vẽ Quản lý khuyến mãi**; chỉ mô hình hóa `UC_POS_04` (*Áp dụng chiết khấu đơn tại quầy*) dạng `<<extend>>` trong POS |
| 14 | AI dự báo nhu cầu | Có đầy đủ microservice Python FastAPI + mô hình `LightGBM` 15 đặc trưng (`Forecasting/src/api/main.py`) + fallback `Moving Average 7d`, lưu `forecast_runs`, `forecast_values`, cảnh báo thiếu hụt và lập phiếu nhập đề xuất từ AI | Đưa vào **Phân hệ 08** |
| 15 | Báo cáo và thống kê | Có Dashboard KPI, báo cáo doanh thu theo kênh (`pos`, `web`, `mobile`) và theo ngày, xuất CSV/Excel (`DashboardPage.jsx`, `DataExchangePage.jsx`) | Đưa vào **Phân hệ 08** |
| 16 | Cấu hình và quản trị hệ thống | Có quản trị người dùng, vai trò, ma trận quyền hạn, phân quyền kho nhân sự, thiết lập kho hàng, đồng bộ cấu hình Wi-Fi cho trạm Camera IoT ESP32-S3 và nhập/xuất dữ liệu hàng loạt | Đưa vào **Phân hệ 01, 02, 03, 08** |
