# Hướng Dẫn Sử Dụng Firmware Xem Stream Camera OV5640 Qua Trình Duyệt

## 1. Mục Đích
Bản firmware này (`Hardware_IoT/ESP32_S3_Camera_Stream`) được tạo **độc lập**, không ảnh hưởng hoặc ghi đè lên bản chẩn đoán `Hardware_IoT/ESP32_S3_Camera`.

Mục đích chính:
1. Phát luồng video trực tiếp (MJPEG Stream) từ camera OV5640 qua mạng Wi-Fi lên trình duyệt (Chrome, Edge, Firefox, Cốc Cốc,...).
2. Hỗ trợ người dùng quan sát hình ảnh thời gian thực để **xoay vòng lấy nét (Focus Ring)** của ống kính OV5640, đảm bảo mã QR ở khoảng cách 15cm – 25cm đạt độ nét cao nhất trước khi tích hợp thuật toán giải mã QR.
3. Cho phép thay đổi nhanh độ phân giải (`QVGA 320x240`, `VGA 640x480`, `SVGA 800x600`, `XGA 1024x768`) và độ tương phản ngay trên giao diện web.

---

## 2. Cấu Trúc Thư Mục
```
Hardware_IoT/
├── ESP32_S3_Camera/               <-- Firmware chẩn đoán ban đầu (GIỮ NGUYÊN)
│   ├── ESP32_S3_Camera.ino
│   ├── camera_pins.h
│   ├── config.h
│   └── README.md
│
└── ESP32_S3_Camera_Stream/        <-- Firmware xem stream qua trình duyệt (MỚI)
    ├── ESP32_S3_Camera_Stream.ino <-- Mã nguồn chính (MJPEG Stream Server)
    ├── camera_pins.h              <-- Giữ nguyên 100% sơ đồ chân đã xác thực
    ├── config.h                   <-- Cấu hình Wi-Fi và thông số khởi tạo
    └── README.md                  <-- Hướng dẫn này
```

---

## 3. Thư Viện Cần Thiết (Arduino IDE)
**KHÔNG CẦN CÀI ĐẶT THÊM THƯ VIỆN BÊN NGOÀI.**
Firmware sử dụng các thành phần có sẵn trong **ESP32 Arduino Core** do Espressif cung cấp:
- `<WiFi.h>`: Quản lý kết nối mạng Wi-Fi (có sẵn trong core ESP32).
- `"esp_camera.h"`: Driver camera ESP32 (có sẵn trong core ESP32).
- `"esp_http_server.h"`: Web Server HTTP/MJPEG hiệu năng cao chạy trên FreeRTOS (có sẵn trong ESP-IDF / core ESP32).

> **Lưu ý tương thích:**
> - Tương thích hoàn toàn với ESP32 Arduino Core phiên bản `2.0.x` và `3.0.x`.
> - Nếu chưa cài ESP32 Core trong Arduino IDE: Vào **Tools** -> **Board** -> **Boards Manager**, tìm kiếm `esp32` của *Espressif Systems* và nhấn **Install**.

---

## 4. Cấu Hình Thông Số Board Trong Arduino IDE

Khi mở file `ESP32_S3_Camera_Stream.ino`, thiết lập menu **Tools** như sau:

| Thông số trong Tools | Giá trị bắt buộc | Ghi chú |
| :--- | :--- | :--- |
| **Board** | `ESP32S3 Dev Module` | Board chuẩn cho dòng chip ESP32-S3 |
| **PSRAM** | `OPI PSRAM` | **Bắt buộc** (Board N16R8 dùng 8MB Octal SPI PSRAM) |
| **Flash Size** | `16MB (128Mb)` | Board N16R8 trang bị 16MB Flash |
| **Partition Scheme** | `16M Flash (3MB APP/9.9MB FATFS)` hoặc `Default 4MB with spiffs` | Đảm bảo đủ dung lượng cho code |
| **USB CDC On Boot** | `Disabled` hoặc `Enabled` | Khuyên dùng `Disabled` khi cắm cổng USB-UART |
| **Port** | Chọn cổng COM nhận diện từ chip CH340/CP2102 | Ví dụ: `COM3`, `COM5`... |

> **Cổng cắm trên board:**
> Cắm dây USB Type-C vào cổng ghi chữ **`USB-UART`** trên bo mạch (cổng này dùng nạp code và xuất log Serial Monitor).

---

## 5. Các Bước Nạp Firmware Và Truy Cập Trình Duyệt

