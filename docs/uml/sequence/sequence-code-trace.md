# Báo Cáo Đối Chiếu Sequence Diagram Với Source Code

Tài liệu này truy vết từng message quan trọng trong 6 sơ đồ tuần tự (`docs/uml/sequence/source/*.puml`) tới file, hàm, middleware, nhánh điều kiện và mã HTTP thực tế trong source code.

---

## 1. `seq-01-dang-ky-va-xac-thuc-otp.puml` — Đăng ký bằng Email OTP & Đăng nhập

| STT | Message | Bên gọi | Bên nhận | File/hàm nguồn | Điều kiện | Kết quả |
|---|---|---|---|---|---|---|
| 1 | `POST /api/v1/auth/register/send-otp` | `LoginPage.jsx` | `AuthController` (`auth.controller.js::sendRegisterOtp`) | `Backend/src/routes/auth.routes.js`, `auth.controller.js` | Không yêu cầu JWT | Chuyển tiếp `{ email }` sang `authService.sendRegisterOtp` |
| 2 | `sendRegisterOtp({ email })` | `AuthController` | `AuthService` (`auth.service.js::sendRegisterOtp`) | `Backend/src/services/auth.service.js` | Kiểm tra định dạng email và `SELECT id FROM users` | Ném `AppError(400 / 409)` nếu sai/trùng; ngược lại tạo OTP 6 số, băm SHA-256, lưu `email_otp_verifications` |
| 3 | `sendOtpEmail(email, otp, 'register')` | `AuthService` | `Email Service` (`email.js::sendOtpEmail`) | `Backend/src/utils/email.js` | Sau khi lưu OTP thành công | Gửi qua Resend API hoặc SMTP fallback, trả `{ sent, provider }` |
| 4 | `POST /api/v1/auth/register` | `LoginPage.jsx` | `AuthController` (`auth.controller.js::register`) | `Backend/src/controllers/auth.controller.js` | Nhận `{ fullName, email, password, otp }` | Trả `201 Created` (`{ data: { token, user } }`) |
| 5 | `register(payload)` | `AuthController` | `AuthService` (`auth.service.js::register`) | `Backend/src/services/auth.service.js` | Khóa `email_otp_verifications FOR UPDATE`, kiểm tra hạn & số lần thử (<= 5) | Ném `AppError(400 / 409)` nếu sai OTP; ngược lại `INSERT users` (mật khẩu `scrypt`), ký JWT HS256 |
| 6 | `POST /api/v1/auth/login` | `LoginPage.jsx` | `AuthController` (`auth.controller.js::login`) | `Backend/src/controllers/auth.controller.js` | Nhận `{ email, password }` | Trả `200 OK` (`{ data: { token, user } }`) |
| 7 | `login({ email, password })` | `AuthController` | `AuthService` (`auth.service.js::login`) | `Backend/src/services/auth.service.js` | Kiểm tra user tồn tại, mật khẩu `scrypt`, trạng thái khóa | Ném `AppError(401 / 403)` nếu sai/khóa; ngược lại ký JWT HS256 (7 ngày) |

---

## 2. `seq-02-ban-hang-pos.puml` — Bán hàng tại quầy (POS)

| STT | Message | Bên gọi | Bên nhận | File/hàm nguồn | Điều kiện | Kết quả |
|---|---|---|---|---|---|---|
| 1 | `POST /api/v1/pos/sessions/open` | `PosPage.jsx` | `Auth & Warehouse Middleware` | `Backend/src/routes/pos.routes.js`, `auth.middleware.js`, `warehouse-access.middleware.js` | `Bearer JWT`, quyền `pos.sessions.manage`, tự gán `WH-HCM-01` | Gắn `request.user` và chuyển tiếp `PosController.openSession` |
| 2 | `openSession({ warehouseId, userId, openingCash })` | `PosService` | `PosModel` (`pos.model.js::openSession`) | `Backend/src/controllers/pos.controller.js`, `pos.model.js` | Kiểm tra chưa có ca `open` | `INSERT pos_sessions (status='open')`, Controller trả `201 Created` |
| 3 | `GET /api/v1/pos/products/lookup` | `PosPage.jsx` | `PosController` (`pos.controller.js::lookupProduct`) | `Backend/src/routes/pos.routes.js`, `pos.model.js::findProductByIdentifier` | Quyền `pos.orders.read` | `SELECT products LEFT JOIN inventory`, trả `200 OK` hoặc `404` |
| 4 | `POST /api/v1/pos/sales` | `PaymentModal.jsx` | `PosController` (`pos.controller.js::createSale`) | `Backend/src/controllers/pos.controller.js`, `pos.service.js::create` | Quyền `pos.orders.create`, kiểm tra `Idempotency-Key` | Trả `201 Created` (`{ data: saleDetail }`) |
| 5 | `createSale(payload)` | `PosService` | `PosModel` (`pos.model.js::createSale`) | `Backend/src/models/pos.model.js`, `utils/idempotency.js` | `startIdempotency`; kiểm tra ca `open` (`404/409`) | Replay đơn cũ nếu trùng key; ngược lại `INSERT orders (channel='pos', status='delivered')` & `order_items` |
| 6 | `directDeductStock(...)` | `PosModel` | `Database` | `Backend/src/services/inventory.service.js::directDeductStock` | Khóa `inventory` bằng `UPDLOCK, ROWLOCK` | Ném `AppError(409)` nếu `available < quantity`; ngược lại trừ `quantity`, ghi `inventory_transactions` (`type='issue'`) |

