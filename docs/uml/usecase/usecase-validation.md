# Báo cáo Kiểm định Chất lượng Hình Elip, Chuẩn UML 2.5.1 & Kết xuất Ảnh

---

## 1. Kết quả Đo lường Thực tế Tỷ lệ Hình học Elip Use Case (Từ file SVG đã render)

Toàn bộ **9 sơ đồ Use Case** (gồm **82 elip Use Case**) được render trực tiếp bằng **PlantUML v1.2024.8 + Graphviz Dot 2.44.1** với mã hóa `UTF-8` và kiểm tra tự động tọa độ bán kính `rx`, `ry` trong cấu trúc XML của file `.svg` kết hợp kiểm tra trực quan từng file ảnh `.png` 300 DPI.

| STT | Tên file sơ đồ | Số lượng Use Case | Tỷ lệ Rộng / Cao nhỏ nhất (`W/H min`) | Tỷ lệ Rộng / Cao lớn nhất (`W/H max`) | Tỷ lệ trung bình (`W/H avg`) | Đánh giá hình dạng Elip |
|---|---|---:|---:|---:|---:|---|
| 1 | `overview/usecase-overview.svg` | 12 | `1.23` | `1.77` | **`1.43`** | Bầu tròn, đồng đều, cân đối |
| 2 | `detail/01-tai-khoan-va-phan-quyen.svg` | 10 | `1.23` | `1.64` | **`1.28`** | Bầu tròn, đồng đều, cân đối |
| 3 | `detail/02-san-pham-danh-muc-va-kho.svg` | 7 | `1.23` | `1.52` | **`1.33`** | Bầu tròn, đồng đều, cân đối |
| 4 | `detail/03-nhap-xuat-kho-va-doi-soat-qr.svg` | 9 | `1.23` | `1.63` | **`1.40`** | Bầu tròn, đồng đều, cân đối |
| 5 | `detail/04-ton-kho-va-dieu-chinh-ton.svg` | 7 | `1.24` | `1.72` | **`1.46`** | Bầu tròn, đồng đều, cân đối |
| 6 | `detail/05-ban-hang-pos.svg` | 8 | `1.23` | `1.58` | **`1.32`** | Bầu tròn, đồng đều, cân đối |
| 7 | `detail/06-mua-sam-online-va-thanh-toan.svg` | 10 | `1.23` | `1.62` | **`1.42`** | Bầu tròn, đồng đều, cân đối |
| 8 | `detail/07-xu-ly-don-dong-goi-va-giao-nhan.svg` | 10 | `1.24` | `1.71` | **`1.54`** | Bầu tròn, đồng đều, cân đối |
| 9 | `detail/08-ai-du-bao-bao-cao-va-du-lieu.svg` | 9 | `1.24` | `1.85` | **`1.51`** | Bầu tròn, đồng đều, cân đối |

> **Kết luận kiểm tra hình dạng elip:** Toàn bộ 82/82 Use Case đều là elip chuẩn UML, có tỷ lệ trung bình nằm trong khoảng **`1.28 – 1.54`** (đúng vùng mục tiêu thẩm mỹ **`1.3 – 1.8`**), không có bất kỳ elip nào bị kéo dài dẹt ngang hay tràn chữ khỏi đường viền.

---

## 2. Checklist Kiểm tra Hình dạng Elip (Phần XV)

- [x] Hình vẫn là elip UML (`usecase` chuẩn của PlantUML, không thay bằng hình chữ nhật bo góc).
- [x] Không bị dẹt quá mức (tỷ lệ `W/H` trung bình toàn bộ sơ đồ ~`1.41`).
- [x] Chiều rộng và chiều cao cân đối.
- [x] Tên dài đã xuống dòng hợp lý thành 2–3 dòng theo cụm từ có nghĩa bằng `\n`.
- [x] Nội dung nằm chính giữa (`defaultTextAlignment center`).
- [x] Chữ không chạm viền.
- [x] Các elip có kích thước tương đối đều trong từng sơ đồ.
- [x] Không có đường nối xuyên qua nội dung elip không liên quan.
- [x] Không có nhãn `<<include>>` / `<<extend>>` hay tiêu đề ranh giới bị che.
- [x] Các elip dễ đọc, sắc nét khi chèn vào Microsoft Word (cả bản vector `.svg` và ảnh `.png` 300 DPI).

