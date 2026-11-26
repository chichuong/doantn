/*
 * ============================================================================
 * KARAT RETAIL - FIRMWARE QUÉT QR SIÊU NHẠY + LIVE CAMERA & TỰ ĐỘNG KẾT NỐI WI-FI
 * Phần cứng: ESP32-S3 WROOM Dual Type-C (N16R8) + Cảm biến OV5640 5MP
 * Phiên bản: v2.5 - Multi-Pass Adaptive QR, Live Viewfinder & Smart Auto-WiFi
 * ============================================================================
 *
 * CÁC NÂNG CẤP ĐỘT PHÁ (v2.5):
 * 1. TỰ ĐỘNG NHẬN DIỆN & KẾT NỐI WI-FI THÔNG MINH (4 CƠ CHẾ):
 *    - Tự động quét sóng 2.4GHz xung quanh (WiFi.scanNetworks), đối chiếu với
 *      bộ nhớ Flash không mất điện (NVS Preferences) và cấu hình mặc định, chọn
 *      mạng có cường độ sóng (RSSI) mạnh nhất để tự kết nối.
 *    - QUÉT MÃ QR ĐỂ ĐỔI WI-FI & IP BACKEND TỨC THÌ: Hỗ trợ quét trực tiếp mã QR
 *      chia sẻ Wi-Fi từ điện thoại (WIFI:S:TenWiFi;T:WPA;P:MatKhau;;) hoặc mã QR
 *      tạo từ Web Karat Retail (KARAT_WIFI:SSID|PASS|BACKEND_IP).
 *    - Nếu đến nơi mới chưa có Wi-Fi quen thuộc, tự động phát điểm truy cập AP
 *      "Karat-ESP32-Cam" (MK: 12345678, IP: 192.168.4.1) kèm giao diện Web quét
 *      & chọn mạng Wi-Fi xung quanh.
 *    - Tự động phát gói tin báo danh (Auto-Discovery Heartbeat) về Backend và
 *      quảng bá tên miền http://karat-cam.local để Web tự động nhận diện IP Cam!
 * 2. TỐI ƯU TỐC ĐỘ QUÉT QR SIÊU NHẠY & HẾT GIẬT LAG:
 *    - Sử dụng FPU 32-bit phần cứng (float) + Internal SRAM + Multi-Pass Adaptive
 *      Thresholding (chống lóa màn hình điện thoại, chống bóng đổ).
 *    - Tách biệt Core 1 (Quét QR 22-28 FPS) và Core 0 (MJPEG Live Stream port 81).
 * ============================================================================
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <ESPmDNS.h>
#include <ArduinoJson.h>

#include "esp_camera.h"
#include "esp_http_server.h"
#include "img_converters.h"
#include "esp_heap_caps.h"
#include "quirc.h"
#include "camera_pins.h"
#include "config.h"

// ============================================================================
// LƯU TRỮ CẤU HÌNH ĐỘNG (NVS FLASH PREFERENCES)
// ============================================================================
static Preferences prefs;
static String activeWifiSsid    = WIFI_SSID;
static String activeWifiPass    = WIFI_PASSWORD;
static String activeBackendHost = BACKEND_HOST;
static int    activeBackendPort = BACKEND_PORT;
static bool   webServersStarted = false;

// Biến lưu trạng thái chống quét lặp (Debounce)
static String lastScannedCode = "";
static unsigned long lastScanTimestamp = 0;

// Thống kê tốc độ & bộ đếm
static volatile unsigned long totalFramesScanned = 0;
static volatile unsigned long totalQRDetections = 0;
static volatile float currentScanFps = 0.0f;

// Tọa độ 4 góc mã QR phát hiện gần nhất (để vẽ khung xanh trực tiếp trên Web)
struct CornerPoint {
  int x;
  int y;
};
static volatile CornerPoint lastCorners[4] = {{0, 0}, {0, 0}, {0, 0}, {0, 0}};
static volatile unsigned long lastCornerDetectedMs = 0;
static volatile int currentFrameW = 320;
static volatile int currentFrameH = 240;

// Hàng đợi truyền tin giữa Task quét QR (Core 1) và Main Loop (Core 0)
#define MAX_QR_PAYLOAD_LEN  1024
static portMUX_TYPE qrMux = portMUX_INITIALIZER_UNLOCKED;
static volatile bool hasPendingQR = false;
static char pendingQRBuffer[MAX_QR_PAYLOAD_LEN + 1] = {0};

// Hàng đợi yêu cầu đổi Wi-Fi bất đồng bộ từ Web UI
static volatile bool hasPendingWifiChange = false;
static char pendingNewSsid[64] = {0};
static char pendingNewPass[64] = {0};
static char pendingNewHost[64] = {0};

// Lưu trạng thái kết quả tra cứu Backend gần nhất để hiển thị lên Web UI
static char lastBackendDocNumber[64]  = "---";
static char lastBackendDocType[32]    = "---";
static char lastBackendDocStatus[32]  = "idle";
static char lastBackendWarehouse[96]  = "---";
static char lastBackendMessage[180]   = "Đưa mã QR phiếu kho (hoặc QR Wi-Fi) vào khung ngắm (15 - 25 cm)";
static volatile int lastBackendHttpCode = 0;
static volatile unsigned long lastBackendLookupMs = 0;

// Double-Buffer PSRAM cho Live Stream không gây lag Task Quét QR
static uint8_t *streamBuffers[2] = {NULL, NULL};
static size_t streamBufferSize = 0;
static volatile int activeStreamIdx = 0;
static volatile uint32_t streamFrameSeq = 0;
static volatile int streamJpegQuality = STREAM_JPEG_QUALITY;

// Quản lý 2 HTTP Server (Port 80 cho UI/API, Port 81 chuyên biệt cho luồng MJPEG Stream)
static httpd_handle_t web_httpd = NULL;
static httpd_handle_t stream_httpd = NULL;

#define PART_BOUNDARY "123456789000000000000987654321"
static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* _STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

// Khai báo nguyên mẫu hàm
void printBanner();
void checkPSRAM();
void loadSavedConfig();
void saveNetworkConfig(const String &ssid, const String &pass, const String &host);
bool initCamera();
bool initStreamBuffers(size_t w, size_t h);
void smartAutoConnectWiFi();
bool connectToSpecificWiFi(const String &ssid, const String &pass, int timeoutSec = WIFI_TIMEOUT_SEC);
void startFallbackAP();
void startCameraWebServers();
void sendBackendHeartbeat();
void qrScannerTask(void *pvParameters);
void processQRCode(const char *qrPayload);
bool tryParseAndApplyWiFiQR(const String &code);
bool isValidKaratWarehouseFormat(const String &code);
void queryBackendDocument(const String &identifier);
String urlEncode(const String &str);
String urlDecode(const String &str);

// ============================================================================
// GIAO DIỆN WEB TRỰC QUAN TÍCH HỢP TRÊN ESP32-S3 (CÓ KHUNG NGẮM & QUÉT CHỌN WI-FI)
// ============================================================================
static const char PROGMEM INDEX_HTML[] = R"rawliteral(
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Karat Retail - Trạm Camera Quét QR & Tự Động Kết Nối Wi-Fi</title>
  <style>
    :root {
      --bg: #0f172a;
      --card: #1e293b;
      --border: #334155;
      --accent: #38bdf8;
      --emerald: #10b981;
      --amber: #f59e0b;
      --red: #ef4444;
      --text: #f8fafc;
      --muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      padding: 14px;
      min-height: 100vh;
    }
    .container { max-width: 1080px; margin: 0 auto; }
    header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding-bottom: 12px;
      margin-bottom: 14px;
      border-bottom: 1px solid var(--border);
    }
    h1 { font-size: 1.15rem; color: var(--accent); font-weight: 700; }
    .subtitle { font-size: 0.78rem; color: var(--muted); margin-top: 2px; }
    .pills { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .pill {
      font-size: 0.74rem;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(56, 189, 248, 0.12);
      color: var(--accent);
      border: 1px solid rgba(56, 189, 248, 0.3);
    }
    .grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
    @media (min-width: 768px) { .grid { grid-template-columns: 1.35fr 1fr; } }
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px;
    }
    .cam-box {
      position: relative;
      width: 100%;
      aspect-ratio: 4 / 3;
      background: #020617;
      border-radius: 10px;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid var(--border);
      transition: border-color 0.2s;
    }
    .cam-box.detected { border-color: var(--emerald); box-shadow: 0 0 20px rgba(16, 185, 129, 0.25); }
    #cam-stream { width: 100%; height: 100%; object-fit: contain; display: block; }
    #qr-overlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
    .reticle {
      position: absolute;
      width: 62%;
      height: 68%;
      border: 1.5px dashed rgba(56, 189, 248, 0.55);
      border-radius: 12px;
      pointer-events: none;
    }
    .cam-box.detected .reticle {
      border-color: rgba(16, 185, 129, 0.9);
      background: rgba(16, 185, 129, 0.06);
    }
    .corner {
      position: absolute;
      width: 22px;
      height: 22px;
      border-color: var(--accent);
      border-style: solid;
      border-width: 0;
    }
    .cam-box.detected .corner { border-color: var(--emerald); }
    .tl { top: -2px; left: -2px; border-top-width: 3px; border-left-width: 3px; border-top-left-radius: 8px; }
    .tr { top: -2px; right: -2px; border-top-width: 3px; border-right-width: 3px; border-top-right-radius: 8px; }
    .bl { bottom: -2px; left: -2px; border-bottom-width: 3px; border-left-width: 3px; border-bottom-left-radius: 8px; }
    .br { bottom: -2px; right: -2px; border-bottom-width: 3px; border-right-width: 3px; border-bottom-right-radius: 8px; }
    .reticle-label {
      position: absolute;
      bottom: -26px;
      left: 50%;
      transform: translateX(-50%);
      white-space: nowrap;
      font-size: 0.72rem;
      font-weight: 600;
      color: var(--accent);
      background: rgba(15, 23, 42, 0.88);
      padding: 2px 10px;
      border-radius: 99px;
      border: 1px solid rgba(56, 189, 248, 0.3);
    }
    .result-banner {
      margin-top: 12px;
      padding: 12px;
      border-radius: 10px;
      background: #0f172a;
      border-left: 4px solid var(--accent);
    }
    .result-banner.approved { border-left-color: var(--emerald); background: rgba(16, 185, 129, 0.1); }
    .result-banner.pending { border-left-color: var(--amber); background: rgba(245, 158, 11, 0.1); }
    .result-banner.error { border-left-color: var(--red); background: rgba(239, 68, 68, 0.1); }
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 0.8rem;
      padding: 6px 0;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .meta-row strong { color: var(--text); font-family: monospace; }
    label { display: block; font-size: 0.78rem; color: var(--muted); margin: 8px 0 4px; font-weight: 600; }
    input, select {
      width: 100%;
      background: #0f172a;
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 7px 9px;
      font-size: 0.82rem;
    }
    .btn {
      padding: 8px 12px;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      font-size: 0.8rem;
      cursor: pointer;
      background: var(--accent);
      color: #0f172a;
    }
    .btn-sec { background: #334155; color: var(--text); }
    .wifi-list {
      max-height: 140px;
      overflow-y: auto;
      margin-top: 6px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: #0f172a;
    }
    .wifi-item {
      padding: 6px 10px;
      font-size: 0.78rem;
      display: flex;
      justify-content: space-between;
      cursor: pointer;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .wifi-item:hover { background: rgba(56, 189, 248, 0.15); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>Karat Retail — Camera Quét QR IoT & Smart Auto-WiFi (v2.5)</h1>
        <div class="subtitle">Quét cả mã QR Phiếu Kho lẫn mã QR Chia sẻ Wi-Fi từ điện thoại/Web</div>
      </div>
      <div class="pills">
        <span class="pill" id="wifi-pill">Wi-Fi: Đang tải...</span>
        <span class="pill" id="fps-pill">Tốc độ: -- FPS</span>
      </div>
    </header>

    <div class="grid">
      <div class="card">
        <div class="cam-box" id="cam-box">
          <img id="cam-stream" alt="ESP32-S3 Live Camera" />
          <canvas id="qr-overlay" width="320" height="240"></canvas>
          <div class="reticle">
            <div class="corner tl"></div>
            <div class="corner tr"></div>
            <div class="corner bl"></div>
            <div class="corner br"></div>
            <div class="reticle-label" id="reticle-hint">ĐẶT MÃ QR PHIẾU HOẶC QR WI-FI VÀO ĐÂY (15 - 25 CM)</div>
          </div>
        </div>

        <div class="result-banner" id="result-banner">
          <div style="font-size: 0.75rem; color: var(--muted); text-transform: uppercase; font-weight: 700;">
            Trạng thái nhận diện & đối soát Backend
          </div>
          <div id="last-code" style="font-size: 0.98rem; font-weight: 700; font-family: monospace; margin-top: 4px; color: var(--accent);">
            Đang chờ đưa mã QR vào khung ngắm...
          </div>
          <div id="last-msg" style="font-size: 0.82rem; color: var(--text); margin-top: 4px;">
            Hỗ trợ quét QR Phiếu kho (DOC:NK-*, DOC:XK-*) & QR cấu hình Wi-Fi tự động.
          </div>
        </div>
      </div>

      <div class="card">
        <h3 style="font-size: 0.92rem; color: var(--accent); margin-bottom: 6px;">Thông tin Phiếu kho Vừa Quét</h3>
        <div class="meta-row"><span>Mã chứng từ:</span><strong id="doc-num">---</strong></div>
        <div class="meta-row"><span>Loại phiếu:</span><strong id="doc-type">---</strong></div>
        <div class="meta-row"><span>Trạng thái phiếu:</span><strong id="doc-status">---</strong></div>
        <div class="meta-row"><span>Kho hàng:</span><strong id="doc-wh">---</strong></div>

        <h3 style="font-size: 0.92rem; color: var(--accent); margin: 14px 0 6px; display: flex; justify-content: space-between; align-items: center;">
          <span>Quét & Đổi Wi-Fi / IP Backend</span>
          <button class="btn btn-sec" style="padding: 4px 8px; font-size: 0.72rem;" onclick="scanWifi()">Quét sóng Wi-Fi</button>
        </h3>
        <div id="wifi-list" class="wifi-list" style="display:none;"></div>
        <label>Tên Wi-Fi (SSID 2.4GHz)</label>
        <input id="in-ssid" placeholder="Chọn từ danh sách quét hoặc nhập tên Wi-Fi">
        <label>Mật khẩu Wi-Fi</label>
        <input id="in-pass" type="password" placeholder="Nhập mật khẩu Wi-Fi">
        <label>IP Máy tính chạy Backend Node.js</label>
        <input id="in-host" placeholder="VD: 192.168.1.3">
        <button class="btn" style="width:100%; margin-top:10px;" onclick="saveWifi()">Lưu & Tự động kết nối Wi-Fi</button>
        <div id="wifi-msg" style="font-size:0.75rem; color:var(--emerald); margin-top:6px;"></div>

        <h3 style="font-size: 0.92rem; color: var(--accent); margin: 14px 0 4px;">Tinh chỉnh Ống kính Nhanh</h3>
        <label>Độ tương phản: <span id="v-contrast">2</span></label>
        <input type="range" min="-2" max="2" value="2" oninput="setCtrl('contrast', this.value)">
        <label>Độ sáng: <span id="v-brightness">0</span></label>
        <input type="range" min="-2" max="2" value="0" oninput="setCtrl('brightness', this.value)">
      </div>
    </div>
  </div>

  <script>
    const streamImg = document.getElementById('cam-stream');
    streamImg.src = window.location.protocol + '//' + window.location.hostname + ':81/stream';

    function setCtrl(k, v) {
      const el = document.getElementById('v-' + k);
      if (el) el.innerText = v;
      fetch('/control?var=' + k + '&val=' + v).catch(() => {});
    }

    async function scanWifi() {
      const box = document.getElementById('wifi-list');
      box.style.display = 'block';
      box.innerHTML = '<div style="padding:8px;font-size:0.75rem;color:#94a3b8;">Đang dò sóng Wi-Fi 2.4GHz xung quanh...</div>';
      try {
        const res = await fetch('/wifi/scan');
        const list = await res.json();
        if (!list.length) {
          box.innerHTML = '<div style="padding:8px;font-size:0.75rem;">Không tìm thấy mạng nào</div>';
          return;
        }
        box.innerHTML = list.map(w =>
          `<div class="wifi-item" onclick="document.getElementById('in-ssid').value='${w.ssid.replace(/'/g, "\\'")}'">
            <strong>${w.ssid}</strong>
            <span style="color:#38bdf8">${w.rssi} dBm ${w.open ? '(Mở)' : '🔒'}</span>
          </div>`
        ).join('');
      } catch (e) {
        box.innerHTML = '<div style="padding:8px;font-size:0.75rem;color:#ef4444;">Lỗi khi quét Wi-Fi</div>';
      }
    }

    async function saveWifi() {
      const ssid = document.getElementById('in-ssid').value.trim();
      const pass = document.getElementById('in-pass').value;
      const host = document.getElementById('in-host').value.trim();
      const msg = document.getElementById('wifi-msg');
      msg.innerText = 'Đang lưu vào bộ nhớ Flash và kết nối tới ' + (ssid || 'Wi-Fi hiện tại') + '...';
      try {
        await fetch('/wifi/connect?ssid=' + encodeURIComponent(ssid) + '&pass=' + encodeURIComponent(pass) + '&host=' + encodeURIComponent(host));
        msg.innerText = 'Đã gửi lệnh kết nối! Vui lòng xem IP mới trên Web Karat Retail hoặc Serial Monitor.';
      } catch (e) {}
    }

    const canvas = document.getElementById('qr-overlay');
    const ctx = canvas.getContext('2d');
    let hostInitialized = false;

    async function pollStatus() {
      try {
        const res = await fetch('/status');
        const d = await res.json();
        document.getElementById('fps-pill').innerText = 'Tốc độ: ' + (d.scanFps || 0).toFixed(1) + ' FPS';
        document.getElementById('wifi-pill').innerText = 'Wi-Fi: ' + (d.ssid || 'AP Mode') + ' (' + (d.ip || '') + ')';
        if (!hostInitialized && d.backendHost) {
          document.getElementById('in-host').value = d.backendHost;
          document.getElementById('in-ssid').value = d.ssid || '';
          hostInitialized = true;
        }

        const camBox = document.getElementById('cam-box');
        const hint = document.getElementById('reticle-hint');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (d.qrVisible && d.corners && d.corners.length === 4) {
          camBox.classList.add('detected');
          hint.innerText = '✓ ĐÃ BẮT ĐƯỢC MÃ QR!';
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 3;
          ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
          ctx.beginPath();
          ctx.moveTo(d.corners[0].x, d.corners[0].y);
          for (let i = 1; i < 4; i++) ctx.lineTo(d.corners[i].x, d.corners[i].y);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          camBox.classList.remove('detected');
          hint.innerText = 'ĐẶT MÃ QR PHIẾU HOẶC QR WI-FI VÀO ĐÂY (15 - 25 CM)';
        }

        if (d.lastCode) {
          document.getElementById('last-code').innerText = d.lastCode;
          document.getElementById('last-msg').innerText = d.lastMessage || '';
          document.getElementById('doc-num').innerText = d.lastDocNumber || '---';
          document.getElementById('doc-type').innerText = d.lastDocType || '---';
          document.getElementById('doc-status').innerText = d.lastDocStatus || '---';
          document.getElementById('doc-wh').innerText = d.lastWarehouse || '---';
        }
      } catch (e) {}
    }
    setInterval(pollStatus, 350);
  </script>
</body>
</html>
)rawliteral";

// ============================================================================
// CÁC HTTP HANDLER PHỤC VỤ GIAO DIỆN WEB & QUÉT / CẤU HÌNH WI-FI TỪ XA
// ============================================================================
static esp_err_t index_handler(httpd_req_t *req) {
  httpd_resp_set_type(req, "text/html; charset=utf-8");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  return httpd_resp_send(req, INDEX_HTML, HTTPD_RESP_USE_STRLEN);
}

static esp_err_t status_handler(httpd_req_t *req) {
  char jsonBuf[1280];
  unsigned long now = millis();
  bool qrVisible = (lastCornerDetectedMs > 0) && ((now - lastCornerDetectedMs) < 1200);
  unsigned long scanAge = (lastScanTimestamp > 0) ? (now - lastScanTimestamp) : 0;

  CornerPoint c[4];
  portENTER_CRITICAL(&qrMux);
  for (int i = 0; i < 4; i++) {
    c[i].x = lastCorners[i].x;
    c[i].y = lastCorners[i].y;
  }
  portEXIT_CRITICAL(&qrMux);

  String ipStr = (WiFi.status() == WL_CONNECTED) ? WiFi.localIP().toString() : WiFi.softAPIP().toString();
  String ssidStr = (WiFi.status() == WL_CONNECTED) ? WiFi.SSID() : String(AP_FALLBACK_SSID);
  int rssiVal = (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : 0;

  snprintf(
    jsonBuf, sizeof(jsonBuf),
    "{\"online\":true,\"ip\":\"%s\",\"ssid\":\"%s\",\"rssi\":%d,\"backendHost\":\"%s\","
    "\"scanFps\":%.1f,\"totalFrames\":%lu,\"totalDetections\":%lu,"
    "\"qrVisible\":%s,\"frameWidth\":%d,\"frameHeight\":%d,"
    "\"corners\":[{\"x\":%d,\"y\":%d},{\"x\":%d,\"y\":%d},{\"x\":%d,\"y\":%d},{\"x\":%d,\"y\":%d}],"
    "\"lastCode\":\"%s\",\"lastScanAgeMs\":%lu,\"lastHttpCode\":%d,"
    "\"lastDocNumber\":\"%s\",\"lastDocType\":\"%s\",\"lastDocStatus\":\"%s\","
    "\"lastWarehouse\":\"%s\",\"lastMessage\":\"%s\"}",
    ipStr.c_str(),
    ssidStr.c_str(),
    rssiVal,
    activeBackendHost.c_str(),
    currentScanFps,
    totalFramesScanned,
    totalQRDetections,
    qrVisible ? "true" : "false",
    currentFrameW,
    currentFrameH,
    c[0].x, c[0].y, c[1].x, c[1].y, c[2].x, c[2].y, c[3].x, c[3].y,
    lastScannedCode.c_str(),
    scanAge,
    lastBackendHttpCode,
    lastBackendDocNumber,
    lastBackendDocType,
    lastBackendDocStatus,
    lastBackendWarehouse,
    lastBackendMessage
  );

  httpd_resp_set_type(req, "application/json; charset=utf-8");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  return httpd_resp_send(req, jsonBuf, HTTPD_RESP_USE_STRLEN);
}

// API quét danh sách mạng Wi-Fi 2.4GHz xung quanh (/wifi/scan)
static esp_err_t wifi_scan_handler(httpd_req_t *req) {
  int n = WiFi.scanNetworks(false, false);
  String json = "[";
  for (int i = 0; i < n && i < 18; i++) {
    if (i > 0) json += ",";
    String ssid = WiFi.SSID(i);
    ssid.replace("\"", "\\\"");
    bool isOpen = (WiFi.encryptionType(i) == WIFI_AUTH_OPEN);
    json += "{\"ssid\":\"" + ssid + "\",\"rssi\":" + String(WiFi.RSSI(i)) + ",\"open\":" + (isOpen ? "true" : "false") + "}";
  }
  json += "]";
  WiFi.scanDelete();

  httpd_resp_set_type(req, "application/json; charset=utf-8");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  return httpd_resp_send(req, json.c_str(), HTTPD_RESP_USE_STRLEN);
}

// API lưu & đổi mạng Wi-Fi / IP Backend trực tiếp từ Web (/wifi/connect?ssid=...&pass=...&host=...)
static esp_err_t wifi_connect_handler(httpd_req_t *req) {
  size_t buf_len = httpd_req_get_url_query_len(req) + 1;
  if (buf_len <= 1) {
    httpd_resp_send_404(req);
    return ESP_FAIL;
  }
  char *buf = (char *)malloc(buf_len);
  if (!buf) {
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }
  if (httpd_req_get_url_query_str(req, buf, buf_len) != ESP_OK) {
    free(buf);
    httpd_resp_send_404(req);
    return ESP_FAIL;
  }

  char rawSsid[96] = {0};
  char rawPass[96] = {0};
  char rawHost[96] = {0};
  httpd_query_key_value(buf, "ssid", rawSsid, sizeof(rawSsid));
  httpd_query_key_value(buf, "pass", rawPass, sizeof(rawPass));
  httpd_query_key_value(buf, "host", rawHost, sizeof(rawHost));
  free(buf);

  String decodedSsid = urlDecode(String(rawSsid));
  String decodedPass = urlDecode(String(rawPass));
  String decodedHost = urlDecode(String(rawHost));

  portENTER_CRITICAL(&qrMux);
  strncpy(pendingNewSsid, decodedSsid.c_str(), sizeof(pendingNewSsid) - 1);
  strncpy(pendingNewPass, decodedPass.c_str(), sizeof(pendingNewPass) - 1);
  strncpy(pendingNewHost, decodedHost.c_str(), sizeof(pendingNewHost) - 1);
  hasPendingWifiChange = true;
  portEXIT_CRITICAL(&qrMux);

  httpd_resp_set_type(req, "application/json; charset=utf-8");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  return httpd_resp_send(req, "{\"ok\":true}", HTTPD_RESP_USE_STRLEN);
}

static esp_err_t capture_handler(httpd_req_t *req) {
  int w = currentFrameW;
  int h = currentFrameH;
  size_t expectedLen = (size_t)w * (size_t)h;

  if (!streamBuffers[0] || streamBufferSize < expectedLen) {
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  uint8_t *jpg_buf = NULL;
  size_t jpg_len = 0;
  int idx = activeStreamIdx;
  bool ok = fmt2jpg(streamBuffers[idx], expectedLen, w, h, PIXFORMAT_GRAYSCALE, streamJpegQuality, &jpg_buf, &jpg_len);
  if (!ok || !jpg_buf) {
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Content-Disposition", "inline; filename=capture.jpg");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  esp_err_t res = httpd_resp_send(req, (const char *)jpg_buf, jpg_len);
  free(jpg_buf);
  return res;
}

static esp_err_t stream_handler(httpd_req_t *req) {
  esp_err_t res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
  if (res != ESP_OK) return res;
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  httpd_resp_set_hdr(req, "Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

  uint32_t lastSentSeq = 0;
  char part_buf[64];

  while (true) {
    uint32_t curSeq = streamFrameSeq;
    if (curSeq == lastSentSeq || !streamBuffers[0]) {
      vTaskDelay(pdMS_TO_TICKS(15));
      continue;
    }
    lastSentSeq = curSeq;

    int w = currentFrameW;
    int h = currentFrameH;
    size_t len = (size_t)w * (size_t)h;
    int idx = activeStreamIdx;

    uint8_t *jpg_buf = NULL;
    size_t jpg_len = 0;
    bool converted = fmt2jpg(streamBuffers[idx], len, w, h, PIXFORMAT_GRAYSCALE, streamJpegQuality, &jpg_buf, &jpg_len);
    if (!converted || !jpg_buf) {
      vTaskDelay(pdMS_TO_TICKS(20));
      continue;
    }

    size_t hlen = snprintf(part_buf, sizeof(part_buf), _STREAM_PART, (unsigned int)jpg_len);
    res = httpd_resp_send_chunk(req, part_buf, hlen);
    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, (const char *)jpg_buf, jpg_len);
    }
    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, _STREAM_BOUNDARY, strlen(_STREAM_BOUNDARY));
    }

    free(jpg_buf);
    if (res != ESP_OK) break;

    vTaskDelay(pdMS_TO_TICKS(25));
  }

  return res;
}

static esp_err_t control_handler(httpd_req_t *req) {
  size_t buf_len = httpd_req_get_url_query_len(req) + 1;
  if (buf_len <= 1) {
    httpd_resp_send_404(req);
    return ESP_FAIL;
  }
  char *buf = (char *)malloc(buf_len);
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
  if (!s) {
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  int res = 0;
  if (!strcmp(var, "contrast") && s->set_contrast) {
    res = s->set_contrast(s, int_val);
  } else if (!strcmp(var, "brightness") && s->set_brightness) {
    res = s->set_brightness(s, int_val);
  } else if (!strcmp(var, "sharpness") && s->set_sharpness) {
    res = s->set_sharpness(s, int_val);
  } else if (!strcmp(var, "vflip") && s->set_vflip) {
    res = s->set_vflip(s, int_val);
  } else if (!strcmp(var, "hmirror") && s->set_hmirror) {
    res = s->set_hmirror(s, int_val);
  } else if (!strcmp(var, "quality")) {
    if (int_val >= 30 && int_val <= 90) streamJpegQuality = int_val;
  }

  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  if (res < 0) return httpd_resp_send_500(req);
  return httpd_resp_send(req, "OK", 2);
}

void startCameraWebServers() {
  if (webServersStarted) return;

  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = HTTP_SERVER_PORT;
  config.ctrl_port = 32768;
  config.max_uri_handlers = 10;
  config.stack_size = 6144;
  config.lru_purge_enable = true;

  httpd_uri_t index_uri     = { .uri = "/",             .method = HTTP_GET, .handler = index_handler,        .user_ctx = NULL };
  httpd_uri_t status_uri    = { .uri = "/status",       .method = HTTP_GET, .handler = status_handler,       .user_ctx = NULL };
  httpd_uri_t wifi_scan_uri = { .uri = "/wifi/scan",    .method = HTTP_GET, .handler = wifi_scan_handler,    .user_ctx = NULL };
  httpd_uri_t wifi_conn_uri = { .uri = "/wifi/connect", .method = HTTP_GET, .handler = wifi_connect_handler, .user_ctx = NULL };
  httpd_uri_t capture_uri   = { .uri = "/capture",      .method = HTTP_GET, .handler = capture_handler,      .user_ctx = NULL };
  httpd_uri_t control_uri   = { .uri = "/control",      .method = HTTP_GET, .handler = control_handler,      .user_ctx = NULL };
  httpd_uri_t stream_uri    = { .uri = "/stream",       .method = HTTP_GET, .handler = stream_handler,       .user_ctx = NULL };

  if (httpd_start(&web_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(web_httpd, &index_uri);
    httpd_register_uri_handler(web_httpd, &status_uri);
    httpd_register_uri_handler(web_httpd, &wifi_scan_uri);
    httpd_register_uri_handler(web_httpd, &wifi_conn_uri);
    httpd_register_uri_handler(web_httpd, &capture_uri);
    httpd_register_uri_handler(web_httpd, &control_uri);
    httpd_register_uri_handler(web_httpd, &stream_uri);
  }

  httpd_config_t stream_config = HTTPD_DEFAULT_CONFIG();
  stream_config.server_port = STREAM_SERVER_PORT;
  stream_config.ctrl_port = 32769;
  stream_config.max_uri_handlers = 4;
  stream_config.stack_size = 6144;
  stream_config.lru_purge_enable = true;

  if (httpd_start(&stream_httpd, &stream_config) == ESP_OK) {
    httpd_register_uri_handler(stream_httpd, &stream_uri);
  }

  webServersStarted = true;
}

bool initStreamBuffers(size_t w, size_t h) {
  size_t needed = w * h;
  if (streamBuffers[0] && streamBuffers[1] && streamBufferSize >= needed) {
    return true;
  }
  for (int i = 0; i < 2; i++) {
    if (streamBuffers[i]) {
      free(streamBuffers[i]);
      streamBuffers[i] = NULL;
    }
    streamBuffers[i] = (uint8_t *)heap_caps_malloc(needed, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (!streamBuffers[i]) {
      streamBuffers[i] = (uint8_t *)malloc(needed);
    }
  }
  if (!streamBuffers[0] || !streamBuffers[1]) return false;
  streamBufferSize = needed;
  return true;
}

// ============================================================================
// ĐỌC & LƯU CẤU HÌNH WI-FI + BACKEND TRONG FLASH (NVS PREFERENCES)
// ============================================================================
void loadSavedConfig() {
  prefs.begin("karat_iot", true);
  String sSsid = prefs.getString("ssid", "");
  String sPass = prefs.getString("pass", "");
  String sHost = prefs.getString("host", "");
  prefs.end();

  if (sSsid.length() > 0) {
    activeWifiSsid = sSsid;
    activeWifiPass = sPass;
    Serial.printf("[NVS] Đã tải Wi-Fi lưu trong bộ nhớ Flash: %s\n", activeWifiSsid.c_str());
  }
  if (sHost.length() > 0) {
    activeBackendHost = sHost;
    Serial.printf("[NVS] Đã tải IP Backend lưu trong Flash: %s\n", activeBackendHost.c_str());
  }
}

void saveNetworkConfig(const String &ssid, const String &pass, const String &host) {
  prefs.begin("karat_iot", false);
  if (ssid.length() > 0) {
    prefs.putString("ssid", ssid);
    prefs.putString("pass", pass);
    activeWifiSsid = ssid;
    activeWifiPass = pass;
  }
  if (host.length() > 0) {
    prefs.putString("host", host);
    activeBackendHost = host;
  }
  prefs.end();
  Serial.printf("[NVS][OK] Đã lưu cấu hình mạng mới (SSID: %s | Backend: %s)\n",
                activeWifiSsid.c_str(), activeBackendHost.c_str());
}

// ============================================================================
// ĐỒNG BỘ TRỰC TIẾP VỚI WI-FI TRÊN MÁY TÍNH WINDOWS (QUA USB SERIAL & ĐA PROFILE)
// ============================================================================
struct KnownWifiProfile {
  const char *ssid;
  const char *password;
};

// Danh sách các Wi-Fi đã lưu trên máy tính Windows của bạn (tự động khớp cả 5GHz -> 2.4GHz)
static const KnownWifiProfile PC_KNOWN_WIFI_LIST[] = {
  { WIFI_SSID,               WIFI_PASSWORD       },
  { "Hue 5G",                "026203060309"      },
  { "Hue L1",                "hue02121962"       },
  { "Hue L1_5G",             "hue02121962"       },
  { "Chon Rieng Cafe 1",     "dinhenoikhecuoiduyen" },
  { "Chon Rieng Cafe 1_5G",  "dinhenoikhecuoiduyen" },
  { "VIAGS-HocVien",         "wl#viags"          },
  { "cc",                    "67676767"          },
  { "HAV AVIATION",          "Chuyennghiep@"     },
  { "Laptopworld KT",        "hm2345678"         },
  { "Highlands Coffee",      ""                  }
};
static const int PC_KNOWN_WIFI_COUNT = sizeof(PC_KNOWN_WIFI_LIST) / sizeof(PC_KNOWN_WIFI_LIST[0]);

// Chuyển đổi tên Wi-Fi 5GHz trên máy tính sang tên sóng 2.4GHz tương ứng của cùng cục Router
static String strip5GSuffix(const String &s) {
  String out = s;
  out.trim();
  const char *suffixes[] = { " 5GHz", "_5GHz", "-5GHz", " 5Ghz", " 5G", "_5G", "-5G", " 5g", "_5g", "-5g" };
  for (size_t i = 0; i < sizeof(suffixes) / sizeof(suffixes[0]); i++) {
    String suf = String(suffixes[i]);
    if (out.endsWith(suf) && out.length() > suf.length()) {
      out = out.substring(0, out.length() - suf.length());
      out.trim();
      break;
    }
  }
  return out;
}

static bool isSameRouterSsid(const String &scanned24Ssid, const String &pcSsid) {
  if (scanned24Ssid.length() == 0 || pcSsid.length() == 0) return false;
  if (scanned24Ssid.equalsIgnoreCase(pcSsid)) return true;
  String baseScanned = strip5GSuffix(scanned24Ssid);
  String basePc      = strip5GSuffix(pcSsid);
  return baseScanned.equalsIgnoreCase(basePc);
}

// Lắng nghe gói tin đồng bộ Wi-Fi + IP tự động từ Backend trên máy tính qua cáp USB (COM port)
void checkUsbSerialWifiSync() {
  while (Serial.available() > 0) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.startsWith("KARAT_WIFI:")) {
      Serial.printf("[USB-SYNC] Nhận cấu hình Wi-Fi trực tiếp từ Máy tính: %s\n", line.c_str());
      String body = line.substring(11);
      int p1 = body.indexOf('|');
      int p2 = (p1 >= 0) ? body.indexOf('|', p1 + 1) : -1;
      int p3 = (p2 >= 0) ? body.indexOf('|', p2 + 1) : -1;
      if (p1 > 0) {
        String pcSsid24 = body.substring(0, p1);
        String pcPass   = (p2 >= 0) ? body.substring(p1 + 1, p2) : body.substring(p1 + 1);
        String pcIp     = (p2 >= 0) ? ((p3 >= 0) ? body.substring(p2 + 1, p3) : body.substring(p2 + 1)) : "";

        pcSsid24.trim();
        pcIp.trim();

        // Nếu ESP32 đã kết nối sẵn vào đúng cùng Router với máy tính, chỉ cần cập nhật IP máy tính & báo danh ngay!
        if (WiFi.status() == WL_CONNECTED && isSameRouterSsid(WiFi.SSID(), pcSsid24)) {
          if (pcIp.length() > 0 && pcIp != activeBackendHost) {
            saveNetworkConfig(WiFi.SSID(), pcPass, pcIp);
          }
          sendBackendHeartbeat();
          return;
        }

        // Nếu chưa kết nối hoặc máy tính vừa đổi sang Wi-Fi khác -> Tự động chuyển theo máy tính!
        tryParseAndApplyWiFiQR("KARAT_WIFI:" + pcSsid24 + "|" + pcPass + "|" + pcIp);
      }
    }
  }
}

bool connectToSpecificWiFi(const String &ssid, const String &pass, int timeoutSec) {
  if (ssid.length() == 0) return false;
  Serial.printf("[WIFI] Đang kết nối tới '%s' ", ssid.c_str());

  WiFi.setSleep(false);
  if (pass.length() > 0) {
    WiFi.begin(ssid.c_str(), pass.c_str());
  } else {
    WiFi.begin(ssid.c_str());
  }

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < (timeoutSec * 2)) {
    delay(500);
    Serial.print(".");
    retries++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[WIFI][OK] Đã kết nối chung mạng Wi-Fi với máy tính!");
    Serial.printf("  -> Tên mạng (SSID): %s (%d dBm)\n", WiFi.SSID().c_str(), WiFi.RSSI());
    Serial.printf("  -> Địa chỉ IP Cam : http://%s/\n", WiFi.localIP().toString().c_str());
    if (MDNS.begin(MDNS_HOSTNAME)) {
      MDNS.addService("http", "tcp", HTTP_SERVER_PORT);
      Serial.printf("  -> Tên miền mDNS  : http://%s.local/\n", MDNS_HOSTNAME);
    }
    return true;
  }
  return false;
}

void startFallbackAP() {
  WiFi.mode(WIFI_AP_STA);
  WiFi.setSleep(false);
  WiFi.softAP(AP_FALLBACK_SSID, AP_FALLBACK_PASS);
  Serial.println("------------------------------------------------------------");
  Serial.println("[WIFI][AP MODE] Đã bật điểm phát Wi-Fi trực tiếp trên ESP32:");
  Serial.printf("  -> Tên Wi-Fi AP : %s (Mật khẩu: %s)\n", AP_FALLBACK_SSID, AP_FALLBACK_PASS);
  Serial.printf("  -> Địa chỉ cấu hình: http://%s/\n", WiFi.softAPIP().toString().c_str());
  Serial.println("------------------------------------------------------------");
}

void smartAutoConnectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);

  // Kiểm tra nhanh nếu máy tính vừa đẩy cấu hình Wi-Fi qua cáp USB
  checkUsbSerialWifiSync();
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println("[WIFI][AUTO-SCAN] Đang dò sóng 2.4GHz & tự động khớp với Wi-Fi trên máy tính...");
  int numNetworks = WiFi.scanNetworks(false, false);

  String bestMatchedSsid = "";
  String bestMatchedPass = "";
  int bestMatchedRssi = -999;

  String strongestOpenSsid = "";
  int bestOpenRssi = -999;

  for (int i = 0; i < numNetworks; i++) {
    String foundSsid = WiFi.SSID(i);
    int rssi = WiFi.RSSI(i);
    bool isOpen = (WiFi.encryptionType(i) == WIFI_AUTH_OPEN);
    Serial.printf("  [%d] %s (%d dBm) %s\n", i + 1, foundSsid.c_str(), rssi, isOpen ? "[Mạng Mở]" : "[Bảo mật]");

    // 1. Kiểm tra khớp với mạng đã đồng bộ từ máy tính trong NVS (kể cả khi máy tính bắt bản 5GHz)
    if (activeWifiSsid.length() > 0 && isSameRouterSsid(foundSsid, activeWifiSsid)) {
      if (rssi > bestMatchedRssi) {
        bestMatchedRssi = rssi;
        bestMatchedSsid = foundSsid;
        bestMatchedPass = activeWifiPass;
      }
    }

    // 2. Kiểm tra khớp với toàn bộ danh sách các mạng Wi-Fi đã lưu trên máy tính Windows
    for (int k = 0; k < PC_KNOWN_WIFI_COUNT; k++) {
      if (isSameRouterSsid(foundSsid, String(PC_KNOWN_WIFI_LIST[k].ssid))) {
        if (rssi > bestMatchedRssi) {
          bestMatchedRssi = rssi;
          bestMatchedSsid = foundSsid;
          bestMatchedPass = String(PC_KNOWN_WIFI_LIST[k].password);
        }
      }
    }

    if (isOpen && rssi > bestOpenRssi && rssi > -78) {
      bestOpenRssi = rssi;
      strongestOpenSsid = foundSsid;
    }
  }
  WiFi.scanDelete();

  // Ưu tiên 1: Kết nối vào mạng Wi-Fi của máy tính có sóng mạnh nhất vừa tìm thấy
  if (bestMatchedSsid.length() > 0) {
    Serial.printf("[WIFI][MATCH] Tự động nhận diện mạng cùng Router với máy tính: '%s' (%d dBm)\n",
                  bestMatchedSsid.c_str(), bestMatchedRssi);
    if (connectToSpecificWiFi(bestMatchedSsid, bestMatchedPass, WIFI_TIMEOUT_SEC)) {
      saveNetworkConfig(bestMatchedSsid, bestMatchedPass, "");
      return;
    }
  }

  // Ưu tiên 2: Thử trực tiếp mạng lưu trong NVS (trường hợp mạng ẩn SSID)
  if (activeWifiSsid.length() > 0) {
    String fallback24 = strip5GSuffix(activeWifiSsid);
    if (connectToSpecificWiFi(fallback24, activeWifiPass, 10)) {
      return;
    }
  }

  // Ưu tiên 3: Nếu có mạng Wi-Fi mở sóng khỏe
  if (strongestOpenSsid.length() > 0) {
    if (connectToSpecificWiFi(strongestOpenSsid, "", 10)) {
      return;
    }
  }

  // Ưu tiên 4: Bật AP dự phòng đồng thời tiếp tục lắng nghe đồng bộ USB từ máy tính
  startFallbackAP();
}

// ============================================================================
// GỬI GÓI TIN BÁO DANH TỰ ĐỘNG (HEARTBEAT) VỀ BACKEND ĐỂ WEB TỰ NHẬN DIỆN IP CAM
// ============================================================================
void sendBackendHeartbeat() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.setTimeout(1800);
  String url = "http://" + activeBackendHost + ":" + String(activeBackendPort) +
               String(BACKEND_API_BASE) + "/warehouse/iot/heartbeat";

  http.begin(url);
  http.addHeader("X-Device-Token", IOT_DEVICE_TOKEN);
  http.addHeader("Content-Type", "application/json");

  String payload = "{\"ip\":\"" + WiFi.localIP().toString() +
                   "\",\"hostname\":\"" + String(MDNS_HOSTNAME) + ".local\"" +
                   ",\"ssid\":\"" + WiFi.SSID() +
                   "\",\"rssi\":" + String(WiFi.RSSI()) +
                   ",\"scanFps\":" + String(currentScanFps, 1) +
                   ",\"streamPort\":" + String(STREAM_SERVER_PORT) + "}";

  int code = http.POST(payload);
  if (code == 200) {
    Serial.printf("[AUTO-DISCOVERY] Đã đồng bộ IP Camera (%s) lên Backend Karat Retail!\n",
                  WiFi.localIP().toString().c_str());
  }
  http.end();
}

// ============================================================================
// TỰ ĐỘNG NHẬN DIỆN MÃ QR CHIA SẺ WI-FI TỪ ĐIỆN THOẠI HOẶC WEB KARAT RETAIL
// Hỗ trợ:
//  1) Chuẩn quốc tế Android/iOS: WIFI:S:<SSID>;T:WPA;P:<PASS>;;
//  2) Chuẩn Karat Smart Config : KARAT_WIFI:<SSID>|<PASS>|<BACKEND_IP>
// ============================================================================
static String extractWifiTagValue(const String &src, const String &tag) {
  int idx = src.indexOf(tag);
  if (idx < 0) return "";
  int start = idx + tag.length();
  int end = start;
  while (end < (int)src.length()) {
    if (src.charAt(end) == ';' && (end == start || src.charAt(end - 1) != '\\')) {
      break;
    }
    end++;
  }
  String val = src.substring(start, end);
  val.replace("\\;", ";");
  val.replace("\\:", ":");
  val.replace("\\\\", "\\");
  return val;
}

bool tryParseAndApplyWiFiQR(const String &code) {
  String newSsid = "";
  String newPass = "";
  String newHost = "";

  if (code.startsWith("WIFI:")) {
    newSsid = extractWifiTagValue(code, "S:");
    newPass = extractWifiTagValue(code, "P:");
    newHost = extractWifiTagValue(code, "H:");
    if (newHost.equalsIgnoreCase("true") || newHost.equalsIgnoreCase("false")) {
      newHost = extractWifiTagValue(code, "B:");
    }
  } else if (code.startsWith("KARAT_WIFI:")) {
    String body = code.substring(11);
    int p1 = body.indexOf('|');
    int p2 = (p1 >= 0) ? body.indexOf('|', p1 + 1) : -1;
    if (p1 > 0) {
      newSsid = body.substring(0, p1);
      if (p2 >= 0) {
        newPass = body.substring(p1 + 1, p2);
        newHost = body.substring(p2 + 1);
      } else {
        newPass = body.substring(p1 + 1);
      }
    }
  } else {
    return false;
  }

  newSsid.trim();
  newHost.trim();
  if (newSsid.length() == 0 && newHost.length() == 0) return false;

  Serial.println("************************************************************");
  Serial.println("[QR WI-FI PROVISIONING] Phát hiện mã QR cấu hình mạng tự động!");
  if (newSsid.length() > 0) Serial.printf("  -> SSID mới    : %s\n", newSsid.c_str());
  if (newHost.length() > 0) Serial.printf("  -> Backend mới : %s\n", newHost.c_str());
  Serial.println("************************************************************");

  strncpy(lastBackendDocStatus, "approved", sizeof(lastBackendDocStatus) - 1);
  snprintf(lastBackendMessage, sizeof(lastBackendMessage),
           "Đang tự động kết nối tới Wi-Fi '%s'...", newSsid.c_str());

  saveNetworkConfig(newSsid, newPass, newHost);
  if (newSsid.length() > 0) {
    if (connectToSpecificWiFi(newSsid, newPass, WIFI_TIMEOUT_SEC)) {
      snprintf(lastBackendMessage, sizeof(lastBackendMessage),
               "Đã kết nối Wi-Fi '%s' thành công! IP mới: %s",
               newSsid.c_str(), WiFi.localIP().toString().c_str());
      sendBackendHeartbeat();
    } else {
      snprintf(lastBackendMessage, sizeof(lastBackendMessage),
               "Không thể kết nối Wi-Fi '%s'. Vui lòng kiểm tra mật khẩu hoặc băng tần 2.4GHz.",
               newSsid.c_str());
    }
  } else {
    sendBackendHeartbeat();
  }
  return true;
}

// ============================================================================
// SETUP CHÍNH CỦA ARDUINO
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  printBanner();
  checkPSRAM();
  loadSavedConfig();

  // 1. Khởi tạo Camera OV5640 ở định dạng Grayscale 320x240
  Serial.println("[BƯỚC 1] Đang khởi tạo camera OV5640 tốc độ cao...");
  if (!initCamera()) {
    Serial.println("[STOP] Camera khởi tạo thất bại. Vui lòng kiểm tra lại cáp FPC.");
    while (true) {
      delay(1000);
    }
  }
  initStreamBuffers(320, 240);
  Serial.println("[BƯỚC 1][OK] Camera OV5640 đã sẵn sàng.");

  // 2. Tự động nhận diện & kết nối mạng Wi-Fi 2.4GHz (hoặc bật Fallback AP)
  Serial.println("[BƯỚC 2] Tự động dò và kết nối mạng Wi-Fi...");
  smartAutoConnectWiFi();

  // 3. Khởi chạy Web Server Live Camera + Khung ngắm (hoạt động trên cả STA và AP)
  startCameraWebServers();

  // 4. Báo danh IP Camera tự động về Backend Node.js
  if (WiFi.status() == WL_CONNECTED) {
    sendBackendHeartbeat();
  }

  // 5. Khởi tạo FreeRTOS Task chạy giải mã QR trên Core 1
  Serial.println("[BƯỚC 3] Khởi động FreeRTOS Task giải mã QR siêu nhạy trên Core 1...");
  BaseType_t taskCreated = xTaskCreatePinnedToCore(
    qrScannerTask,
    "QR_Scan_Task",
    32 * 1024,
    NULL,
    2,
    NULL,
    1
  );

  if (taskCreated != pdPASS) {
    Serial.println("[TASK][FAIL] Không thể tạo FreeRTOS Task quét QR!");
  } else {
    Serial.println("[TASK][OK] Task quét QR đã khởi chạy thành công.");
  }

  Serial.println("============================================================");
  Serial.println(" HỆ THỐNG ĐÃ SẴN SÀNG! MỞ WEB KARAT RETAIL HOẶC TRÌNH DUYỆT:");
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf(" -> Xem trực tiếp Camera & Khung ngắm: http://%s/ (hoặc http://%s.local/)\n",
                  WiFi.localIP().toString().c_str(), MDNS_HOSTNAME);
  }
  Serial.println(" -> MẸO: Giơ mã QR Chia sẻ Wi-Fi của điện thoại trước Camera để đổi Wi-Fi bất kỳ lúc nào!");
  Serial.println("============================================================");
}

// ============================================================================
// LOOP CHÍNH: XỬ LÝ TRA CỨU BACKEND, ĐỔI WI-FI ĐỘNG & BÁO DANH HEARTBEAT
// ============================================================================
void loop() {
  // 0. Lắng nghe gói tin đồng bộ Wi-Fi hiện tại của Máy tính qua cáp USB (COM port)
  checkUsbSerialWifiSync();

  // 1. Xử lý mã QR vừa quét được từ Core 1
  if (hasPendingQR) {
    char codeCopy[MAX_QR_PAYLOAD_LEN + 1];
    portENTER_CRITICAL(&qrMux);
    strncpy(codeCopy, (const char *)pendingQRBuffer, sizeof(codeCopy) - 1);
    codeCopy[sizeof(codeCopy) - 1] = '\0';
    hasPendingQR = false;
    portEXIT_CRITICAL(&qrMux);

    processQRCode(codeCopy);
  }

  // 2. Xử lý yêu cầu đổi Wi-Fi / IP Backend từ giao diện Web
  if (hasPendingWifiChange) {
    String nSsid, nPass, nHost;
    portENTER_CRITICAL(&qrMux);
    nSsid = String(pendingNewSsid);
    nPass = String(pendingNewPass);
    nHost = String(pendingNewHost);
    hasPendingWifiChange = false;
    portEXIT_CRITICAL(&qrMux);

    saveNetworkConfig(nSsid, nPass, nHost);
    if (nSsid.length() > 0) {
      connectToSpecificWiFi(nSsid, nPass, WIFI_TIMEOUT_SEC);
    }
    sendBackendHeartbeat();
  }

  // 3. Định kỳ gửi Heartbeat (mỗi 10 giây) để Web Karat Retail luôn tự nhận diện được IP ESP32
  static unsigned long lastHeartbeatMs = 0;
  if (WiFi.status() == WL_CONNECTED && (millis() - lastHeartbeatMs > 10000)) {
    lastHeartbeatMs = millis();
    sendBackendHeartbeat();
  }

  // 4. Tự động phục hồi kết nối nếu Wi-Fi bị rớt
  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastReconnectTime = 0;
    if (millis() - lastReconnectTime > 15000) {
      lastReconnectTime = millis();
      Serial.println("[WIFI][AUTO-RECONNECT] Đang tự động kết nối lại Wi-Fi...");
      WiFi.reconnect();
    }
  }

  delay(15);
}

void printBanner() {
  Serial.println();
  Serial.println("============================================================");
  Serial.println("  KARAT RETAIL - QUÉT QR SIÊU NHẠY & AUTO-WIFI (v2.5)       ");
  Serial.printf("  Chip: ESP32-S3 | CPU: %d MHz | Flash: %u MB\n",
                ESP.getCpuFreqMHz(),
                (unsigned int)(ESP.getFlashChipSize() / (1024 * 1024)));
  Serial.println("============================================================");
}

void checkPSRAM() {
  if (psramFound()) {
    Serial.printf("[PSRAM] OK - Dung lượng: %u MB | Còn trống: %u KB\n",
                  (unsigned int)(ESP.getPsramSize() / (1024 * 1024)),
                  (unsigned int)(ESP.getFreePsram() / 1024));
  } else {
    Serial.println("[PSRAM][CẢNH BÁO] Không tìm thấy PSRAM! Hãy chọn Tools -> PSRAM: 'OPI PSRAM'.");
  }
}

bool initCamera() {
  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;

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
  config.pixel_format = PIXFORMAT_GRAYSCALE;
  config.frame_size   = CAMERA_FRAME_SIZE;
  config.fb_count     = psramFound() ? 3 : 2;
  config.fb_location  = CAMERA_FB_IN_PSRAM;
  config.grab_mode    = CAMERA_GRAB_LATEST;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[CAMERA][FAIL] Lỗi esp_camera_init: 0x%x\n", err);
    return false;
  }

  sensor_t *s = esp_camera_sensor_get();
  if (s != nullptr) {
    Serial.printf("[CAMERA][OK] Cảm biến OV5640 PID: 0x%04X\n", s->id.PID);
    if (s->set_contrast)      s->set_contrast(s, 2);
    if (s->set_brightness)    s->set_brightness(s, 0);
    if (s->set_saturation)    s->set_saturation(s, -2);
    if (s->set_sharpness)     s->set_sharpness(s, 2);
    if (s->set_vflip)         s->set_vflip(s, 1);
    if (s->set_exposure_ctrl) s->set_exposure_ctrl(s, 1);
    if (s->set_gain_ctrl)     s->set_gain_ctrl(s, 1);
  }

  return true;
}

static bool convertFrameToGrayscale(const camera_fb_t *fb, uint8_t *dst, int targetW, int targetH) {
  if (!fb || !dst || targetW <= 0 || targetH <= 0) return false;
  size_t expectedPixels = (size_t)targetW * (size_t)targetH;

  switch (fb->format) {
    case PIXFORMAT_GRAYSCALE: {
      if (fb->len >= expectedPixels) {
        memcpy(dst, fb->buf, expectedPixels);
        return true;
      }
      break;
    }
    case PIXFORMAT_YUV422: {
      if (fb->len >= expectedPixels * 2) {
        const uint8_t *src = fb->buf;
        for (size_t i = 0; i < expectedPixels; i++) {
          dst[i] = src[i * 2];
        }
        return true;
      }
      break;
    }
    default: {
      if (fb->len == expectedPixels) {
        memcpy(dst, fb->buf, expectedPixels);
        return true;
      } else if (fb->len >= expectedPixels * 2) {
        const uint8_t *src = fb->buf;
        for (size_t i = 0; i < expectedPixels; i++) {
          dst[i] = src[i * 2];
        }
        return true;
      }
      break;
    }
  }
  return false;
}

// ============================================================================
// FREERTOS TASK: CHỤP ẢNH, CẬP NHẬT DOUBLE-BUFFER STREAM & GIẢI MÃ QR (CORE 1)
// ============================================================================
void qrScannerTask(void *pvParameters) {
  Serial.println("[QR_TASK] Task bắt đầu thực thi tốc độ cao trên Core 1...");

  struct quirc *q = quirc_new();
  if (!q) {
    Serial.println("[QR_TASK][LỖI] quirc_new() trả về NULL!");
    vTaskDelete(NULL);
    return;
  }

  int lastW = 0, lastH = 0;
  unsigned long fpsWindowStart = millis();
  unsigned long framesInWindow = 0;

  while (true) {
    camera_fb_t *fb = esp_camera_fb_get();
    if (!fb) {
      vTaskDelay(pdMS_TO_TICKS(5));
      continue;
    }

    framesInWindow++;
    totalFramesScanned++;

    unsigned long nowMs = millis();
    if (nowMs - fpsWindowStart >= 1000) {
      currentScanFps = (framesInWindow * 1000.0f) / (float)(nowMs - fpsWindowStart);
      framesInWindow = 0;
      fpsWindowStart = nowMs;
    }

    if ((int)fb->width != lastW || (int)fb->height != lastH) {
      if (quirc_resize(q, fb->width, fb->height) < 0) {
        esp_camera_fb_return(fb);
        vTaskDelay(pdMS_TO_TICKS(20));
        continue;
      }
      initStreamBuffers(fb->width, fb->height);
      lastW = fb->width;
      lastH = fb->height;
      currentFrameW = fb->width;
      currentFrameH = fb->height;
    }

    int qw = 0, qh = 0;
    uint8_t *image = quirc_begin(q, &qw, &qh);
    if (!image) {
      esp_camera_fb_return(fb);
      vTaskDelay(pdMS_TO_TICKS(10));
      continue;
    }

    bool ok = convertFrameToGrayscale(fb, image, qw, qh);
    esp_camera_fb_return(fb);
    fb = NULL;

    if (!ok) {
      vTaskDelay(pdMS_TO_TICKS(5));
      continue;
    }

    size_t pixelCount = (size_t)qw * (size_t)qh;
    if (streamBuffers[0] && streamBuffers[1] && streamBufferSize >= pixelCount) {
      int nextIdx = 1 - activeStreamIdx;
      memcpy(streamBuffers[nextIdx], image, pixelCount);
      activeStreamIdx = nextIdx;
      streamFrameSeq++;
    }

    quirc_end(q);

    int numCodes = quirc_count(q);
    for (int i = 0; i < numCodes; i++) {
      struct quirc_code code;
      struct quirc_data data;

      quirc_extract(q, i, &code);

      if (code.size < 21 || code.size > QUIRC_MAX_GRID_SIZE || ((code.size - 17) % 4) != 0) {
        continue;
      }

      portENTER_CRITICAL(&qrMux);
      for (int cIdx = 0; cIdx < 4; cIdx++) {
        lastCorners[cIdx].x = code.corners[cIdx].x;
        lastCorners[cIdx].y = code.corners[cIdx].y;
      }
      lastCornerDetectedMs = millis();
      portEXIT_CRITICAL(&qrMux);

      quirc_decode_error_t err = quirc_decode(&code, &data);
      if (err != QUIRC_SUCCESS) {
        quirc_flip(&code);
        err = quirc_decode(&code, &data);
      }

      if (err == QUIRC_SUCCESS) {
        char payloadStr[MAX_QR_PAYLOAD_LEN + 1];
        int len = data.payload_len;
        if (len > MAX_QR_PAYLOAD_LEN) len = MAX_QR_PAYLOAD_LEN;
        memcpy(payloadStr, data.payload, len);
        payloadStr[len] = '\0';

        totalQRDetections++;

        portENTER_CRITICAL(&qrMux);
        if (!hasPendingQR) {
          strncpy((char *)pendingQRBuffer, payloadStr, sizeof(pendingQRBuffer) - 1);
          pendingQRBuffer[sizeof(pendingQRBuffer) - 1] = '\0';
          hasPendingQR = true;
        }
        portEXIT_CRITICAL(&qrMux);
        break;
      }
    }

    vTaskDelay(pdMS_TO_TICKS(5));
  }

  quirc_destroy(q);
  vTaskDelete(NULL);
}

// ============================================================================
// XỬ LÝ MÃ QR TRÊN MAIN LOOP (CORE 0): HỖ TRỢ CẢ QR WI-FI LẪN QR PHIẾU KHO
// ============================================================================
void processQRCode(const char *qrPayload) {
  String code = String(qrPayload);
  code.trim();

  unsigned long now = millis();
  if (code.equals(lastScannedCode) && (now - lastScanTimestamp < DEBOUNCE_DELAY_MS)) {
    return;
  }

  lastScannedCode = code;
  lastScanTimestamp = now;

  Serial.println();
  Serial.println("============================================================");
  Serial.printf("[QR PHÁT HIỆN NHANH] Nội dung: %s (Tốc độ: %.1f FPS)\n", code.c_str(), currentScanFps);
  Serial.println("============================================================");

  // 1. Kiểm tra nếu là mã QR cấu hình Wi-Fi & IP Backend tự động
  if (tryParseAndApplyWiFiQR(code)) {
    return;
  }

  // 2. Kiểm tra định dạng phiếu kho Karat Retail
  if (!isValidKaratWarehouseFormat(code)) {
    Serial.println("[KIỂM TRA ĐỊNH DẠNG] KHÔNG PHẢI MÃ PHIẾU KHO HOẶC QR WI-FI!");
    strncpy(lastBackendDocStatus, "invalid_format", sizeof(lastBackendDocStatus) - 1);
    strncpy(lastBackendMessage, "Mã QR không phải phiếu kho (DOC:NK-*, DOC:XK-*) hay mã QR Wi-Fi", sizeof(lastBackendMessage) - 1);
    lastBackendHttpCode = 400;
    return;
  }

  // 3. Gửi mã phiếu kho lên Backend
  queryBackendDocument(code);
}

bool isValidKaratWarehouseFormat(const String &code) {
  if (code.startsWith("DOC:NK-") || code.startsWith("DOC:XK-") ||
      code.startsWith("DOC:WH-IN-") || code.startsWith("DOC:WH-OUT-")) {
    return true;
  }
  if (code.startsWith("NK-") || code.startsWith("XK-") ||
      code.startsWith("WH-IN-") || code.startsWith("WH-OUT-")) {
    return true;
  }
  if (code.startsWith("DOC:") && code.length() >= 7) {
    return true;
  }
  if (code.length() == 36 && code.charAt(8) == '-' && code.charAt(13) == '-' &&
      code.charAt(18) == '-' && code.charAt(23) == '-') {
    return true;
  }
  return false;
}

void queryBackendDocument(const String &identifier) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[BACKEND][LỖI] Chưa có kết nối Wi-Fi. Hãy quét mã QR Wi-Fi để kết nối!");
    strncpy(lastBackendMessage, "Chưa có kết nối Wi-Fi! Hãy đưa mã QR Wi-Fi vào Camera để tự kết nối.", sizeof(lastBackendMessage) - 1);
    lastBackendHttpCode = -1;
    return;
  }

  HTTPClient http;
  http.setTimeout(HTTP_TIMEOUT_MS);

  String url = "http://" + activeBackendHost + ":" + String(activeBackendPort) +
               String(BACKEND_API_BASE) + "/warehouse/documents/lookup?identifier=" + urlEncode(identifier) +
               "&deviceIp=" + urlEncode(WiFi.localIP().toString());

  Serial.printf("[HTTP] Đang gửi request tới Backend: %s\n", url.c_str());

  http.begin(url);
  http.addHeader("X-Device-Token", IOT_DEVICE_TOKEN);
  http.addHeader("X-Device-IP", WiFi.localIP().toString());
  http.addHeader("Accept", "application/json");

  int httpCode = http.GET();
  lastBackendHttpCode = httpCode;
  lastBackendLookupMs = millis();
  Serial.printf("[HTTP] Mã phản hồi (HTTP Status): %d\n", httpCode);

  if (httpCode == HTTP_CODE_OK) {
    String responseBody = http.getString();

#if defined(ARDUINOJSON_VERSION_MAJOR) && (ARDUINOJSON_VERSION_MAJOR >= 7)
    JsonDocument doc;
#else
    DynamicJsonDocument doc(4096);
#endif
    DeserializationError error = deserializeJson(doc, responseBody);

    if (error) {
      Serial.printf("[JSON][FAIL] Lỗi parse JSON: %s\n", error.c_str());
      http.end();
      return;
    }

    JsonObject data = doc["data"];
    if (data.isNull()) {
      http.end();
      return;
    }

    const char *docNumber = data["document_number"] | "N/A";
    const char *docType   = data["type"] | "N/A";
    const char *status    = data["status"] | "N/A";
    const char *whName    = data["warehouse_name"] | "Chưa xác định";
    JsonArray items       = data["items"];

    strncpy(lastBackendDocNumber, docNumber, sizeof(lastBackendDocNumber) - 1);
    strncpy(lastBackendDocType, (!strcmp(docType, "receipt") ? "NHẬP KHO" : "XUẤT KHO"), sizeof(lastBackendDocType) - 1);
    strncpy(lastBackendDocStatus, status, sizeof(lastBackendDocStatus) - 1);
    strncpy(lastBackendWarehouse, whName, sizeof(lastBackendWarehouse) - 1);

    if (!strcmp(status, "approved")) {
      strncpy(lastBackendMessage, "HỢP LỆ - Phiếu đã được phê duyệt & ghi nhận xác thực QR IoT!", sizeof(lastBackendMessage) - 1);
    } else if (!strcmp(status, "pending")) {
      strncpy(lastBackendMessage, "CHỜ DUYỆT - Quản lý chưa phê duyệt phiếu này!", sizeof(lastBackendMessage) - 1);
    } else if (!strcmp(status, "rejected")) {
      strncpy(lastBackendMessage, "BỊ TỪ CHỐI - Phiếu đã bị hủy bỏ, không được xuất/nhập!", sizeof(lastBackendMessage) - 1);
    } else if (!strcmp(status, "completed")) {
      strncpy(lastBackendMessage, "ĐÃ HOÀN TẤT - Phiếu này đã được thực hiện trước đó!", sizeof(lastBackendMessage) - 1);
    } else {
      snprintf(lastBackendMessage, sizeof(lastBackendMessage), "Trạng thái phiếu: %s", status);
    }

    Serial.println("+----------------------------------------------------------+");
    Serial.println("|          KẾT QUẢ TRA CỨU PHIẾU KHO KARAT RETAIL         |");
    Serial.println("+----------------------------------------------------------+");
    Serial.printf("| Mã phiếu      : %-40s |\n", docNumber);
    Serial.printf("| Loại phiếu    : %-40s |\n", lastBackendDocType);
    Serial.printf("| Kho hàng      : %-40s |\n", whName);
    Serial.printf("| Trạng thái    : %-40s |\n", status);
    Serial.println("+----------------------------------------------------------+");
    Serial.printf("| => %s\n", lastBackendMessage);
    Serial.println("+----------------------------------------------------------+");
    for (size_t idx = 0; idx < items.size(); idx++) {
      const char *pName = items[idx]["name"] | (items[idx]["product_name"] | "SanPham");
      int qty = items[idx]["quantity"] | 0;
      const char *sku = items[idx]["sku"] | "";
      Serial.printf("|  %u. %-24s [SKU: %-8s] x %-4d       |\n", (unsigned int)(idx + 1), pName, sku, qty);
    }
    Serial.println("+----------------------------------------------------------+");

  } else if (httpCode == HTTP_CODE_NOT_FOUND) {
    strncpy(lastBackendDocStatus, "not_found", sizeof(lastBackendDocStatus) - 1);
    strncpy(lastBackendMessage, "KHÔNG TÌM THẤY PHIẾU KHO (HTTP 404)", sizeof(lastBackendMessage) - 1);
  } else if (httpCode == HTTP_CODE_UNAUTHORIZED) {
    strncpy(lastBackendDocStatus, "unauthorized", sizeof(lastBackendDocStatus) - 1);
    strncpy(lastBackendMessage, "LỖI XÁC THỰC TOKEN THIẾT BỊ IOT (HTTP 401)", sizeof(lastBackendMessage) - 1);
  } else {
    snprintf(lastBackendMessage, sizeof(lastBackendMessage), "Lỗi kết nối Backend %s (HTTP %d)", activeBackendHost.c_str(), httpCode);
  }

  http.end();
}

String urlEncode(const String &str) {
  String encoded = "";
  char c, code0, code1;
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

String urlDecode(const String &str) {
  String decoded = "";
  char c;
  for (size_t i = 0; i < str.length(); i++) {
    c = str.charAt(i);
    if (c == '+') {
      decoded += ' ';
    } else if (c == '%' && i + 2 < str.length()) {
      char h1 = str.charAt(i + 1);
      char h2 = str.charAt(i + 2);
      int v1 = (h1 >= 'a') ? (h1 - 'a' + 10) : ((h1 >= 'A') ? (h1 - 'A' + 10) : (h1 - '0'));
      int v2 = (h2 >= 'a') ? (h2 - 'a' + 10) : ((h2 >= 'A') ? (h2 - 'A' + 10) : (h2 - '0'));
      decoded += (char)((v1 << 4) | v2);
      i += 2;
    } else {
      decoded += c;
    }
  }
  return decoded;
}