---

## 3. `seq-03-dat-hang-online-va-giu-cho.puml` — Đặt hàng trực tuyến & Đối soát VietQR

| STT | Message | Bên gọi | Bên nhận | File/hàm nguồn | Điều kiện | Kết quả |
|---|---|---|---|---|---|---|
| 1 | `POST /api/v1/customer/checkout` | `ShopPage.jsx` / `CustomerApp` | `CustomerController` (`customer.controller.js::checkout`) | `Backend/src/routes/customer.routes.js`, `customer.controller.js` | `Bearer JWT`, `Idempotency-Key` | Trả `201 Created` (`{ data: orderDetail }`) |
| 2 | `checkout(userId, payload)` | `CustomerService` | `CustomerModel` (`customer.model.js::checkout`) | `Backend/src/models/customer.model.js` | Kiểm tra kho, giỏ hàng, địa chỉ, sản phẩm active | Ném `400/409` nếu lỗi; ngược lại `INSERT orders (status='pending')` & `order_items` |
| 3 | `reserveStock(...)` | `CustomerModel` | `Database` | `Backend/src/services/inventory.service.js::reserveStock` | Khóa `inventory` bằng `UPDLOCK, ROWLOCK` | Ném `409` nếu thiếu tồn khả dụng; ngược lại tăng `reserved_quantity` & `INSERT inventory_reservations ('active')` |
| 4 | `POST /api/v1/payments/orders/:orderId/transfer-requests` | `ShopPage.jsx` / `CustomerApp` | `PaymentController` (`payment.controller.js::submit`) | `Backend/src/routes/payment.routes.js`, `payment.controller.js` | Đơn thuộc `userId` và chưa thanh toán | `INSERT bank_transfer_requests (status='pending')`, trả `201 Created` |
| 5 | `PATCH /api/v1/payments/transfer-requests/:requestId/review` | `OrdersPage.jsx` | `PaymentController` (`payment.controller.js::review`) | `Backend/src/controllers/payment.controller.js`, `payment.model.js::reviewTransfer` | Quyền duyệt thanh toán; kiểm tra trùng mã/số tiền/hết hạn (`404/409`) | `INSERT payments`, `UPDATE orders.payment_status='paid'`, xóa `expires_at` giữ chỗ, trả `200 OK` |

---

## 4. `seq-04-phe-duyet-nhap-xuat-va-quet-qr-iot.puml` — Phiếu nhập/xuất & Quét QR IoT ESP32-S3

| STT | Message | Bên gọi | Bên nhận | File/hàm nguồn | Điều kiện | Kết quả |
|---|---|---|---|---|---|---|
| 1 | `POST /api/v1/warehouse/documents` | `Web / Mobile App` | `WarehouseController` (`warehouse.controller.js::createDocument`) | `Backend/src/routes/warehouse.routes.js`, `warehouse.controller.js` | Quyền `warehouse.documents.create` | `INSERT warehouse_documents (status='pending')` & items, trả `201 Created` |
| 2 | `PATCH /api/v1/warehouse/documents/:id/approve` | `WarehouseApprovalsPage.jsx` | `WarehouseController` (`warehouse.controller.js::approveDocument`) | `Backend/src/controllers/warehouse.controller.js`, `warehouse.model.js::approveDocument` | Không được tự duyệt phiếu mình tạo trừ `admin` (`403`); trạng thái `pending/draft` (`409`) | `UPDATE status='approved', qr_code='DOC:'+document_number`, trả `200 OK` |
| 3 | `GET /api/v1/warehouse/documents/lookup?qr=...` | `ESP32-S3` (`ESP32_S3_Camera_QR.ino`) / `Mobile App` | `WarehouseController` (`warehouse.controller.js::lookupByQr`) | `Hardware_IoT/ESP32_S3_Camera_QR/ESP32_S3_Camera_QR.ino`, `auth.middleware.js` | `X-Device-Token` (ESP32-S3) hoặc `Bearer JWT` (App) | `UPDATE qr_scanned_at = NOW()` & trả chi tiết phiếu (`200 OK`) |
| 4 | `POST /api/v1/warehouse/documents/:id/complete` | `Web / Mobile App` | `WarehouseController` (`warehouse.controller.js::completeDocument`) | `Backend/src/controllers/warehouse.controller.js`, `warehouse.model.js::completeDocument` | Phiếu `approved`, đã quét QR (`qr_scanned_at != NULL`), đủ scan sản phẩm nếu yêu cầu (`409`) | Gọi `changeStock` cập nhật `inventory` & ghi `inventory_transactions`, đổi `status='completed'`, trả `200 OK` |

