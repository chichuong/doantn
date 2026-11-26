# Báo Cáo Kiểm Chứng UML Activity Diagram

Tài liệu này tổng hợp kết quả kiểm tra cú pháp PlantUML, chuẩn UML 2.5.1, kiểm tra trực quan hình ảnh render và đối chiếu nghiệp vụ thực tế của hệ thống.

---

## 1. Danh sách kiểm tra chất lượng bắt buộc

Áp dụng cho toàn bộ 7 sơ đồ (`act-01a`, `act-01b`, `act-02`, `act-03`, `act-04`, `act-05`, `act-06`):

- [x] **Có điểm bắt đầu hợp lệ:** Mỗi sơ đồ có đúng 1 Initial Node (`start`).
- [x] **Các action tương ứng với nghiệp vụ thực tế:** Tất cả Action Node đều xuất phát trực tiếp từ code đã đối chiếu (`Backend`, `Frontend_Web`, `Frontend_Mobile`, `Forecasting`, `Hardware_IoT`).
- [x] **Các mũi tên đúng thứ tự xử lý:** Control Flow đi từ trên xuống dưới, tuần tự theo đúng `await` và luồng giao dịch thực tế.
- [x] **Decision có guard condition rõ ràng:** Mọi nhánh `if/else` đều gắn nhãn điều kiện trong ngoặc vuông `[...]`.
- [x] **Merge chỉ hợp nhất nhánh thay thế:** Không dùng merge thay cho join; các nhánh kết thúc lỗi dừng bằng Activity Final (`stop`).
- [x] **Fork/Join chỉ xuất hiện khi có song song thực tế:** Vì toàn bộ các luồng nghiệp vụ Backend/Frontend được triển khai tuần tự (`async/await`), các sơ đồ không lạm dụng `fork`/`join` sai thực tế.
- [x] **Vòng lặp có điều kiện tiếp tục và thoát:** `repeat ... repeat while` trong `act-02` và `while ... endwhile` trong `act-02`, `act-04`, `act-06` đều có guard điều kiện tiếp tục và thoát rõ ràng.
- [x] **Các điểm kết thúc được sử dụng đúng ngữ nghĩa UML:** Mọi nhánh kết thúc hợp lệ đều đi tới `stop`.
- [x] **Swimlane đúng trách nhiệm từng thành phần:** Tách rõ Người dùng/Vai trò, Giao diện Web/Mobile, Thiết bị IoT, Backend API, Cơ sở dữ liệu, Dịch vụ AI, Dịch vụ Email.
- [x] **Không thiếu nhánh lỗi quan trọng trong code:** Đầy đủ nhánh lỗi `400`, `401`, `403`, `404`, `409` và `ROLLBACK` giao dịch khi có lỗi nghiệp vụ/tồn kho.
- [x] **Không tự thêm chức năng hoặc status code:** Tất cả HTTP status code đều khớp trực tiếp với `controllers/*.js` và `AppError`.
- [x] **Tiếng Việt có dấu và không lỗi font:** Toàn bộ nhãn dùng UTF-8, font `Segoe UI`, hiển thị đầy đủ dấu tiếng Việt.
- [x] **Sơ đồ render thành công:** Biên dịch PlantUML `v1.2024.8` trả về exit code `0` cho cả 7 file `.svg` và 7 file `.png`.
- [x] **Sơ đồ dễ đọc khi đưa vào Word:** Đã kiểm tra trực quan toàn bộ 7 ảnh PNG; đã tách `act-01` thành `act-01a` và `act-01b` và áp dụng `wrapWidth` để không bị cắt biên phải khi xuất ảnh độ phân giải cao.

---

## 2. Kết quả đối chiếu các nghiệp vụ đặc biệt (Mục 5)

Qua khảo sát toàn bộ source code và database schema (`Backend/database/migrations/001..020`), ghi nhận sự khác biệt giữa các nghiệp vụ mở rộng thường gặp và **code thực tế đang chạy**:

1. **FEFO / Lô hàng / Hạn sử dụng:** **CHƯA TRIỂN KHAI** trong source code hiện tại (bảng `products` và `inventory` không có cột lô hàng hay hạn sử dụng). Do đó không vẽ luồng FEFO vào sơ đồ.
2. **RFID:** **CHƯA TRIỂN KHAI** trong source code hiện tại; hệ thống sử dụng **Barcode/SKU** (POS, đóng gói) và **QR Code** (phiếu kho qua Mobile App hoặc camera ESP32-S3).
3. **Chuyển kho nội bộ:** **CHƯA TRIỂN KHAI**; theo migration `020`, hệ thống vận hành tập trung trên một kho trung tâm (`WH-HCM-01`).
4. **Dự báo nhu cầu AI:** **ĐÃ TRIỂN KHAI** tại `forecasting.service.js` kết hợp `Forecasting/src/api/main.py` (LightGBM, yêu cầu tối thiểu 29 ngày lịch sử, tự động fallback `moving-average-fallback` khi dịch vụ Python lỗi hoặc thiếu dữ liệu).
