# Bảng Truy Vết UML Activity Diagram Với Source Code

Tài liệu này đối chiếu từng bước hoạt động trong 7 sơ đồ Activity Diagram (`docs/uml/activity/source/*.puml`) với file source, hàm xử lý, điều kiện thực tế và kết quả xác minh.

---

## 1. `act-01a-dang-ky-tai-khoan-otp.puml` — Đăng ký tài khoản bằng Email OTP

| Bước trên sơ đồ | File source | Hàm liên quan | Điều kiện/logic thực tế | Kết quả xác minh |
|---|---|---|---|---|
| Nhập họ tên, email, mật khẩu & kiểm tra định dạng | `Frontend_Web/src/pages/LoginPage.jsx` | `handleSendOtp` | Kiểm tra nhập liệu phía client trước khi gọi API | ĐÃ XÁC MINH |
| Kiểm tra email hợp lệ và chưa đăng ký | `Backend/src/services/auth.service.js` | `sendRegisterOtp` | Regex email + `SELECT id FROM users WHERE LOWER(email) = $1`; ném `AppError(400 / 409)` nếu sai hoặc trùng | ĐÃ XÁC MINH |
| Sinh OTP 6 số, băm SHA-256 & lưu DB | `Backend/src/services/auth.service.js` | `generateOtpCode`, `hashOtp`, `sendRegisterOtp` | Vô hiệu hóa OTP cũ, `INSERT email_otp_verifications` (hết hạn 10 phút) trong `withTransaction` | ĐÃ XÁC MINH |
| Gửi email chứa mã OTP | `Backend/src/utils/email.js` | `sendOtpEmail` | Gọi Resend API; fallback SMTP nếu không có Resend | ĐÃ XÁC MINH |
| Khóa và kiểm tra OTP mới nhất | `Backend/src/services/auth.service.js` | `register` | `SELECT ... FOR UPDATE`; kiểm tra tồn tại, chưa hết hạn, `attempts < 5`, khớp `hashOtp`; ném `AppError(400 / 409)` nếu sai | ĐÃ XÁC MINH |
| Tạo tài khoản & trả HTTP 201 | `Backend/src/services/auth.service.js`, `Backend/src/controllers/auth.controller.js` | `register`, `hashPassword`, `signToken` | Băm mật khẩu bằng `scrypt`, gán role `customer`, ký JWT HS256 (7 ngày), Controller trả `201` | ĐÃ XÁC MINH |

---

## 2. `act-01b-dang-nhap-he-thong.puml` — Đăng nhập và Phân quyền hệ thống

| Bước trên sơ đồ | File source | Hàm liên quan | Điều kiện/logic thực tế | Kết quả xác minh |
|---|---|---|---|---|
| Gửi yêu cầu đăng nhập | `Frontend_Web/src/pages/LoginPage.jsx` | `handleLogin` | Gửi `POST /api/v1/auth/login` với `{ email, password }` | ĐÃ XÁC MINH |
| Truy vấn tài khoản, vai trò, quyền và kho | `Backend/src/services/auth.service.js` | `login`, `findUserAuthorization` | `SELECT users JOIN roles`, truy vấn `role_permissions` và `user_warehouses` | ĐÃ XÁC MINH |
| Kiểm tra mật khẩu `scrypt` & trạng thái khóa | `Backend/src/services/auth.service.js` | `login`, `verifyPassword` | Ném `AppError(401)` nếu sai email/mật khẩu; `AppError(403)` nếu tài khoản bị khóa | ĐÃ XÁC MINH |
| Ký JWT & trả HTTP 200 | `Backend/src/services/auth.service.js`, `auth.controller.js` | `signToken`, `login` | Trả `200 OK` gồm `{ token, user }` | ĐÃ XÁC MINH |

---

## 3. `act-02-ban-hang-pos.puml` — Quy trình bán hàng tại quầy (POS)