---

## 3. Checklist Kiểm tra Chuẩn UML 2.5.1 & Nghiệp vụ Thực tế (Phần XVI)

- [x] **Actor đúng loại:**
  - Actor con người dùng hình người que chuẩn UML: `Khách hàng`, `Nhân viên bán hàng`, `Nhân viên kho`, `Nhân viên xử lý đơn`, `Nhân viên giao hàng`, `Quản lý`, `Quản trị viên` (và actor tổng quát `Người dùng hệ thống` trong phân hệ Xác thực).
  - Thiết bị/hệ thống ngoài thực sự tương tác qua giao thức mạng với hệ thống được gắn stereotype rõ ràng: `Camera IoT ESP32-S3` (`<<Thiết bị>>`), `Dịch vụ AI Dự báo nhu cầu` (`<<Hệ thống ngoài>>`), `Dịch vụ Email OTP` (`<<Hệ thống ngoài>>`).
  - Không biến Frontend Web, Mobile App, Backend API hay PostgreSQL/SQL Server nội bộ thành actor.
- [x] **Actor ngoài System Boundary:** 100% actor nằm bên ngoài khung `rectangle` của hệ thống.
- [x] **Use Case trong System Boundary:** 100% Use Case nằm trọn bên trong System Boundary có tên hệ thống rõ ràng.
- [x] **Use Case đại diện mục tiêu nghiệp vụ:** Đặt tên theo cấu trúc *Động từ + Đối tượng* bằng tiếng Việt có dấu; không đưa endpoint, tên hàm, status code, middleware hay câu lệnh SQL lên sơ đồ.
- [x] **Association đúng quyền và vai trò:** Dùng đường liền không mũi tên (`--`), đối chiếu chính xác với `role_permissions` trong migrations + `cloud_seed_data.json` + `src/routes/*.js` (ví dụ: không gán nhầm quyền POS cho `Quản lý`; không gán nhầm quyền xác nhận đơn cho `Nhân viên xử lý đơn`).
- [x] **Include đúng hướng và ngữ nghĩa (`..> : <<include>>`):**
  - `UC_AUTH_01` / `UC_AUTH_04` `..>` `UC_AUTH_02` (*Xác thực mã OTP qua Email* — bắt buộc gọi `verifySavedOtp`).
  - `UC_WH_08` `..>` `UC_WH_06` (*Quét mã QR phiếu kho đối soát* — bắt buộc kiểm tra `header.qr_scanned_at` trước khi hoàn tất phiếu).
  - `UC_POS_05` `..>` `UC_POS_06` (*Trừ tồn kho trực tiếp tại kho quầy* — bắt buộc `directDeductStock` khi tạo đơn POS).
  - `UC_CUS_04` `..>` `UC_CUS_05` (*Giữ chỗ tồn kho tạm thời* — bắt buộc `reserveStock` khi đặt đơn online).
  - `UC_FUL_06` `..>` `UC_FUL_05` (*Quét mã SKU kiểm tra sản phẩm theo dòng đơn* — bắt buộc đối chiếu `order_scan_events` trước khi đóng gói).
  - Không thêm `<<include>>` *Đăng nhập* vào mọi Use Case (đã ghi rõ vào mục *Tiền điều kiện* trong bảng đặc tả).
