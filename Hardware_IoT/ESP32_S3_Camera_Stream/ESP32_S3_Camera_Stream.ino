/*
 * ============================================================================
 * KARAT RETAIL - FIRMWARE KIỂM TRA ĐỘ NÉT CAMERA QUA TRÌNH DUYỆT (HTTP STREAM)
 * Phần cứng: ESP32-S3 WROOM Dual Type-C (N16R8) + Cảm biến OV5640 5MP
 * ============================================================================
 *
 * MỤC ĐÍCH:
 * 1. Truyền hình ảnh trực tiếp (MJPEG Live Stream) qua Wi-Fi lên trình duyệt.
 * 2. Căn chỉnh vòng xoay lấy nét ống kính (Lens Focus Ring) của OV5640 để đạt
 *    độ sắc nét tối đa cho mã QR ở khoảng cách thực tế (15cm - 25cm).
 * 3. Tùy chỉnh trực tiếp độ phân giải (QVGA, VGA, SVGA, XGA) và thông số ảnh
 *    (độ sáng, tương phản, lật ảnh) ngay trên giao diện web.
 *
 * YÊU CẦU CẤU HÌNH ARDUINO IDE:
 * - Board: "ESP32S3 Dev Module"
 * - USB CDC On Boot: "Enable" (hoặc "Disable" nếu cắm cổng USB-UART)
 * - Flash Size: "16MB (128Mb)"
 * - Partition Scheme: "16M Flash (3MB APP/9.9MB FATFS)" hoặc "Default 4MB with spiffs"
 * - PSRAM: "OPI PSRAM" (BẮT BUỘC cho bản N16R8)
 * - Cổng nạp & Serial Monitor: Cắm cáp vào cổng "USB-UART", chọn đúng COM port.
 * - Tốc độ Serial: 115200 baud
 * ============================================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include "esp_camera.h"
#include "esp_http_server.h"
#include "esp_timer.h"
#include "camera_pins.h"
#include "config.h"

// Biến quản lý HTTP Server của ESP-IDF
static httpd_handle_t stream_httpd = NULL;

#define PART_BOUNDARY "123456789000000000000987654321"
static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* _STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

// ============================================================================
// GIAO DIỆN WEB TRÊN TRÌNH DUYỆT (HTML5 + CSS HIỆN ĐẠI + JAVASCRIPT ĐIỀU KHIỂN)
// Hoàn toàn không chứa thông tin nhạy cảm (không hiển thị mật khẩu Wi-Fi)
// ============================================================================
static const char PROGMEM INDEX_HTML[] = R"rawliteral(
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Karat Retail - Camera OV5640 Stream & Focus Tool</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --accent: #38bdf8;
      --accent-hover: #0ea5e9;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --border: #334155;
      --success: #22c55e;
      --danger: #ef4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      padding: 16px;
    }
    header {
      width: 100%;
      max-width: 960px;
      margin-bottom: 16px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      padding-bottom: 12px;
    }
    h1 { font-size: 1.25rem; font-weight: 700; color: var(--accent); }
    .badge {
      font-size: 0.75rem;
      background: rgba(56, 189, 248, 0.15);
      color: var(--accent);
      padding: 4px 10px;
      border-radius: 9999px;
      border: 1px solid rgba(56, 189, 248, 0.3);
    }
    .main-container {
      width: 100%;
      max-width: 960px;
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
    }
    @media (min-width: 768px) {
      .main-container {
        grid-template-columns: 3fr 2fr;
      }
    }
    .view-card, .controls-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
    }
    .video-wrapper {
      position: relative;
      width: 100%;
      background: #000;
      border-radius: 8px;
      overflow: hidden;
      aspect-ratio: 4 / 3;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    #stream-view {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      display: block;
    }
    .reticle {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 180px;
      height: 180px;
      border: 2px dashed rgba(56, 189, 248, 0.8);
      border-radius: 8px;
      pointer-events: none;
      display: flex;
      align-items: center;
      justify-content: center;
      color: rgba(56, 189, 248, 0.9);
      font-size: 0.75rem;
      text-shadow: 0 1px 2px #000;
      box-shadow: inset 0 0 12px rgba(56, 189, 248, 0.2);
    }
    .reticle::before, .reticle::after {
      content: '';
      position: absolute;
      background: var(--accent);
    }
    .reticle::before { width: 16px; height: 2px; }
    .reticle::after { width: 2px; height: 16px; }
    .status-bar {
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .form-group {
      margin-bottom: 14px;
    }
    label {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 6px;
      color: var(--text);
    }
    select, input[type="range"] {
      width: 100%;
      padding: 8px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: #0f172a;
      color: var(--text);
      font-size: 0.9rem;
    }
    .range-val {
      display: inline-block;
      float: right;
      color: var(--accent);
      font-size: 0.8rem;
    }
    .btn-row {
      display: flex;
      gap: 10px;
      margin-top: 14px;
    }
    button {
      flex: 1;
      padding: 10px 14px;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.85rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    .btn-primary { background: var(--accent); color: #0f172a; }
    .btn-primary:hover { background: var(--accent-hover); }
    .btn-secondary { background: #334155; color: var(--text); }
    .btn-secondary:hover { background: #475569; }
    .guide-box {
      margin-top: 16px;
      padding: 12px;
      background: rgba(56, 189, 248, 0.08);
      border-left: 3px solid var(--accent);
      border-radius: 4px;
      font-size: 0.8rem;
      line-height: 1.45;
      color: var(--text-muted);
    }
    .guide-box strong { color: var(--text); }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>Karat Retail - Camera OV5640 Focus Tool</h1>
      <small style="color: var(--text-muted)">ESP32-S3 WROOM Dual Type-C (N16R8)</small>
    </div>
    <div class="badge" id="net-badge">Wi-Fi Online</div>
  </header>

  <div class="main-container">
    <div class="view-card">
      <div class="video-wrapper">
        <img id="stream-view" src="/stream" alt="Camera Stream" />
        <div class="reticle" id="reticle">Vùng đặt mã QR</div>
      </div>
      <div class="status-bar">
        <span id="fps-counter">Stream: Đang chạy</span>
        <span id="res-indicator">Độ phân giải: Đang tải...</span>
      </div>
      <div class="btn-row">
        <button class="btn-primary" onclick="captureSnapshot()">Chụp ảnh tĩnh (Snapshot)</button>
        <button class="btn-secondary" onclick="toggleReticle()">Bật/Tắt khung ngắm</button>
      </div>
    </div>

    <div class="controls-card">
      <h3 style="font-size: 1rem; margin-bottom: 12px; color: var(--accent);">Tùy chỉnh thông số hình ảnh</h3>
      
      <div class="form-group">
        <label for="framesize">Độ phân giải (Frame Size)</label>
        <select id="framesize" onchange="sendControl('framesize', this.value)">
          <option value="5">QVGA (320x240) - Nhanh nhất (Tương đương bản chẩn đoán)</option>
          <option value="6" selected>VGA (640x480) - Tiêu chuẩn kiểm tra độ nét</option>
          <option value="7">SVGA (800x600) - Độ nét cao</option>
          <option value="8">XGA (1024x768) - Chi tiết cực cao</option>
        </select>
      </div>

      <div class="form-group">
        <label for="quality">Chất lượng ảnh (Quality: 10 nét nhất - 30 nén cao) <span class="range-val" id="val-quality">12</span></label>
        <input type="range" id="quality" min="10" max="30" value="12" oninput="updateRange('quality', this.value)" onchange="sendControl('quality', this.value)">
      </div>

      <div class="form-group">
        <label for="brightness">Độ sáng (Brightness: -2 đến +2) <span class="range-val" id="val-brightness">0</span></label>
        <input type="range" id="brightness" min="-2" max="2" value="0" oninput="updateRange('brightness', this.value)" onchange="sendControl('brightness', this.value)">
      </div>

      <div class="form-group">
        <label for="contrast">Độ tương phản (Contrast: -2 đến +2) <span class="range-val" id="val-contrast">2</span></label>
        <input type="range" id="contrast" min="-2" max="2" value="2" oninput="updateRange('contrast', this.value)" onchange="sendControl('contrast', this.value)">
      </div>

      <div class="form-group">
        <label for="vflip">Lật dọc hình ảnh (V-Flip)</label>
        <select id="vflip" onchange="sendControl('vflip', this.value)">
          <option value="0">Bình thường (0)</option>
          <option value="1" selected>Lật ngược (1) - Khuyên dùng nếu camera bị ngược</option>
        </select>
      </div>

      <div class="guide-box">
        <strong>Hướng dẫn chỉnh nét ống kính OV5640:</strong><br>
        1. Đặt tờ phiếu có in mã QR mẫu cách camera khoảng <strong>15 - 25 cm</strong>.<br>
        2. Dùng tay xoay nhẹ ren vòng ống kính kim loại/nhựa của camera OV5640 theo chiều kim đồng hồ hoặc ngược lại.<br>
        3. Quan sát các đường viền đen trắng của mã QR trên màn hình đến khi các góc vuông và module đạt độ sắc cạnh tối đa.
      </div>
    </div>
  </div>

  <script>
    function updateRange(id, val) {
      document.getElementById('val-' + id).innerText = val;
    }
    function sendControl(variable, value) {
      fetch('/control?var=' + variable + '&val=' + value)
        .then(res => {
          if (!res.ok) console.error('Lỗi điều khiển:', variable);
        })
        .catch(err => console.error(err));
    }
    function captureSnapshot() {
      window.open('/capture', '_blank');
    }
    function toggleReticle() {
      const el = document.getElementById('reticle');
      el.style.display = (el.style.display === 'none') ? 'flex' : 'none';
    }
  </script>
</body>
</html>
)rawliteral";

// ============================================================================
// CÁC HÀM XỬ LÝ HTTP REQUEST (HANDLERS)
// ============================================================================

// 1. Trả về trang chủ HTML
static esp_err_t index_handler(httpd_req_t *req) {
  httpd_resp_set_type(req, "text/html; charset=utf-8");
  return httpd_resp_send(req, INDEX_HTML, HTTPD_RESP_USE_STRLEN);
}

// 2. Chụp và trả về 1 ảnh tĩnh JPEG duy nhất
static esp_err_t capture_handler(httpd_req_t *req) {
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("[HTTP][FAIL] Khong the chup anh.");
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Content-Disposition", "inline; filename=capture.jpg");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

  esp_err_t res = httpd_resp_send(req, (const char *)fb->buf, fb->len);
  esp_camera_fb_return(fb);
  return res;
}

// 3. Truyền luồng MJPEG liên tục cho trình duyệt
static esp_err_t stream_handler(httpd_req_t *req) {
  camera_fb_t *fb = NULL;
  esp_err_t res = ESP_OK;
  size_t _jpg_buf_len = 0;
  uint8_t *_jpg_buf = NULL;
  char part_buf[64];

  res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
  if (res != ESP_OK) {
    return res;
  }
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

  while (true) {
    fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("[STREAM][WARN] Khong lay duoc frame tu camera");
      res = ESP_FAIL;
    } else {
      _jpg_buf_len = fb->len;
      _jpg_buf = fb->buf;
    }

    if (res == ESP_OK) {
      size_t hlen = snprintf(part_buf, 64, _STREAM_PART, _jpg_buf_len);
      res = httpd_resp_send_chunk(req, part_buf, hlen);
    }
    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, (const char *)_jpg_buf, _jpg_buf_len);
    }
    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, _STREAM_BOUNDARY, strlen(_STREAM_BOUNDARY));
    }

    if (fb) {
      esp_camera_fb_return(fb);
      fb = NULL;
      _jpg_buf = NULL;
    } else if (res != ESP_OK) {
      break;
    }

    if (res != ESP_OK) {
      break;
    }
  }

  return res;
}

// 4. Xử lý thay đổi thông số cảm biến (/control?var=...&val=...)
static esp_err_t control_handler(httpd_req_t *req) {
  char* buf = NULL;
  size_t buf_len = httpd_req_get_url_query_len(req) + 1;
  if (buf_len <= 1) {
    httpd_resp_send_404(req);
    return ESP_FAIL;
  }

  buf = (char*)malloc(buf_len);
  if (!buf) {
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  if (httpd_req_get_url_query_str(req, buf, buf_len) != ESP_OK) {
    free(buf);
    httpd_resp_send_404(req);
    return ESP_FAIL;
  }

  char var[32] = {0};
  char val[32] = {0};
  httpd_query_key_value(buf, "var", var, sizeof(var));
  httpd_query_key_value(buf, "val", val, sizeof(val));
  free(buf);

  int int_val = atoi(val);
  sensor_t *s = esp_camera_sensor_get();
  int res = 0;

  if (s == NULL) {
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  if (!strcmp(var, "framesize")) {
    if (s->pixformat == PIXFORMAT_JPEG) {
      res = s->set_framesize(s, (framesize_t)int_val);
      Serial.printf("[CONTROL] Set framesize to %d (result: %d)\n", int_val, res);
    }
  } else if (!strcmp(var, "quality")) {
    res = s->set_quality(s, int_val);
  } else if (!strcmp(var, "contrast")) {
    res = s->set_contrast(s, int_val);
  } else if (!strcmp(var, "brightness")) {
    res = s->set_brightness(s, int_val);
  } else if (!strcmp(var, "vflip")) {
    res = s->set_vflip(s, int_val);
  } else {
    res = -1;
  }

  if (res < 0) {
    return httpd_resp_send_500(req);
  }

  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  return httpd_resp_send(req, "OK", 2);
}

// Khởi chạy HTTP Server
void startCameraServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = HTTP_SERVER_PORT;
  config.ctrl_port = 32768;
  config.max_uri_handlers = 8;
  config.stack_size = 4096;

  httpd_uri_t index_uri = {
    .uri       = "/",
    .method    = HTTP_GET,
    .handler   = index_handler,
    .user_ctx  = NULL
  };

  httpd_uri_t stream_uri = {
    .uri       = "/stream",
    .method    = HTTP_GET,
    .handler   = stream_handler,
    .user_ctx  = NULL
  };

  httpd_uri_t capture_uri = {
    .uri       = "/capture",
    .method    = HTTP_GET,
    .handler   = capture_handler,
    .user_ctx  = NULL
  };

  httpd_uri_t control_uri = {
    .uri       = "/control",
    .method    = HTTP_GET,
    .handler   = control_handler,
    .user_ctx  = NULL
  };

  Serial.printf("[HTTP] Dang khoi dong server tren port %d...\n", config.server_port);
  if (httpd_start(&stream_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(stream_httpd, &index_uri);
    httpd_register_uri_handler(stream_httpd, &stream_uri);
    httpd_register_uri_handler(stream_httpd, &capture_uri);
    httpd_register_uri_handler(stream_httpd, &control_uri);
    Serial.println("[HTTP][OK] Web server da san sang.");
  } else {
    Serial.println("[HTTP][FAIL] Khong the khoi dong web server.");
  }
}

// ============================================================================
// KHỞI TẠO PHẦN CỨNG CAMERA
// ============================================================================
bool initCameraForStreaming() {
  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;

  // Giữ nguyên 100% các chân camera đã kiểm chứng
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
  // Dùng định dạng JPEG trực tiếp từ cảm biến OV5640 để stream cho trình duyệt
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size   = INITIAL_FRAME_SIZE;
  config.jpeg_quality = INITIAL_JPEG_QUALITY;
  config.fb_count     = 2;
  config.fb_location  = CAMERA_FB_IN_PSRAM;
  config.grab_mode    = CAMERA_GRAB_LATEST;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[CAMERA][FAIL] esp_camera_init that bai voi ma loi: 0x%x\n", err);
    return false;
  }

  sensor_t *s = esp_camera_sensor_get();
  if (s != NULL) {
    Serial.printf("[CAMERA][OK] Cam bien OV5640 PID: 0x%04X\n", s->id.PID);
    // Áp dụng thiết lập tối ưu để quan sát độ tương phản của mã QR
    if (s->set_contrast)   s->set_contrast(s, 2);
    if (s->set_brightness) s->set_brightness(s, 0);
    if (s->set_saturation) s->set_saturation(s, -1);
    if (s->set_sharpness)  s->set_sharpness(s, 2);
    if (s->set_vflip)      s->set_vflip(s, 1); // Lật ảnh dọc cho chiều đọc thuận
  }

  return true;
}

// Kết nối Wi-Fi
void connectWiFi() {
  Serial.println();
  Serial.printf("[WIFI] Dang ket noi toi SSID: %s\n", WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < (WIFI_CONNECT_TIMEOUT_SEC * 2)) {
    delay(500);
    Serial.print(".");
    retry++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("[WIFI][OK] Ket noi Wi-Fi thanh cong!");
    Serial.printf("[WIFI] IP Address : %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[WIFI] RSSI Signal: %d dBm\n", WiFi.RSSI());
  } else {
    Serial.println();
    Serial.println("[WIFI][FAIL] Ket noi Wi-Fi that bai!");
    Serial.println("Kiem tra lai SSID va Mat khau trong file config.h (chi ho tro Wi-Fi 2.4GHz).");
  }
}

// ============================================================================
// ARDUINO MAIN SETUP & LOOP
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(1500);

  Serial.println();
  Serial.println("============================================================");
  Serial.println("  KARAT RETAIL - CAMERA OV5640 HTTP STREAM & FOCUS TOOL     ");
  Serial.printf("  ESP32-S3 | Flash: %u MB | PSRAM: %u MB\n",
                (unsigned int)(ESP.getFlashChipSize() / (1024 * 1024)),
                (unsigned int)(ESP.getPsramSize() / (1024 * 1024)));
  Serial.println("============================================================");

  // 1. Kiểm tra PSRAM
  if (psramFound()) {
    Serial.printf("[PSRAM] Khoi tao thanh cong: %u KB con trong.\n",
                  (unsigned int)(ESP.getFreePsram() / 1024));
  } else {
    Serial.println("[PSRAM][CANH BAO] Khong tim thay PSRAM!");
    Serial.println("Vui long vao menu Tools -> PSRAM: Chon 'OPI PSRAM'.");
  }

  // 2. Khởi tạo Camera
  Serial.println("[CAMERA] Dang khoi tao camera OV5640...");
  if (!initCameraForStreaming()) {
    Serial.println("[STOP] Khong the tiep tuc do camera khoi tao that bai.");
    while (true) {
      delay(1000);
    }
  }
  Serial.println("[CAMERA][OK] Khoi tao camera hoan tat.");

  // 3. Kết nối Wi-Fi
  connectWiFi();

  // 4. Khởi động Web Server nếu đã có IP
  if (WiFi.status() == WL_CONNECTED) {
    startCameraServer();
    Serial.println("------------------------------------------------------------");
    Serial.println("[HUONG DAN TRUY CAP]:");
    Serial.printf("  1. Mo trinh duyet (Chrome / Edge / Safari) va vao dia chi:\n");
    Serial.printf("     http://%s/\n", WiFi.localIP().toString().c_str());
    Serial.println("  2. Xem luong stream truc tiep tai:");
    Serial.printf("     http://%s/stream\n", WiFi.localIP().toString().c_str());
    Serial.println("  3. Chup anh thu tai:");
    Serial.printf("     http://%s/capture\n", WiFi.localIP().toString().c_str());
    Serial.println("------------------------------------------------------------");
  } else {
    Serial.println("[CANH BAO] Web server chua duoc khoi chay do chua co ket noi Wi-Fi.");
  }
}

void loop() {
  // Loop để trống vì esp_http_server hoạt động bằng Background Task riêng của ESP-IDF (FreeRTOS)
  delay(1000);

  // Tự động kiểm tra và phục hồi nếu Wi-Fi bị ngắt quãng
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastReconnectAttempt = 0;
    if (millis() - lastReconnectAttempt > 10000) {
      lastReconnectAttempt = millis();
      Serial.println("[WIFI][RECONNECT] Dang thu ket noi lai Wi-Fi...");
      WiFi.reconnect();
    }
  }
}