### Bước 1: Kiểm tra cấu hình Wi-Fi
Mở file `config.h` trong thư mục `ESP32_S3_Camera_Stream`:
```cpp
#define WIFI_SSID           "Tên_WiFi_Nhà_Bạn"     // Bắt buộc Wi-Fi băng tần 2.4GHz
#define WIFI_PASSWORD       "Mật_Khẩu_WiFi"
```
*(Trang web xem camera tuyệt đối không hiển thị mật khẩu Wi-Fi này để bảo mật)*.

### Bước 2: Biên dịch và nạp (Upload)
1. Trong Arduino IDE, nhấn nút **Upload** (mũi tên hướng sang phải).
2. Chờ Arduino IDE biên dịch và nạp firmware vào ESP32-S3.

### Bước 3: Lấy địa chỉ IP từ Serial Monitor
1. Mở **Serial Monitor** trong Arduino IDE (Ctrl + Shift + M).
2. Chọn tốc độ baud: **`115200 baud`**.
3. Nếu màn hình chưa hiện chữ, nhấn nút **EN / RST** trên bo mạch để khởi động lại.
4. Màn hình Serial Monitor sẽ hiển thị thông báo:
   ```
   ============================================================
     KARAT RETAIL - CAMERA OV5640 HTTP STREAM & FOCUS TOOL     
     ESP32-S3 | Flash: 16 MB | PSRAM: 8 MB
   ============================================================
   [PSRAM] Khoi tao thanh cong: 8188 KB con trong.
   [CAMERA] Dang khoi tao camera OV5640...
   [CAMERA][OK] Cam bien OV5640 PID: 0x5640
   [CAMERA][OK] Khoi tao camera hoan tat.

   [WIFI] Dang ket noi toi SSID: Hue
   .....
   [WIFI][OK] Ket noi Wi-Fi thanh cong!
   [WIFI] IP Address : 192.168.1.18
   [WIFI] RSSI Signal: -52 dBm
   [HTTP] Dang khoi dong server tren port 80...
   [HTTP][OK] Web server da san sang.
   ------------------------------------------------------------
   [HUONG DAN TRUY CAP]:
     1. Mo trinh duyet (Chrome / Edge / Safari) va vao dia chi:
        http://192.168.1.18/
     2. Xem luong stream truc tiep tai:
        http://192.168.1.18/stream
     3. Chup anh thu tai:
        http://192.168.1.18/capture
   ------------------------------------------------------------
   ```

### Bước 4: Mở trình duyệt xem hình ảnh
1. Mở trình duyệt web (Google Chrome, Microsoft Edge, Cốc Cốc, Safari,...) trên máy tính hoặc điện thoại đang kết nối **cùng mạng Wi-Fi**.
2. Nhập địa chỉ IP hiển thị ở Serial Monitor (ví dụ: `http://192.168.1.18/`).
3. Giao diện điều khiển và màn hình camera trực tiếp sẽ xuất hiện.

---

## 6. Hướng Dẫn Căn Chỉnh Độ Nét Ống Kính OV5640 (Focus Tuning)

Cảm biến OV5640 thường có ống kính dạng ren xoay cơ học (Manual Focus Ring):
1. **Chuẩn bị mẫu thử:** Mở một phiếu xuất/nhập kho có mã QR trên màn hình điện thoại hoặc in ra giấy A4.
2. **Khoảng cách:** Đặt mã QR trước ống kính camera ở cự ly khoảng **15 cm đến 25 cm** (khoảng cách thao tác kho thuận tiện).
3. **Căn chỉnh:**
   - Dùng đầu ngón tay xoay nhẹ ren ống kính OV5640 (theo chiều kim đồng hồ hoặc ngược chiều kim đồng hồ từng chút một).
   - Nhìn trực tiếp trên màn hình trình duyệt:
     - Khi bị mờ (Out of focus): Các module vuông đen trắng bị nhòe, hòa lẫn vào nhau.
     - Khi đúng nét (In focus): Các viền đen trắng của mã QR hiển thị sắc cạnh, rõ từng chi tiết nhỏ.
4. **Kiểm tra độ phân giải:**
   - Thử chuyển trên menu web sang **VGA (640x480)** hoặc **SVGA (800x600)** để xem chi tiết hạt pixel.
   - Nhấn nút **Chụp ảnh tĩnh (Snapshot)** để tải về một tấm hình JPEG tĩnh với chất lượng cao nhất nhằm đánh giá độ nét tuyệt đối.