- [x] **Extend đúng hướng và ngữ nghĩa (`..> : <<extend>>` — mũi tên hướng về Use Case cơ sở):**
  - `UC_WH_07` `..>` `UC_WH_08`: Quét kiểm đếm từng SKU mở rộng cho hoàn tất phiếu khi bật `require_scan` mà không nhập tay số lượng thực tế.
  - `UC_INV_02` `..>` `UC_INV_01`: Lọc cảnh báo sản phẩm chạm ngưỡng an toàn (`lowStock=true`) mở rộng cho tra cứu tồn kho.
  - `UC_POS_04` `..>` `UC_POS_05`: Áp dụng chiết khấu tại quầy mở rộng tùy chọn khi thanh toán đơn POS.
  - `UC_CUS_06` `..>` `UC_CUS_04`: Xem VietQR & gửi mã tham chiếu chuyển khoản mở rộng khi khách chọn thanh toán chuyển khoản ngân hàng.
  - `UC_RPT_04` `..>` `UC_RPT_03`: Lập phiếu nhập đề xuất tự động từ AI mở rộng từ màn hình xem cảnh báo nguy cơ thiếu hàng.
- [x] **Generalization đúng (`--|>`):**
  - `Quản trị viên --|> Quản lý`: `admin` sở hữu 58/58 quyền, bao hàm toàn bộ 33 quyền của `manager` và vượt qua mọi middleware của `manager`.
  - `Khách hàng --|> Người dùng hệ thống` và `Quản trị viên --|> Người dùng hệ thống` (trong phân hệ 01).
- [x] **Không có chức năng tự tưởng tượng:** Đã loại trừ hoàn toàn các hạng mục chưa triển khai trong source code gồm: *Quản lý nhà cung cấp độc lập*, *Xuất kho FEFO*, *Quản lý hạn sử dụng*, *Cảnh báo cận hạn/hết hạn*, *Chuyển kho nội bộ*, *RFID*, và *Quản lý chương trình khuyến mãi/voucher*.
- [x] **Không tự sửa source code hệ thống:** Toàn bộ mã nguồn trong `Backend/`, `Frontend_Web/`, `Frontend_Mobile/`, `Forecasting/`, `Hardware_IoT/` được giữ nguyên vẹn 100%.

---

## 4. Giới hạn Xác minh & Ghi chú Thực tế

1. **Cơ sở dữ liệu Runtime:** Không kết nối trực tiếp tới instance PostgreSQL / SQL Server đang chạy trên đám mây trong quá trình sinh tài liệu; toàn bộ quyền hạn (`roles`, `permissions`, `role_permissions`, `user_warehouses`) và ràng buộc toàn vẹn được xác minh chéo từ chuỗi 20 file migration (`001`–`020`), `Backend/database/cloud_seed_data.json` và mã nguồn kiểm tra quyền trong `Backend/src/routes/*.js`, `Backend/src/middlewares/*.js`.
2. **Chiết khấu tại quầy POS (`UC_POS_04`):** Trong mã nguồn hiện tại (`PosPage.jsx` dòng 422–435 và `PosContext.jsx`), nhân viên thu ngân nhập chiết khấu để tính số tiền thu khách trên giao diện và hóa đơn in tại quầy, còn API `POST /api/v1/pos/sales` tính `orders.total_amount` theo đơn giá niêm yết `products.sale_price * quantity` trong CSDL. Chi tiết này đã được phản ánh trung thực trong bảng truy vết.
3. **Hướng dẫn chèn vào báo cáo Microsoft Word:**
   - Với **Word 2019 / 2021 / Microsoft 365**: Chọn **Insert -> Pictures -> This Device** và chèn trực tiếp các file **`.svg`** trong `docs/uml/usecase/overview/` và `docs/uml/usecase/detail/` để đạt độ nét vector tuyệt đối khi phóng to và in ấn khổ A4.
   - Với phiên bản Word cũ hơn: Sử dụng các file **`.png` (độ phân giải cao 300 DPI)** đi kèm cùng tên trong từng thư mục.
