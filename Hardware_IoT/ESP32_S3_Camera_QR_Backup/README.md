# Hướng Dẫn Sử Dụng Firmware Quét QR Phiếu Kho ESP32-S3 (Karat Retail)

## 1. Giới Thiệu
Firmware này nằm trong thư mục `Hardware_IoT/ESP32_S3_Camera_QR/`. Đây là bản firmware độc lập, **không ghi đè** lên bản chẩn đoán (`ESP32_S3_Camera`) hay bản xem stream (`ESP32_S3_Camera_Stream`).

### Nhiệm vụ của firmware:
1. Đọc hình ảnh liên tục từ camera OV5640 ở định dạng ảnh xám (Grayscale QVGA 320x240).
2. Tự động tìm kiếm và giải mã mã QR theo thời gian thực (xử lý trên Core 1 bằng FreeRTOS).
3. Kiểm tra tính hợp lệ về mặt định dạng của mã QR phiếu kho (`DOC:WH-IN-*`, `DOC:WH-OUT-*`, mã UUID).
4. Chống gửi dồn dập (Debounce) khi người dùng giữ mã QR trước camera.
5. In mã đọc được lên Serial Monitor ở tốc độ `115200 baud`.
6. Tự động gửi HTTP GET request kèm header bảo mật `X-Device-Token` về Backend Node.js để tra cứu thông tin phiếu.
7. Hiển thị bảng kết quả rõ ràng: Hợp lệ (đã duyệt), Chờ duyệt, Bị từ chối, Bản nháp, Đã hoàn tất, Không tìm thấy (404), Lỗi xác thực (401), hoặc Lỗi kết nối mạng.
8. **Tuân thủ nghiệp vụ:** ESP32 **không** tự ý cập nhật tồn kho hay hoàn tất phiếu; việc xác nhận nhập/xuất kho phải do nhân viên kho thực hiện trên Web/App sau khi kiểm đếm thực tế.

---

## 2. Cài Đặt Thư Viện Trong Arduino IDE

### Thư viện cần cài thêm:
Bạn chỉ cần cài đặt **duy nhất 1 thư viện** từ Arduino Library Manager:
* **Tên thư viện:** `ArduinoJson` (tác giả: **Benoit Blanchon**).
* **Cách cài:**
  1. Mở Arduino IDE.
  2. Vào menu **Tools** -> **Manage Libraries...** (hoặc phím tắt `Ctrl + Shift + I`).
  3. Gõ tìm kiếm: `ArduinoJson`.
  4. Nhấn nút **Install** (hỗ trợ cả phiên bản 6.x lẫn 7.x).

### Về thư viện giải mã QR:
- Thư viện engine `quirc` (tiêu chuẩn ANSI C tối ưu cho ESP32 PSRAM) **đã được đóng gói sẵn trực tiếp** trong thư mục sketch (`quirc.h`, `quirc.c`, `decode.c`, `identify.c`, `version_db.c`).
- Bạn **không cần** phải tải file ZIP thủ công hay sửa đổi thư mục `include/` phức tạp.
- Các thư viện mạng `<WiFi.h>`, `<HTTPClient.h>` và `"esp_camera.h"` đã có sẵn trong ESP32 Arduino Core của Espressif.

---

## 3. Cấu Hình Thông Số Board Trong Arduino IDE

