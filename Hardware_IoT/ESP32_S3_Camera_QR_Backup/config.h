#ifndef CONFIG_H
#define CONFIG_H

#include "esp_camera.h"

// ============================================================================
// CẤU HÌNH FIRMWARE QUÉT QR & GỌI BACKEND KARAT RETAIL
// Phần cứng: ESP32-S3 WROOM Dual Type-C (N16R8) + Cảm biến OV5640
// ============================================================================

// 1. Cấu hình Wi-Fi (Bắt buộc dùng Wi-Fi băng tần 2.4GHz)
#define WIFI_SSID           "Hue"
#define WIFI_PASSWORD       "026203060309"
#define WIFI_TIMEOUT_SEC    20

// 2. Cấu hình Backend Node.js
// Điền IP mạng LAN của máy tính đang chạy Backend (Ví dụ: "192.168.1.15")
// KHÔNG dùng "localhost" hoặc "127.0.0.1" vì ESP32 là thiết bị ngoại vi độc lập.
#define BACKEND_HOST        "192.168.1.3"
#define BACKEND_PORT        3000
#define BACKEND_API_BASE    "/api/v1"

// 3. Khóa xác thực Device Token (Khớp với IOT_DEVICE_TOKEN trong Backend/.env)
#define IOT_DEVICE_TOKEN    "karat_esp32_device_token"

// 4. Độ phân giải Camera khi quét QR:
// - FRAMESIZE_QVGA (320x240): Tốc độ giải mã rất nhanh (~40-70ms/frame) -> KHUYẾN NGHỊ
// - FRAMESIZE_VGA  (640x480): Chi tiết cao hơn nhưng giải mã lâu hơn (~150-250ms/frame)
#define CAMERA_FRAME_SIZE   FRAMESIZE_QVGA

// 5. Thời gian chống quét lặp cho cùng một mã QR (milliseconds)
// Tránh gửi dồn dập nhiều HTTP request tới Backend khi người dùng giữ mã trước ống kính
#define DEBOUNCE_DELAY_MS   4000

// 6. Thời gian timeout khi gửi HTTP request tới Backend (milliseconds)
#define HTTP_TIMEOUT_MS     5000

#endif // CONFIG_H
