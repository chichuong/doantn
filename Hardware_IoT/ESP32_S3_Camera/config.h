#ifndef CONFIG_H
#define CONFIG_H

#include "esp_camera.h"

// ============================================================================
// CẤU HÌNH HỆ THỐNG FIRMWARE ESP32-S3 CAMERA OV5640 (KARAT RETAIL)
// ============================================================================

// 1. Chế độ kiểm tra chẩn đoán Camera (Diagnostic Mode)
// - true: Chỉ khởi tạo camera, kiểm tra PSRAM, chụp ảnh thử nghiệm và in thông số. KHÔNG chạy QR hay Wi-Fi.
// - false: Chạy toàn bộ quy trình: Quét QR -> Gửi Backend -> Hiển thị kết quả trên Serial Monitor.
#define DIAGNOSTIC_MODE     true

// 2. Độ phân giải Camera
// - FRAMESIZE_QVGA (320x240): Tốc độ giải mã nhanh (~40-70ms), phù hợp QR tiêu chuẩn. (Khuyến nghị)
// - FRAMESIZE_VGA  (640x480): Độ chi tiết cao hơn gấp 4 lần, phù hợp QR nhỏ hoặc xa (~120-180ms).
#define CAMERA_FRAME_SIZE   FRAMESIZE_QVGA

// 3. Cấu hình Wi-Fi (Bắt buộc dùng Wi-Fi 2.4GHz, ESP32 không hỗ trợ 5GHz)
#define WIFI_SSID           "Hue"
#define WIFI_PASSWORD       "026203060309"

// 4. Cấu hình Backend Node.js
// Điền IP mạng LAN của máy tính đang chạy Backend (Ví dụ: 192.168.1.15)
// KHÔNG dùng "localhost" hoặc "127.0.0.1"
#define BACKEND_HOST        "192.168.1.3"
#define BACKEND_PORT        3000
#define BACKEND_API_BASE    "/api/v1"

// 5. Khóa xác thực Device Token (Khớp với IOT_DEVICE_TOKEN trong Backend/.env)
#define IOT_DEVICE_TOKEN    "karat_esp32_device_token"

// 6. Thời gian chống gửi lặp cho cùng một mã QR (milliseconds)
#define DEBOUNCE_DELAY_MS   3000

// 7. Timeout cho HTTP request gửi tới Backend (milliseconds)
#define HTTP_TIMEOUT_MS     5000

#endif // CONFIG_H