Mở file [ESP32_S3_Camera_QR.ino](file:///d:/hoc/doantn/1150080128_LYCHICHUONG_Source_DATN/Hardware_IoT/ESP32_S3_Camera_QR/ESP32_S3_Camera_QR.ino), thiết lập menu **Tools**:

| Thông số trong Tools | Thiết lập bắt buộc | Giải thích |
| :--- | :--- | :--- |
| **Board** | `ESP32S3 Dev Module` | Board vi điều khiển ESP32-S3 |
| **PSRAM** | `OPI PSRAM` | **BẮT BUỘC** (Bo mạch N16R8 trang bị 8MB Octal PSRAM) |
| **Flash Size** | `16MB (128Mb)` | Bo mạch trang bị 16MB bộ nhớ Flash |
| **Partition Scheme** | `16M Flash (3MB APP/9.9MB FATFS)` hoặc `Default 4MB with spiffs` | Đảm bảo đủ không gian nạp code |
| **USB CDC On Boot** | `Disabled` | Dùng chuẩn UART qua cổng CP2102/CH340 |
| **Port** | Chọn cổng COM của bo mạch | Ví dụ: `COM3`, `COM7`... |

> **Cổng cắm trên bo mạch:** Cắm cáp USB Type-C vào cổng in chữ **`USB-UART`**.

---

## 4. Cấu Hình Wi-Fi Và IP Backend Trong `config.h`

Mở file [config.h](file:///d:/hoc/doantn/1150080128_LYCHICHUONG_Source_DATN/Hardware_IoT/ESP32_S3_Camera_QR/config.h) và cập nhật 2 mục sau:

### 1. Cấu hình Wi-Fi:
```cpp
#define WIFI_SSID           "Tên_WiFi_Nhà_Bạn"     // Bắt buộc Wi-Fi 2.4GHz
#define WIFI_PASSWORD       "Mật_Khẩu_WiFi"
```

### 2. Cấu hình IP máy tính chạy Backend Node.js:
- Mở Command Prompt (`cmd`) trên Windows, gõ lệnh `ipconfig` và tìm dòng **IPv4 Address** của Wi-Fi (ví dụ: `192.168.1.15`).
- Điền vào `config.h`:
```cpp
#define BACKEND_HOST        "192.168.1.15"  // Thay bằng IP máy tính của bạn
#define BACKEND_PORT        3000
#define BACKEND_API_BASE    "/api/v1"
#define IOT_DEVICE_TOKEN    "karat_esp32_device_token"
```
*(Lưu ý: Không điền `localhost` hay `127.0.0.1` vì ESP32 là thiết bị chạy độc lập).*

---

## 5. Các Bước Nạp Firmware Và Kiểm Thử

### Bước 1: Biên dịch và Nạp (Upload)
1. Trong Arduino IDE, nhấn nút **Verify** (dấu tích) để kiểm tra biên dịch.
2. Nhấn nút **Upload** (mũi tên sang phải) để nạp firmware vào ESP32-S3.

### Bước 2: Mở Serial Monitor
1. Mở **Serial Monitor** (Ctrl + Shift + M), đặt baudrate là **`115200 baud`**.
2. Nhấn nút **EN / RST** trên bo mạch ESP32-S3.
3. Khi khởi động, màn hình Serial Monitor sẽ hiển thị:
   ```
   ============================================================
     KARAT RETAIL - HE THONG QUET QR PHIEU KHO ESP32-S3        
     Chip: ESP32-S3 | CPU: 240 MHz | Flash: 16 MB
   ============================================================
   [PSRAM] OK - Dung luong: 8 MB | Con trong: 8188 KB
   [CAMERA] Dang khoi tao camera OV5640...
   [CAMERA][OK] Cam bien OV5640 PID: 0x5640
   [CAMERA][OK] Khoi tao camera thanh cong.

   [WIFI] Dang ket noi toi SSID: Hue
   .....
   [WIFI][OK] Ket noi Wi-Fi thanh cong!
   [WIFI] IP Address: 192.168.1.18
   [SYSTEM] Dang khoi dong Task quet QR tren Core 1...
   ============================================================
    HE THONG DA SAN SANG! DUA MA QR VAO TRUOC CAMERA DE QUET.
    Khoang cach quet ly tuong: 15 cm - 25 cm.
   ============================================================
   ```

### Bước 3: Đưa Mã QR Vào Trước Camera
1. Chuẩn bị mã QR của phiếu kho:
   - Đăng nhập Web Quản lý Karat Retail -> vào trang **Phê duyệt chứng từ** (`/warehouse/approvals`) -> mở một phiếu đã duyệt có mã QR dạng `DOC:WH-IN-20261028-0001`.
   - Hoặc bạn có thể dùng điện thoại tạo mã QR có nội dung: `DOC:WH-IN-20261028-0001`.
2. Đặt mã QR trước camera ở khoảng cách **15 cm đến 25 cm**.
3. Khi camera nhận diện được mã, Serial Monitor sẽ lập tức in ra:
   ```
   ============================================================
   [QR DETECTED] Ma doc duoc: DOC:WH-IN-20261028-0001
   ============================================================
   [HTTP] Dang gui request toi Backend: http://192.168.1.3:3000/api/v1/warehouse/documents/lookup?identifier=DOC%3AWH-IN-20261028-0001
   [HTTP] Ma phan hoi (HTTP Status): 200

   +----------------------------------------------------------+
   |          KET QUA TRA CUU PHIEU KHO KARAT RETAIL         |
   +----------------------------------------------------------+
   | Ma phieu      : WH-IN-20261028-0001                      |
   | Loai phieu    : NHAP KHO                                 |
   | Kho hang      : Kho Tổng TP.HCM                          |
   | Trang thai    : approved                                 |
   +----------------------------------------------------------+
   | => DANH GIA   : [HỢP LỆ] - DA DUOC QUAN LY PHE DUYET!     |
   | => HUONG DAN  : San sang de thu kho kiem dem thuc te!    |
   +----------------------------------------------------------+
   | Chi tiet san pham can kiem dem (1 mat hang):             |
   |  1. Nhẫn Vàng Karat 18K      [SKU: RN-001  ] x 5         |
   +----------------------------------------------------------+
   ```

---

## 6. Các Tình Huống Phản Hồi Từ Hệ Thống

| Tình huống quét | Phản hồi trên Serial Monitor | Ý nghĩa nghiệp vụ |
| :--- | :--- | :--- |
| **Phiếu đã được quản lý duyệt** | `=> DANH GIA : [HỢP LỆ] - DA DUOC QUAN LY PHE DUYET!` | Đủ điều kiện để thủ kho nhận hàng/xuất hàng vào kho. |
| **Phiếu mới tạo, chưa duyệt** | `=> DANH GIA : [CHO DUYET] - Quan ly chua phe duyet!` | Cảnh báo: Thủ kho không được phép xuất/nhập khi chưa có lệnh duyệt. |
| **Phiếu bị từ chối** | `=> DANH GIA : [BI TU CHOI] - Phieu da bi huy bo!` | Từ chối giao dịch hoàn toàn. |
| **Phiếu đã nhập trước đó** | `=> DANH GIA : [DA HOAN TAT] - Phieu da thuc hien roi!` | Cảnh báo: Tránh gian lận hoặc nhập kho trùng lặp 2 lần. |
| **Mã QR linh tinh (URL, chữ)** | `[KIỂM TRA ĐỊNH DẠNG] KHÔNG HỢP LỆ!` | Từ chối xử lý ngay tại ESP32, không gửi request rác lên server. |
| **Mã không có trong CSDL** | `[KẾT QUẢ] KHÔNG TÌM THẤY PHIẾU KHO (HTTP 404)` | Mã giả mạo hoặc phiếu đã bị xóa. |
| **Sai Token thiết bị IoT** | `[KẾT QUẢ] LỖI XÁC THỰC THIẾT BỊ IOT (HTTP 401)` | Token thiết bị không hợp lệ, bị hệ thống bảo mật từ chối. |
| **Máy tính tắt Backend / Sai IP** | `[KẾT QUẢ] LỖI KẾT NỐI ĐẾN BACKEND NODE.JS` | Hướng dẫn kiểm tra lại IP và khởi động server Backend. |
