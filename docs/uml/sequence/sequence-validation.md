# Báo Cáo Kiểm Chứng Sequence Diagram (UML 2.5.1 & Activation Bar)

Tài liệu này xác nhận tính hợp lệ về cú pháp PlantUML, chuẩn UML 2.5.1, cân bằng Activation Bar, và tính chính xác của HTTP status code trên toàn bộ 6 sơ đồ tuần tự trong `docs/uml/sequence/`.

---

## 1. Kiểm tra biên dịch & hình ảnh đầu ra

- **Công cụ biên dịch:** PlantUML `v1.2024.8` (Java 21) với `-charset UTF-8 -tsvg` và `-tpng -DPLANTUML_LIMIT_SIZE=8192 -Sdpi=300`.
- **Kết quả biên dịch:** Toàn bộ 6 file `.puml` biên dịch thành công (exit code `0`), tạo đủ 6 file `.svg` và 6 file `.png` trong `docs/uml/sequence/svg/` và `docs/uml/sequence/png/`.
- **Kiểm tra trực quan ảnh PNG:** Tất cả 6 ảnh PNG đã được kiểm tra trực tiếp:
  - Không có chồng chữ giữa nhãn message và đường lifeline.
  - Khung `alt` / `else` / `opt` / `loop` bao trọn đúng phạm vi tương tác.
  - Nền trắng, chữ đen rõ nét, `hide footbox`, phù hợp chèn vào báo cáo Word khổ A4.

---

## 2. Bảng kiểm tra Activation Bar theo từng sơ đồ

| Participant | Thời điểm activate | Thời điểm deactivate | Lời gọi tương ứng | Hợp lệ |
|---|---|---|---|---|
| **Sơ đồ 1 (`seq-01`)**: `UI` (`LoginPage.jsx`) | Khi `Khách hàng` thao tác Gửi OTP / Xác nhận / Đăng nhập | Sau khi trả kết quả/lỗi về `Khách hàng` | Các luồng 1, 2, 3 | Hợp lệ |
| **Sơ đồ 1 (`seq-01`)**: `AuthController` | Khi nhận `POST /register/send-otp`, `/register`, `/login` | Sau khi trả HTTP `200/201/400/401/403/409` | `sendRegisterOtp`, `register`, `login` | Hợp lệ |
| **Sơ đồ 1 (`seq-01`)**: `AuthService` | Khi nhận lời gọi từ `AuthController` | Sau khi trả kết quả hoặc ném `AppError` | `sendRegisterOtp`, `register`, `login` | Hợp lệ |
| **Sơ đồ 1 (`seq-01`)**: `Database` | Tại mỗi truy vấn / transaction độc lập | Ngay khi truy vấn / `COMMIT` trả kết quả | `SELECT users`, lưu OTP, tạo user, kiểm tra login | Hợp lệ |
| **Sơ đồ 1 (`seq-01`)**: `Email Service` | Khi `AuthService` gọi `sendOtpEmail` | Ngay khi trả `{ sent, provider }` | `sendOtpEmail` | Hợp lệ |
| **Sơ đồ 2 (`seq-02`)**: `Auth & Warehouse Middleware` | Khi nhận request POS từ `UI` | Sau khi `Controller` trả HTTP response về `UI` | `authenticate`, `requirePermission`, `requireWarehouseAccess` | Hợp lệ |
| **Sơ đồ 2 (`seq-02`)**: `PosController`, `PosService`, `PosModel` | Khi nhận lời gọi từ lớp trước đó | Sau khi trả kết quả / `AppError` về lớp gọi | `openSession`, `lookupProduct`, `createSale` | Hợp lệ |
| **Sơ đồ 2 (`seq-02`)**: `Database` | Tại từng bước truy vấn / khóa / trừ tồn độc lập | Ngay sau mỗi truy vấn hoặc `COMMIT`/`ROLLBACK` | `startIdempotency`, `INSERT orders`, `directDeductStock`, `COMMIT` | Hợp lệ |
| **Sơ đồ 3 (`seq-03`)**: `UI`, `Ctrl`, `Svc`, `Model` | Khi nhận tương tác từ `Cust` / `Reviewer` | Sau khi hoàn tất `checkout`, `submit`, `review` | `checkout`, `submitTransferRequest`, `reviewTransfer` | Hợp lệ |
| **Sơ đồ 3 (`seq-03`)**: `Database` | Tại mỗi truy vấn kiểm tra, `reserveStock`, `ROLLBACK`/`COMMIT` | Ngay khi trả kết quả cho `Model` | `reserveStock`, `INSERT bank_transfer_requests`, `reviewTransfer` | Hợp lệ |
| **Sơ đồ 4 (`seq-04`)**: `IoT` (`ESP32-S3`) | Khi Core 1 giải mã QR bằng `quirc` | Sau khi nhận `200 OK` từ `WarehouseController` | `GET /warehouse/documents/lookup?qr=...` | Hợp lệ |
| **Sơ đồ 4 (`seq-04`)**: `App`, `Ctrl`, `Svc`, `Model`, `DB` | Khi nhận request tạo / duyệt / quét QR / hoàn tất phiếu | Sau khi trả kết quả hoặc hoàn tất `loop changeStock` & `COMMIT` | `createDocument`, `approveDocument`, `lookupByQr`, `completeDocument` | Hợp lệ |
| **Sơ đồ 5 (`seq-05`)**: `App`, `Ctrl`, `Svc`, `Model`, `DB` | Khi nhận lệnh xác nhận, cập nhật task, đóng gói, tạo/cập nhật vận đơn | Sau khi `transitionOrder` / `consumeReservation` và `COMMIT` trả về | `confirm`, `updateTask`, `packOrder`, `createShipment`, `updateShipmentStatus` | Hợp lệ |
| **Sơ đồ 6 (`seq-06`)**: `UI`, `Ctrl`, `Svc`, `PyClient`, `FastAPI`, `WhCtrl`, `DB` | Khi nhận request chạy dự báo AI hoặc tạo phiếu nhập đề xuất | Sau khi hoàn tất `loop` dự báo, lưu DB, hoặc lưu phiếu nhập `pending` | `run`, `requestPythonForecast`, `POST /forecast`, `createDocument` | Hợp lệ |