| Bước trên sơ đồ | File source | Hàm liên quan | Điều kiện/logic thực tế | Kết quả xác minh |
|---|---|---|---|---|
| Xác thực JWT, quyền POS & tự gán kho trung tâm | `Backend/src/middlewares/auth.middleware.js`, `warehouse-access.middleware.js` | `authenticate`, `requirePermission`, `requireWarehouseAccess` | Kiểm tra quyền `pos.sessions.manage` / `pos.orders.create`; tự gán `WH-HCM-01` cho vai trò `sales` | ĐÃ XÁC MINH |
| Kiểm tra / mở ca bán hàng | `Backend/src/controllers/pos.controller.js`, `pos.model.js` | `currentSession`, `openSession` | Kiểm tra ca `open`; nếu chưa có thì `INSERT pos_sessions (status='open')`, trả `201` | ĐÃ XÁC MINH |
| Quét mã vạch / tìm SKU | `Frontend_Web/src/pages/PosPage.jsx`, `Backend/src/models/pos.model.js` | `findProductByIdentifier` | `SELECT products LEFT JOIN inventory`, tính `available = quantity - reserved_quantity` | ĐÃ XÁC MINH |
| Kiểm tra tiền khách đưa | `Frontend_Web/src/components/pos/PaymentModal.jsx` | `handlePayment` | Với `cash`, kiểm tra `customerPaid >= finalTotal` | ĐÃ XÁC MINH |
| Kiểm tra khóa chống trùng lặp (`Idempotency-Key`) | `Backend/src/utils/idempotency.js`, `pos.model.js` | `validateIdempotencyKey`, `startIdempotency`, `createSale` | Nếu đã có `order_id` thì đọc lại đơn cũ và trả `201`; khác payload ném `409` | ĐÃ XÁC MINH |
| Khóa tồn kho & trừ trực tiếp | `Backend/src/services/inventory.service.js`, `pos.model.js` | `directDeductStock`, `lockInventoryRows`, `recordMovement` | `UPDLOCK, ROWLOCK` trên `inventory`; ném `409` nếu `available < quantity`; ngược lại trừ `quantity` và ghi `inventory_transactions` | ĐÃ XÁC MINH |
| Lưu thanh toán & trả HTTP 201 | `Backend/src/models/pos.model.js`, `pos.controller.js` | `createSale`, `finishIdempotency` | `INSERT orders (channel='pos', status='delivered', payment_status='paid')`, `INSERT payments`, `COMMIT`, trả `201` | ĐÃ XÁC MINH |

---

## 4. `act-03-dat-hang-online-va-thanh-toan.puml` — Đặt hàng trực tuyến, Giữ chỗ & Đối soát VietQR

| Bước trên sơ đồ | File source | Hàm liên quan | Điều kiện/logic thực tế | Kết quả xác minh |
|---|---|---|---|---|
| Gửi yêu cầu đặt hàng (`checkout`) | `Backend/src/controllers/customer.controller.js`, `customer.service.js` | `checkout`, `createOrder` | Xác thực JWT, `validateIdempotencyKey`, gọi `customerModel.checkout` | ĐÃ XÁC MINH |
| Kiểm tra kho, giỏ hàng, sản phẩm & địa chỉ | `Backend/src/models/customer.model.js` | `checkout` | `BEGIN`, khóa `carts FOR UPDATE`, `cart_items JOIN products FOR SHARE`, `customer_addresses FOR SHARE`; lỗi `400/409` thì `ROLLBACK` | ĐÃ XÁC MINH |
| Giữ chỗ tồn kho (`reserveStock`) | `Backend/src/services/inventory.service.js` | `reserveStock`, `lockInventoryRows` | `UPDLOCK, ROWLOCK`; ném `409` nếu thiếu `available`; ngược lại tăng `reserved_quantity` & `INSERT inventory_reservations ('active')` | ĐÃ XÁC MINH |
| Gửi yêu cầu đối soát chuyển khoản VietQR | `Backend/src/controllers/payment.controller.js`, `payment.model.js` | `submit` | Kiểm tra đơn thuộc khách hàng và chưa thanh toán, `INSERT bank_transfer_requests ('pending')`, trả `201` | ĐÃ XÁC MINH |
| Duyệt chuyển khoản thủ công | `Backend/src/controllers/payment.controller.js`, `payment.model.js` | `review`, `reviewTransfer` | Kiểm tra hết hạn/số tiền/trùng mã (`404/409`); `INSERT payments`, cập nhật `orders.payment_status='paid'`, gỡ `expires_at`, trả `200` | ĐÃ XÁC MINH |

---

## 5. `act-04-nhap-xuat-kho-va-quet-qr.puml` — Lập, Phê duyệt phiếu kho & Quét QR IoT

