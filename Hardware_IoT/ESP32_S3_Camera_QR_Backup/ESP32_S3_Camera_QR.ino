/*
 * ============================================================================
 * KARAT RETAIL - FIRMWARE QUÉT QR CODE CAMERA OV5640 & TRA CỨU BACKEND
 * Phần cứng: ESP32-S3 WROOM Dual Type-C (N16R8) + Cảm biến OV5640 5MP
 * ============================================================================
 *
 * MỤC ĐÍCH:
 * 1. Chụp ảnh liên tục ở định dạng Grayscale (320x240 QVGA) từ OV5640.
 * 2. Nhận diện và giải mã mã QR thời gian thực bằng thư viện engine quirc.
 * 3. Kiểm tra định dạng mã QR phiếu kho (DOC:WH-IN-*, DOC:WH-OUT-*, UUID).
 * 4. Chống quét lặp (Debounce) cho cùng một mã trong khoảng thời gian cấu hình.
 * 5. Gửi HTTP GET request có kèm header 'X-Device-Token' đến Backend Node.js
 *    tại endpoint: /api/v1/warehouse/documents/lookup?identifier=<Mã_QR>
 * 6. Phân tích kết quả JSON và hiển thị trực quan trạng thái phiếu lên Serial Monitor:
 *    - HỢP LỆ (approved): Đã duyệt, hợp lệ để kiểm đếm.
 *    - CHỜ DUYỆT (pending): Quản lý chưa duyệt.
 *    - BỊ TỪ CHỐI (rejected) / BẢN NHÁP (draft) / ĐÃ HOÀN TẤT (completed).
 *    - KHÔNG TÌM THẤY (HTTP 404) / LỖI XÁC THỰC (HTTP 401) / LỖI KẾT NỐI.
 * 7. TUYỆT ĐỐI không tự ý cập nhật tồn kho hay hoàn tất phiếu từ ESP32;
 *    việc xác nhận nhập/xuất kho phải do nhân viên kho thực hiện trên App/Web.
 *
 * YÊU CẦU THƯ VIỆN TRONG ARDUINO IDE:
 * 1. "ArduinoJson" (bởi Benoit Blanchon) - Cài qua Library Manager (Ctrl+Shift+I).
 * 2. Các thư viện WiFi, HTTPClient, esp_camera đã tích hợp sẵn trong ESP32 Core.
 * ============================================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#include "esp_camera.h"
#include "quirc.h"
#include "camera_pins.h"
#include "config.h"

// Biến lưu trạng thái chống quét lặp (Debounce)
static String lastScannedCode = "";
static unsigned long lastScanTimestamp = 0;

// Thống kê số lần quét
static unsigned long totalFramesScanned = 0;
static unsigned long totalQRDetections = 0;

// Khai báo các hàm chức năng
void printBanner();
void checkPSRAM();
bool initCamera();
void connectWiFi();
void qrScannerTask(void *pvParameters);
void processQRCode(const char *qrPayload);
bool isValidKaratWarehouseFormat(const String &code);
void queryBackendDocument(const String &identifier);
String urlEncode(const String &str);

// ============================================================================
// SETUP CHÍNH CỦA ARDUINO
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(1500);

  printBanner();
  checkPSRAM();

  // 1. Khởi tạo Camera OV5640 ở định dạng Grayscale
  Serial.println("[CAMERA] Dang khoi tao camera OV5640...");
  if (!initCamera()) {
    Serial.println("[STOP] Camera khoi tao that bai. Vui long kiem tra lai phan cung.");
    while (true) {
      delay(1000);
    }
  }
  Serial.println("[CAMERA][OK] Khoi tao camera thanh cong.");

  // 2. Kết nối Wi-Fi 2.4GHz
  connectWiFi();

  // 3. Khởi tạo FreeRTOS Task chạy giải mã QR trên Core 1
  // (Core 0 dành cho Wi-Fi & TCP/IP stack để tránh nghẽn mạng)
  Serial.println("[SYSTEM] Dang khoi dong Task quet QR tren Core 1...");
  xTaskCreatePinnedToCore(
    qrScannerTask,       // Hàm thực thi task
    "QR_Scan_Task",      // Tên task
    16 * 1024,           // Kích thước Stack (16KB trong RAM)
    NULL,                // Tham số truyền vào
    5,                   // Mức ưu tiên
    NULL,                // Con trỏ quản lý task
    1                    // Ghim vào Core 1 của ESP32-S3
  );

  Serial.println("============================================================");
  Serial.println(" HE THONG DA SAN SANG! DUA MA QR VAO TRUOC CAMERA DE QUET.");
  Serial.println(" Khoang cach quet ly tuong: 15 cm - 25 cm.");
  Serial.println("============================================================");
}

// ============================================================================
// LOOP CHÍNH (GIỮ TRỐNG HOẶC QUẢN LÝ KẾT NỐI WI-FI)
// ============================================================================
void loop() {
  delay(1000);

  // Tự động kết nối lại nếu Wi-Fi bị ngắt
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastReconnectTime = 0;
    if (millis() - lastReconnectTime > 10000) {
      lastReconnectTime = millis();
      Serial.println("[WIFI][RECONNECT] Mat ket noi Wi-Fi, dang thu lai...");
      WiFi.reconnect();
    }
  }
}

// ============================================================================
// BANNER VÀ KIỂM TRA BỘ NHỚ
// ============================================================================
void printBanner() {
  Serial.println();
  Serial.println("============================================================");
  Serial.println("  KARAT RETAIL - HE THONG QUET QR PHIEU KHO ESP32-S3        ");
  Serial.printf("  Chip: ESP32-S3 | CPU: %d MHz | Flash: %u MB\n",
                ESP.getCpuFreqMHz(),
                (unsigned int)(ESP.getFlashChipSize() / (1024 * 1024)));
  Serial.println("============================================================");
}

void checkPSRAM() {
  if (psramFound()) {
    Serial.printf("[PSRAM] OK - Dung luong: %u MB | Con trong: %u KB\n",
                  (unsigned int)(ESP.getPsramSize() / (1024 * 1024)),
                  (unsigned int)(ESP.getFreePsram() / 1024));
  } else {
    Serial.println("[PSRAM][CANH BAO] Khong tim thay PSRAM!");
    Serial.println("Vui long vao Tools -> PSRAM: Chon 'OPI PSRAM'.");
  }
}

// ============================================================================
// KHỞI TẠO CAMERA VỚI SƠ ĐỒ CHÂN ĐÃ XÁC THỰC
// ============================================================================
bool initCamera() {
  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;

  // Giữ nguyên 100% sơ đồ chân đã chạy thành công
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;

  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;

  config.xclk_freq_hz = 20000000;
  // Dùng định dạng xám (Grayscale) để đưa trực tiếp vào engine giải mã quirc
  config.pixel_format = PIXFORMAT_GRAYSCALE;
  config.frame_size   = CAMERA_FRAME_SIZE;
  config.fb_count     = 2;
  config.fb_location  = CAMERA_FB_IN_PSRAM;
  config.grab_mode    = CAMERA_GRAB_LATEST;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[CAMERA][FAIL] Loi esp_camera_init: 0x%x\n", err);
    return false;
  }

  sensor_t *s = esp_camera_sensor_get();
  if (s != nullptr) {
    Serial.printf("[CAMERA][OK] Cam bien OV5640 PID: 0x%04X\n", s->id.PID);
    // Tối ưu độ sắc nét và tương phản cho việc nhận diện module QR
    if (s->set_contrast)   s->set_contrast(s, 2);
    if (s->set_brightness) s->set_brightness(s, 0);
    if (s->set_saturation) s->set_saturation(s, -2);
    if (s->set_sharpness)  s->set_sharpness(s, 2);
    if (s->set_vflip)      s->set_vflip(s, 1); // Lật ảnh dọc đúng chiều
  }

  return true;
}

// ============================================================================
// KẾT NỐI WI-FI
// ============================================================================
void connectWiFi() {
  Serial.println();
  Serial.printf("[WIFI] Dang ket noi toi SSID: %s\n", WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < (WIFI_TIMEOUT_SEC * 2)) {
    delay(500);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("[WIFI][OK] Ket noi Wi-Fi thanh cong!");
    Serial.printf("[WIFI] IP Address: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[WIFI] Tin hieu RSSI: %d dBm\n", WiFi.RSSI());
  } else {
    Serial.println();
    Serial.println("[WIFI][FAIL] Ket noi Wi-Fi that bai!");
    Serial.println("ESP32 van se tiep tuc quet QR nhung khong the gui du lieu den Backend.");
  }
}

// ============================================================================
// FREERTOS TASK: CHỤP ẢNH & GIẢI MÃ QR LIÊN TỤC
// ============================================================================
void qrScannerTask(void *pvParameters) {
  struct quirc *q = quirc_new();
  if (!q) {
    Serial.println("[QUIRC][FAIL] Khong the khoi tao quirc engine (thieu bo nho).");
    vTaskDelete(NULL);
    return;
  }

  int lastW = 0, lastH = 0;

  while (true) {
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) {
      vTaskDelay(pdMS_TO_TICKS(50));
      continue;
    }

    totalFramesScanned++;

    // Thay đổi kích thước bộ đệm quirc nếu kích thước khung hình thay đổi
    if (fb->width != lastW || fb->height != lastH) {
      if (quirc_resize(q, fb->width, fb->height) < 0) {
        Serial.println("[QUIRC][FAIL] Loi cap phat bo nho resize.");
        esp_camera_fb_return(fb);
        vTaskDelay(pdMS_TO_TICKS(100));
        continue;
      }
      lastW = fb->width;
      lastH = fb->height;
    }

    // Đổ dữ liệu ảnh xám từ frame buffer vào quirc
    uint8_t *image = quirc_begin(q, NULL, NULL);
    memcpy(image, fb->buf, fb->len);
    quirc_end(q);

    // Kiểm tra số lượng mã QR tìm thấy trong frame
    int numCodes = quirc_count(q);
    for (int i = 0; i < numCodes; i++) {
      struct quirc_code code;
      struct quirc_data data;

      quirc_extract(q, i, &code);
      quirc_decode_error_t err = quirc_decode(&code, &data);

      if (err == QUIRC_SUCCESS) {
        // Đảm bảo chuỗi kết thúc bằng null-terminator
        char payloadStr[QUIRC_MAX_PAYLOAD + 1];
        int len = data.payload_len;
        if (len > QUIRC_MAX_PAYLOAD) len = QUIRC_MAX_PAYLOAD;
        memcpy(payloadStr, data.payload, len);
        payloadStr[len] = '\0';

        totalQRDetections++;
        processQRCode(payloadStr);
      }
    }

    // Trả lại frame buffer cho driver camera
    esp_camera_fb_return(fb);

    // Nghỉ nhẹ 30ms giữa các frame để hệ thống không bị nóng
    vTaskDelay(pdMS_TO_TICKS(30));
  }

  quirc_destroy(q);
  vTaskDelete(NULL);
}

// ============================================================================
// XỬ LÝ MÃ QR VỪA ĐỌC ĐƯỢC
// ============================================================================
void processQRCode(const char *qrPayload) {
  String code = String(qrPayload);
  code.trim();

  // In ngay nội dung mã lên Serial Monitor ở 115200 baud theo yêu cầu
  Serial.println();
  Serial.println("============================================================");
  Serial.printf("[QR DETECTED] Ma doc duoc: %s\n", code.c_str());
  Serial.println("============================================================");

  // 1. Kiểm tra chống quét lặp (Debounce)
  unsigned long now = millis();
  if (code.equals(lastScannedCode) && (now - lastScanTimestamp < DEBOUNCE_DELAY_MS)) {
    Serial.printf("[DEBOUNCE] Bo qua ma trung lap trong %d giay: %s\n",
                  (DEBOUNCE_DELAY_MS / 1000), code.c_str());
    return;
  }

  // Cập nhật mốc thời gian và mã vừa quét
  lastScannedCode = code;
  lastScanTimestamp = now;

  // 2. Kiểm tra tính hợp lệ về định dạng của phiếu kho Karat Retail
  if (!isValidKaratWarehouseFormat(code)) {
    Serial.println("[KIỂM TRA ĐỊNH DẠNG] KHÔNG HỢP LỆ!");
    Serial.println("  Giai thich: Ma QR nay khong phai la phieu kho Karat Retail.");
    Serial.println("  Dinh dang ho tro: 'DOC:WH-IN-*', 'DOC:WH-OUT-*', hoac ma UUID phieu kho.");
    return;
  }

  // 3. Gửi mã lên Backend để tra cứu trạng thái
  queryBackendDocument(code);
}

// ============================================================================
// BỘ LỌC ĐỊNH DẠNG MÃ PHIẾU KHO HỢP LỆ
// ============================================================================
bool isValidKaratWarehouseFormat(const String &code) {
  // 1. Mã QR tiêu chuẩn do hệ thống Karat Retail sinh ra: "DOC:WH-IN-..." hoặc "DOC:WH-OUT-..."
  if (code.startsWith("DOC:WH-IN-") || code.startsWith("DOC:WH-OUT-")) {
    return true;
  }

  // 2. Mã số phiếu trực tiếp: "WH-IN-..." hoặc "WH-OUT-..."
  if (code.startsWith("WH-IN-") || code.startsWith("WH-OUT-")) {
    return true;
  }

  // 3. Định dạng mã định danh UUID v4 chuẩn (36 ký tự, có 4 dấu gạch ngang)
  if (code.length() == 36 && code.charAt(8) == '-' && code.charAt(13) == '-' &&
      code.charAt(18) == '-' && code.charAt(23) == '-') {
    return true;
  }

  return false;
}

// ============================================================================
// GỌI API BACKEND NODE.JS TRA CỨU TRẠNG THÁI PHIẾU
// ============================================================================
void queryBackendDocument(const String &identifier) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[BACKEND][LỖI] Khong the tra cuu do ESP32 chua ket noi Wi-Fi.");
    return;
  }

  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);

  // Xây dựng URL tra cứu: /api/v1/warehouse/documents/lookup?identifier=<encode>
  String url = "http://" + String(BACKEND_HOST) + ":" + String(BACKEND_PORT) +
               String(BACKEND_API_BASE) + "/warehouse/documents/lookup?identifier=" + urlEncode(identifier);

  Serial.printf("[HTTP] Dang gui request toi Backend: %s\n", url.c_str());

  http.begin(url);
  // Header xác thực Device Token cho thiết bị IoT
  http.addHeader("X-Device-Token", IOT_DEVICE_TOKEN);
  http.addHeader("Accept", "application/json");

  int httpCode = http.GET();
  Serial.printf("[HTTP] Ma phan hoi (HTTP Status): %d\n", httpCode);

  if (httpCode == HTTP_CODE_OK) { // HTTP 200
    String responseBody = http.getString();
    
    // Giải mã JSON trả về từ Backend (Tương thích cả ArduinoJson v6 lẫn v7)
#if defined(ARDUINOJSON_VERSION_MAJOR) && (ARDUINOJSON_VERSION_MAJOR >= 7)
    JsonDocument doc;
#else
    DynamicJsonDocument doc(4096);
#endif
    DeserializationError error = deserializeJson(doc, responseBody);

    if (error) {
      Serial.printf("[JSON][FAIL] Loi parse JSON tu Backend: %s\n", error.c_str());
      http.end();
      return;
    }

    JsonObject data = doc["data"];
    if (data.isNull()) {
      Serial.println("[JSON][WARN] Phản hồi không có trường dữ liệu 'data'.");
      http.end();
      return;
    }

    const char *docNumber = data["document_number"] | "N/A";
    const char *docType   = data["type"] | "N/A";
    const char *status    = data["status"] | "N/A";
    const char *whName    = data["warehouse_name"] | "Chưa xác định";
    JsonArray items       = data["items"];

    // In bảng kết quả chi tiết lên Serial Monitor
    Serial.println();
    Serial.println("+----------------------------------------------------------+");
    Serial.println("|          KET QUA TRA CUU PHIEU KHO KARAT RETAIL         |");
    Serial.println("+----------------------------------------------------------+");
    Serial.printf("| Ma phieu      : %-40s |\n", docNumber);
    Serial.printf("| Loai phieu    : %-40s |\n", (!strcmp(docType, "import") ? "NHAP KHO" : "XUAT KHO"));
    Serial.printf("| Kho hang      : %-40s |\n", whName);
    Serial.printf("| Trang thai    : %-40s |\n", status);
    Serial.println("+----------------------------------------------------------+");

    // Đánh giá trạng thái nghiệp vụ thực tế
    if (!strcmp(status, "approved")) {
      Serial.println("| => DANH GIA   : [HỢP LỆ] - DA DUOC QUAN LY PHE DUYET!     |");
      Serial.println("| => HUONG DAN  : San sang de thu kho kiem dem thuc te!    |");
    } else if (!strcmp(status, "pending")) {
      Serial.println("| => DANH GIA   : [CHO DUYET] - Quan ly chua phe duyet!    |");
      Serial.println("| => HUONG DAN  : Thu kho KHONG duoc phep xuat/nhap kho!   |");
    } else if (!strcmp(status, "rejected")) {
      Serial.println("| => DANH GIA   : [BI TU CHOI] - Phieu da bi huy bo!       |");
      Serial.println("| => HUONG DAN  : TU CHOI THAO TAC!                        |");
    } else if (!strcmp(status, "completed")) {
      Serial.println("| => DANH GIA   : [DA HOAN TAT] - Phieu da thuc hien roi!  |");
      Serial.println("| => HUONG DAN  : Khong thuc hien lap lai!                 |");
    } else if (!strcmp(status, "draft")) {
      Serial.println("| => DANH GIA   : [BAN NHAP] - Phieu chua duoc gui duyet!  |");
    } else {
      Serial.printf("| => DANH GIA   : Trạng thái khác: %-23s |\n", status);
    }

    // Liệt kê danh sách sản phẩm trong phiếu
    Serial.println("+----------------------------------------------------------+");
    Serial.printf("| Chi tiet san pham can kiem dem (%u mat hang):             |\n", (unsigned int)items.size());
    for (size_t idx = 0; idx < items.size(); idx++) {
      const char *pName = items[idx]["product_name"] | "SanPham";
      int qty = items[idx]["quantity"] | 0;
      const char *sku = items[idx]["sku"] | "";
      Serial.printf("|  %u. %-24s [SKU: %-8s] x %-4d       |\n", (idx + 1), pName, sku, qty);
    }
    Serial.println("+----------------------------------------------------------+");
    Serial.println();

  } else if (httpCode == HTTP_CODE_NOT_FOUND) { // HTTP 404
    Serial.println();
    Serial.println("************************************************************");
    Serial.println("[KẾT QUẢ] KHÔNG TÌM THẤY PHIẾU KHO (HTTP 404)");
    Serial.printf("  Mã tra cứu: %s\n", identifier.c_str());
    Serial.println("  Lý do: Mã QR này không tồn tại trong cơ sở dữ liệu hệ thống.");
    Serial.println("************************************************************");

  } else if (httpCode == HTTP_CODE_UNAUTHORIZED) { // HTTP 401
    Serial.println();
    Serial.println("************************************************************");
    Serial.println("[KẾT QUẢ] LỖI XÁC THỰC THIẾT BỊ IOT (HTTP 401)");
    Serial.println("  Lý do: Khóa 'X-Device-Token' không khớp với Backend.");
    Serial.printf("  Khóa hiện tại trong config.h: %s\n", IOT_DEVICE_TOKEN);
    Serial.println("  Vui lòng kiểm tra lại biến IOT_DEVICE_TOKEN trong Backend/.env.");
    Serial.println("************************************************************");

  } else if (httpCode < 0) { // Lỗi kết nối mạng
    Serial.println();
    Serial.println("************************************************************");
    Serial.println("[KẾT QUẢ] LỖI KẾT NỐI ĐẾN BACKEND NODE.JS");
    Serial.printf("  Mã lỗi HTTPClient: %s (%d)\n", http.errorToString(httpCode).c_str(), httpCode);
    Serial.printf("  Địa chỉ cấu hình: http://%s:%d%s\n", BACKEND_HOST, BACKEND_PORT, BACKEND_API_BASE);
    Serial.println("  Hướng khắc phục:");
    Serial.println("    1. Kiểm tra Backend Node.js đã chạy chưa (npm run dev trong Backend).");
    Serial.println("    2. Kiểm tra địa chỉ IP trong config.h có đúng với IP máy tính (ipconfig).");
    Serial.println("    3. Tắt tường lửa Windows Firewall hoặc mở port 3000 cho mạng nội bộ.");
    Serial.println("************************************************************");

  } else {
    Serial.println();
    Serial.printf("[KẾT QUẢ] BACKEND PHẢN HỒI MÃ LỖI: %d\n", httpCode);
    Serial.println(http.getString());
  }

  http.end();
}

// ============================================================================
// HÀM MÃ HÓA URL (URL ENCODE) CHO CÁC KÝ TỰ ĐẶC BIỆT NHƯ ':', '/', ' '
// ============================================================================
String urlEncode(const String &str) {
  String encoded = "";
  char c;
  char code0;
  char code1;
  for (size_t i = 0; i < str.length(); i++) {
    c = str.charAt(i);
    if (isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') {
      encoded += c;
    } else {
      code0 = (c >> 4) & 0xf;
      code1 = c & 0xf;
      encoded += '%';
      encoded += (char)(code0 > 9 ? code0 - 10 + 'A' : code0 + '0');
      encoded += (char)(code1 > 9 ? code1 - 10 + 'A' : code1 + '0');
    }
  }
  return encoded;
}
