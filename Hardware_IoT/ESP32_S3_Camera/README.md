# HƯỚNG DẪN HOÀN THIỆN VÀ NẠP FIRMWARE ESP32-S3 WROOM CAMERA OV5640 (KARAT RETAIL)

Tài liệu kỹ thuật chi tiết dành riêng cho board phần cứng **ESP32-S3 WROOM (N16R8) Dual Type-C** kèm cảm biến **OV5640 5MP**.

---

## 1. THÔNG SỐ VÀ NHẬN DIỆN PHẦN CỨNG THỰC TẾ

1. **Board vi điều khiển**:
   - Tên in trên board: `ESP32-S3 WROOM`.
   - Chip SoC: ESP32-S3 Dual-core Xtensa LX7 @ 240MHz.
   - Bộ nhớ: **16MB Flash** và **8MB Octal (OPI) PSRAM**.
   - Cổng giao tiếp: **2 cổng Type-C**:
     - `USB-UART`: Nối qua chip chuyển đổi UART (CH340/CP2102) $\rightarrow$ **CẮM CÁP VÀO CỔNG NÀY ĐỂ NẠP CODE VÀ XEM SERIAL MONITOR**.
     - `USB-OTG`: Nối trực tiếp vào chân USB D+/D- nội tại của ESP32-S3 (GPIO 19/20).
   - Nút bấm: Nút `BOOT` (GPIO 0) và nút `EN` (Reset phần cứng).
2. **Cảm biến Camera**:
   - Model: **OmniVision OV5640** 5 Megapixel.
   - Giao tiếp: Cáp bẹ FPC 24-pin DVP 8-bit.
   - Thấu kính: Thường là thấu kính tiêu cự cố định có ren xoay tinh chỉnh nét (khoảng cách tối ưu: 15cm – 25cm).
3. **Ngoại vi**:
   - Phiên bản chuẩn này **KHÔNG CẦN CÒI BUZZER RỜI, KHÔNG CẦN LED RỜI**.
   - Toàn bộ kết quả quét, xác thực phiếu, cảnh báo và lỗi được in trực tiếp, trực quan trên **Serial Monitor (115200 baud)**.

---

## 2. SƠ ĐỒ CHÂN CAMERA ĐÃ XÁC MINH (PINOUT)

Board ESP32-S3 WROOM Dual Type-C sử dụng chuẩn pinout camera tương thích hoàn toàn với cấu hình `CAMERA_MODEL_ESP32S3_EYE`:

| Tên tín hiệu | Chân GPIO trên ESP32-S3 | Chức năng |
|---|---|---|
| **XCLK** | `GPIO 15` | Xung nhịp hệ thống camera (20 MHz) |
| **PCLK** | `GPIO 13` | Xung nhịp điểm ảnh (Pixel Clock) |
| **VSYNC** | `GPIO 6` | Đồng bộ khung hình dọc |
| **HREF** | `GPIO 7` | Đồng bộ dòng ngang |
| **SIOD** | `GPIO 4` | Dữ liệu giao tiếp I2C / SCCB |
| **SIOC** | `GPIO 5` | Xung nhịp giao tiếp I2C / SCCB |
| **D0 (Y2)** | `GPIO 11` | Bit dữ liệu 0 |
| **D1 (Y3)** | `GPIO 9` | Bit dữ liệu 1 |
| **D2 (Y4)** | `GPIO 8` | Bit dữ liệu 2 |
| **D3 (Y5)** | `GPIO 10` | Bit dữ liệu 3 |
| **D4 (Y6)** | `GPIO 12` | Bit dữ liệu 4 |
| **D5 (Y7)** | `GPIO 18` | Bit dữ liệu 5 |
| **D6 (Y8)** | `GPIO 17` | Bit dữ liệu 6 |
| **D7 (Y9)** | `GPIO 16` | Bit dữ liệu 7 |
| **PWDN / RST** | `-1` | Nối mass / Nối nguồn trong mạch |

---

## 3. CÀI ĐẶT MÔI TRƯỜNG ARDUINO IDE