---

## 5. `seq-05-xu-ly-don-dong-goi-va-giao-nhan.puml` — Xử lý đơn, Đóng gói & Giao nhận

| STT | Message | Bên gọi | Bên nhận | File/hàm nguồn | Điều kiện | Kết quả |
|---|---|---|---|---|---|---|
| 1 | `POST /api/v1/order-processing/orders/:id/confirm` | `OrdersPage.jsx` | `OrderProcessingController` (`confirmOrder`) | `Backend/src/controllers/order-processing.controller.js`, `order-processing.model.js` | Đơn đang ở trạng thái `pending` | `transitionOrder(pending -> confirmed)` & tạo `order_processing_tasks`, trả `200 OK` |
| 2 | `PATCH /api/v1/order-processing/orders/:id/task` | `Web / Mobile App` | `OrderProcessingController` (`updateTask`) | `Backend/src/controllers/order-processing.controller.js`, `order-processing.model.js` | Đơn ở trạng thái `confirmed` | `transitionOrder(confirmed -> ready_to_pack)` & cập nhật task, trả `200 OK` |
| 3 | `POST /api/v1/warehouse/orders/:id/pack` | `pack_order_screen.dart` / `Web` | `WarehouseController` (`packOrder`) | `Backend/src/controllers/warehouse.controller.js`, `warehouse.model.js`, `inventory.service.js::consumeReservation` | Đơn `ready_to_pack`, đủ reservation active | Trừ `quantity` & `reserved_quantity`, đóng reservation `'consumed'`, ghi `inventory_transactions`, chuyển `packed` (`200 OK`) |
| 4 | `POST /api/v1/shipping/shipments` | `OrdersPage.jsx` | `ShippingController` (`create`) | `Backend/src/controllers/shipping.controller.js`, `shipping.model.js` | Đơn ở trạng thái `packed` | `INSERT shipments (status='assigned')`, `transitionOrder(packed -> handover)`, trả `201 Created` |
| 5 | `PATCH /api/v1/shipping/shipments/:id/status` | `shipment_detail_screen.dart` | `ShippingController` (`updateStatus`) | `Backend/src/controllers/shipping.controller.js`, `shipping.model.js` | Hợp lệ theo `order-state-machine.js` | `UPDATE shipments`, `transitionOrder(handover -> shipping -> delivered | returned)`, trả `200 OK` |

---

## 6. `seq-06-du-bao-nhu-cau-ai.puml` — Dự báo nhu cầu AI (LightGBM) & Nhập bổ sung

| STT | Message | Bên gọi | Bên nhận | File/hàm nguồn | Điều kiện | Kết quả |
|---|---|---|---|---|---|---|
| 1 | `POST /api/v1/forecasting/run` | `ForecastingPage.jsx` | `ForecastingController` (`run`) | `Backend/src/controllers/forecasting.controller.js`, `forecasting.service.js::run` | Quyền `forecasting.run` | Tổng hợp lịch sử bán & tồn kho, trả `201 Created` (`{ run, values, alerts }`) |
| 2 | `requestPythonForecast(...)` | `ForecastingService` | `ForecastingPythonClient` | `Backend/src/services/forecasting-python.service.js` | Gọi `POST /forecast` kèm `X-Service-Token`, timeout `5000ms` | Trả `{ predictions, modelName }` hoặc `null` khi lỗi/timeout |
| 3 | `POST /forecast` | `ForecastingPythonClient` | `Python FastAPI` (`main.py`) | `Forecasting/src/api/main.py` | Kiểm tra `x_service_token`, `len(history) >= 29` | Dự đoán bằng `model.joblib` (`lightgbm_l1`) hoặc trả `400/401/503` |
| 4 | Fallback trung bình động | `ForecastingService` | `ForecastingService` | `Backend/src/services/forecasting.service.js` | Khi Python FastAPI lỗi / timeout / thiếu dữ liệu | Tính `moving-average-fallback` |
| 5 | Lưu `forecast_runs`, `forecast_values`, `inventory_alerts` | `ForecastingService` | `Database` | `Backend/src/services/forecasting.service.js` | Trong transaction `BEGIN ... COMMIT` | Tạo cảnh báo nếu tồn dự kiến < `reorder_point` |
| 6 | `POST /api/v1/warehouse/documents` | `ForecastingPage.jsx` | `WarehouseController` (`createDocument`) | `ForecastingPage.jsx`, `warehouse.controller.js` | Quản lý chọn tạo phiếu nhập đề xuất từ cảnh báo | Lưu phiếu `receipt` trạng thái `pending` (`201 Created`) |