| Bước trên sơ đồ | File source | Hàm liên quan | Điều kiện/logic thực tế | Kết quả xác minh |
|---|---|---|---|---|
| Tạo phiếu nhập/xuất kho | `Backend/src/controllers/warehouse.controller.js`, `warehouse.model.js` | `createDocument`, `insertDocumentWithItems` | `INSERT warehouse_documents (status='pending')` & `warehouse_document_items`, trả `201` | ĐÃ XÁC MINH |
| Phê duyệt / Từ chối phiếu kho | `Backend/src/controllers/warehouse.controller.js`, `warehouse.model.js` | `approveDocument`, `rejectDocument` | Không cho tự duyệt phiếu mình tạo trừ `admin` (`403`), trạng thái `pending/draft` (`409`); duyệt sinh `qr_code='DOC:'+document_number`, trả `200` | ĐÃ XÁC MINH |
| Quét QR qua ESP32-S3 hoặc Mobile App | `Hardware_IoT/ESP32_S3_Camera_QR/ESP32_S3_Camera_QR.ino`, `Frontend_Mobile/karat_app/lib/features/warehouse/warehouse_scan_screen.dart` | `queryBackendDocument`, `lookupByQr` | ESP32-S3 giải mã bằng `quirc` gửi `X-Device-Token`; App gửi `Bearer JWT` tới `GET /warehouse/documents/lookup?qr=...` | ĐÃ XÁC MINH |
| Hoàn tất phiếu & cập nhật tồn kho | `Backend/src/models/warehouse.model.js`, `inventory.model.js` | `completeDocument`, `changeStock` | Kiểm tra `approved` & `qr_scanned_at != NULL` (`409`); lặp `changeStock` khóa `inventory`, cập nhật `quantity`, ghi `inventory_transactions`, đổi `completed` (`200`) | ĐÃ XÁC MINH |

---

## 6. `act-05-xu-ly-don-dong-goi-giao-nhan.puml` — Xử lý đơn, Đóng gói & Giao nhận

| Bước trên sơ đồ | File source | Hàm liên quan | Điều kiện/logic thực tế | Kết quả xác minh |
|---|---|---|---|---|
| Xác nhận đơn & chuyển Sẵn sàng đóng gói | `Backend/src/controllers/order-processing.controller.js`, `order-processing.model.js` | `confirmOrder`, `updateTask` | `transitionOrder(pending -> confirmed -> ready_to_pack)` theo `order-state-machine.js`, trả `200` | ĐÃ XÁC MINH |
| Đóng gói đơn & tiêu thụ giữ chỗ | `Backend/src/controllers/warehouse.controller.js`, `warehouse.model.js`, `inventory.service.js` | `packOrder`, `consumeReservation` | Kiểm tra `ready_to_pack`, trừ `quantity` & `reserved_quantity`, đóng reservation `'consumed'`, ghi `inventory_transactions`, chuyển `packed` (`200`) | ĐÃ XÁC MINH |
| Tạo vận đơn & gán Shipper | `Backend/src/controllers/shipping.controller.js`, `shipping.model.js` | `create` | `INSERT shipments (status='assigned')`, `transitionOrder(packed -> handover)`, trả `201` | ĐÃ XÁC MINH |
| Cập nhật trạng thái giao hàng | `Backend/src/controllers/shipping.controller.js`, `shipping.model.js` | `updateStatus` | `transitionOrder(handover -> shipping -> delivered | returned)`, trả `200` | ĐÃ XÁC MINH |

---

## 7. `act-06-du-bao-nhu-cau-ai.puml` — Dự báo nhu cầu AI (LightGBM) & Lập phiếu nhập bổ sung

| Bước trên sơ đồ | File source | Hàm liên quan | Điều kiện/logic thực tế | Kết quả xác minh |
|---|---|---|---|---|
| Tổng hợp lịch sử bán & tồn kho | `Backend/src/controllers/forecasting.controller.js`, `forecasting.service.js` | `run` | `SELECT warehouses`, `products JOIN inventory`, tổng hợp lịch sử bán theo ngày từ `orders` & `order_items` | ĐÃ XÁC MINH |
| Gọi dịch vụ AI Python FastAPI | `Backend/src/services/forecasting-python.service.js`, `Forecasting/src/api/main.py` | `requestPythonForecast`, `forecast` | `POST /forecast` kèm `X-Service-Token`, timeout `5000ms`; kiểm tra `len(history) >= 29`, trích xuất 15 đặc trưng và dự đoán bằng `model.joblib` (`lightgbm_l1`) | ĐÃ XÁC MINH |
| Dự phòng trung bình động khi lỗi/thiếu dữ liệu | `Backend/src/services/forecasting.service.js` | `run` | Nếu Python trả lỗi `400/401/503` hoặc timeout, fallback sang `moving-average-fallback` | ĐÃ XÁC MINH |
| Lưu kết quả dự báo & cảnh báo thiếu hàng | `Backend/src/services/forecasting.service.js` | `run` | `BEGIN ... COMMIT`: `INSERT forecast_runs`, `forecast_values`, `inventory_alerts` (khi tồn dự kiến < `reorder_point`), trả `201` | ĐÃ XÁC MINH |
| Tạo phiếu nhập đề xuất từ cảnh báo | `Frontend_Web/src/pages/ForecastingPage.jsx`, `warehouse.controller.js` | `createDocument` | Gọi `POST /api/v1/warehouse/documents` (`type='receipt'`, trạng thái `pending`), trả `201` | ĐÃ XÁC MINH |