---

## 3. Kiểm tra HTTP Status Code & Logic Nghiệp Vụ Thực Tế

- **Auth (`auth.controller.js`, `auth.service.js`):**
  - `POST /api/v1/auth/register/send-otp`: `200 OK`, lỗi `400` / `409`.
  - `POST /api/v1/auth/register`: `201 Created`, lỗi `400` / `409`.
  - `POST /api/v1/auth/login`: `200 OK`, lỗi `401` / `403`.
- **POS (`pos.controller.js`, `pos.model.js`, `inventory.service.js`):**
  - `POST /api/v1/pos/sessions/open`: `201 Created`.
  - `GET /api/v1/pos/products/lookup`: `200 OK`, `404` nếu không có sản phẩm.
  - `POST /api/v1/pos/sales`: `201 Created`, `404` (không thấy ca), `409` (ca chưa mở / không đủ tồn khả dụng).
- **Customer & Payment (`customer.controller.js`, `payment.controller.js`):**
  - `POST /api/v1/customer/checkout`: `201 Created`, `400` (giỏ trống/địa chỉ sai), `409` (ngừng bán/thiếu tồn giữ chỗ).
  - `POST /api/v1/payments/orders/:orderId/transfer-requests`: `201 Created`.
  - `PATCH /api/v1/payments/transfer-requests/:requestId/review`: `200 OK`.
- **Warehouse & IoT (`warehouse.controller.js`, `warehouse.model.js`):**
  - `POST /api/v1/warehouse/documents`: `201 Created`.
  - `PATCH /api/v1/warehouse/documents/:id/approve`: `200 OK`, `403` (tự duyệt phiếu mình tạo), `404`, `409`.
  - `GET /api/v1/warehouse/documents/lookup`: `200 OK`.
  - `POST /api/v1/warehouse/documents/:id/complete`: `200 OK`.
- **Order Processing & Shipping (`order-processing.controller.js`, `shipping.controller.js`):**
  - `POST /api/v1/order-processing/orders/:id/confirm`: `200 OK`.
  - `PATCH /api/v1/order-processing/orders/:id/task`: `200 OK`.
  - `POST /api/v1/warehouse/orders/:id/pack`: `200 OK`.
  - `POST /api/v1/shipping/shipments`: `201 Created`.
  - `PATCH /api/v1/shipping/shipments/:id/status`: `200 OK`.
- **Forecasting AI (`forecasting.controller.js`, `Forecasting/src/api/main.py`):**
  - `POST /api/v1/forecasting/run`: `201 Created`.
  - `POST /forecast` (FastAPI): `200 OK`, `400` (dưới 29 ngày), `401` (sai token), `503` (chưa load model); Backend tự fallback sang `moving-average-fallback` nếu lỗi.