### Bước 1: Cài đặt Board Package ESP32
1. Mở **Arduino IDE** (khuyến nghị phiên bản 2.x mới nhất).
2. Vào `File` $\rightarrow$ `Preferences`.
3. Dán đường dẫn sau vào ô *Additional Boards Manager URLs*:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Vào `Tools` $\rightarrow$ `Board` $\rightarrow$ `Boards Manager...`, gõ `esp32` của **Espressif Systems** và bấm **Install** (phiên bản 2.0.14 trở lên hoặc 3.x).

### Bước 2: Cài đặt thư viện cần thiết
Vào `Tools` $\rightarrow$ `Manage Libraries...` (Ctrl+Shift+I):
1. Tìm `ESP32QRCodeReader` của **alvarowolfx** (hoặc **alanswx**) $\rightarrow$ Bấm **Install**.
2. Tìm `ArduinoJson` của **Benoit Blanchon** $\rightarrow$ Bấm **Install** (bản 6.x hoặc 7.x).

---

## 4. CẤU HÌNH THÔNG SỐ BOARD TRÊN ARDUINO IDE

Vào menu `Tools` trên thanh công cụ và thiết lập chính xác các thông số:

- **Board**: `"ESP32S3 Dev Module"`
- **USB CDC On Boot**: `"Enabled"` *(Rất quan trọng để hiển thị Serial log)*
- **CPU Frequency**: `"240MHz (WiFi)"`
- **Flash Mode**: `"QIO 80MHz"`
- **Flash Size**: `"16MB (128Mb)"`
- **Partition Scheme**: `"16M Flash (3MB APP/9.9MB FATFS)"` hoặc `"Huge APP (3MB No OTA/1MB SPIFFS)"`
- **PSRAM**: `"OPI PSRAM"` *(Bắt buộc phải bật để cấp phát bộ đệm camera OV5640 và giải mã QR)*
- **Upload Speed**: `"921600"` (hoặc `115200` nếu cáp USB dài)
- **Port**: Chọn đúng cổng COM của board (ví dụ: `COM3`, `COM5`).

---

## 5. HƯỚNG DẪN CẤU HÌNH VÀ KIỂM TRA PHẦN CỨNG

### Giai đoạn A: Kiểm tra chẩn đoán Camera trước (DIAGNOSTIC MODE)
Để chắc chắn camera OV5640 của bạn hoạt động và chụp ảnh rõ nét:
1. Mở file [config.h](file:///d:/hoc/doantn/1150080128_LYCHICHUONG_Source_DATN/Hardware_IoT/ESP32_S3_Camera/config.h).
2. Đặt `#define DIAGNOSTIC_MODE true`.
3. Cắm cáp USB vào cổng **USB-UART** trên board. Bấm **Upload**.
4. Mở **Serial Monitor** (tốc độ `115200` baud).
5. Quan sát log:
   ```
   ============================================================================
     HE THONG BAN LE DA KENH KARAT RETAIL - MODULE IOT SCANNER
     Phan cung: ESP32-S3 WROOM (N16R8) + Camera OV5640 5MP
     Chip: ESP32-S3 (Rev 2) | Tan so: 240 MHz | Flash: 16 MB
   ============================================================================
   [PSRAM] Tìm thấy PSRAM thành công: Tổng 8 MB (Còn trống: 8190 KB)
   [OK] Khởi tạo Camera thành công! Cảm biến PID: 0x5640
   [LẦN 1] Chụp ảnh THÀNH CÔNG! Kích thước: 320x240 | Dung lượng: 76800 bytes | Thời gian: 42 ms
   [LẦN 2] Chụp ảnh THÀNH CÔNG! Kích thước: 320x240 | Dung lượng: 76800 bytes | Thời gian: 39 ms
   ```
   *Nếu ảnh chụp thành công liên tục, phần cứng camera OV5640 và PSRAM của bạn hoạt động hoàn hảo!*

### Giai đoạn B: Chạy chế độ Quét QR và Kết nối Backend
1. Mở file [config.h](file:///d:/hoc/doantn/1150080128_LYCHICHUONG_Source_DATN/Hardware_IoT/ESP32_S3_Camera/config.h).
2. Đổi `#define DIAGNOSTIC_MODE false`.
3. Sửa thông tin Wi-Fi và IP Backend:
   ```c
   #define WIFI_SSID        "Ten_WiFi_Cua_Ban"     // Wi-Fi 2.4GHz
   #define WIFI_PASSWORD    "Mat_Khau_WiFi"
   #define BACKEND_HOST     "192.168.1.15"         // IP LAN máy tính chạy Node.js (xem bằng lệnh ipconfig)
   #define BACKEND_PORT     3000
   ```
4. Bấm **Upload** lại firmware vào board.

---

## 6. LOG MẪU TRÊN SERIAL MONITOR KHI CHẠY THỰC TẾ

### Trường hợp 1: Quét thành công phiếu đã được duyệt (APPROVED)
```
+--------------------------------------------------------------------------+
| [PHÁT HIỆN QR] Nội dung: DOC:NK-MVS5V6EL-305                             |
| Thời điểm quét: 14852    ms | Độ dài: 21  bytes                             |
+--------------------------------------------------------------------------+
[HTTP REQUEST] GET http://192.168.1.15:3000/api/v1/warehouse/documents/lookup/DOC:NK-MVS5V6EL-305
[AUTH HEADER]  X-Device-Token: karat_esp32_device_token
[HTTP STATUS]  200

############################################################################
  >>> KẾT QUẢ XÁC THỰC: PHIẾU HỢP LỆ ĐÃ ĐƯỢC DUYỆT (APPROVED) <<<
############################################################################
  Số phiếu      : NK-MVS5V6EL-305 (NHẬP KHO)
  Kho hàng      : Kho Ho Chi Minh 01
  Người tạo     : System Warehouse Staff
  Người duyệt   : System Manager
  Số lượng dòng : 1 sản phẩm
  --------------------------------------------------------------------------
   * [SP-001] Bình nước thể thao 500ml       | Số lượng duyệt: 20
  --------------------------------------------------------------------------
  [HÀNH ĐỘNG TIẾP THEO]: Nhân viên kiểm đếm hàng hóa thực tế và xác nhận
  hoàn tất trên Mobile App (Karat App) để cập nhật tồn kho trong Database.
############################################################################
```

### Trường hợp 2: Quét lại phiếu đã hoàn tất (COMPLETED)
```
****************************************************************************
  [CẢNH BÁO] PHIẾU ĐÃ HOÀN TẤT (COMPLETED)
****************************************************************************
  Trạng thái hiện tại trong PostgreSQL: "completed"
  Ý nghĩa nghiệp vụ: Phiếu này đã được nhân viên kho nhập/xuất trước đó. KHÔNG XỬ LÝ LẶP LẠI!
****************************************************************************
```

### Trường hợp 3: Quét phiếu chưa được duyệt (PENDING)
```
****************************************************************************
  [CẢNH BÁO] PHIẾU CHỜ DUYỆT (PENDING)
****************************************************************************
  Trạng thái hiện tại trong PostgreSQL: "pending"
  Ý nghĩa nghiệp vụ: Phiếu chưa được Quản lý phê duyệt trên Web. Chưa đủ điều kiện giao nhận!
****************************************************************************
```

### Trường hợp 4: Mã QR không tồn tại trong Database (HTTP 404)
```
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  [LỖI] KHÔNG TÌM THẤY PHIẾU (HTTP 404)
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  Chi tiết: Mã QR không tồn tại trong cơ sở dữ liệu PostgreSQL. Vui lòng kiểm tra lại mã!
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
```

---

## 7. CÁCH LẤY NÉT CHO CAMERA OV5640

1. **Thấu kính ren vặn (Fixed Focus)**:
   - Phần lớn module camera OV5640 trên board ESP32-S3 sử dụng ống kính có ren vặn.
   - Nếu bạn đưa camera lại gần màn hình (10cm - 20cm) mà ảnh bị mờ: **Dùng tay xoay nhẹ thấu kính ngược chiều hoặc thuận chiều kim đồng hồ** từng chút một cho đến khi vạch đen trắng của mã QR sắc nét.
2. **Khoảng cách quét tối ưu**:
   - Màn hình máy tính: Khoảng cách từ **15cm đến 25cm**.
   - Màn hình điện thoại: Khoảng cách từ **12cm đến 20cm** (bật độ sáng màn hình khoảng 70-80% để tránh chói bóng đèn).
