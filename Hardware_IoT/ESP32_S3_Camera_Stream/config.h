#ifndef CONFIG_H
#define CONFIG_H

#include "esp_camera.h"

// ============================================================================
// CẤU HÌNH FIRMWARE XEM STREAM CAMERA QUA WI-FI (ESP32-S3 + OV5640)
// Dùng để kiểm tra độ nét và căn chỉnh vòng xoay ống kính (Lens Focus)
// ============================================================================

// 1. Cấu hình Wi-Fi (Bắt buộc dùng Wi-Fi băng tần 2.4GHz, ESP32 không hỗ trợ 5GHz)
// Lưu ý: Mật khẩu này CHỈ được dùng để kết nối mạng, TUYỆT ĐỐI KHÔNG hiển thị lên trang web.
#define WIFI_SSID           "Hue"
#define WIFI_PASSWORD       "026203060309"

// Số lần thử kết nối lại Wi-Fi tối đa trước khi báo lỗi (mỗi lần 500ms)
#define WIFI_CONNECT_TIMEOUT_SEC 20

// 2. Độ phân giải ban đầu khi khởi động
// - FRAMESIZE_QVGA (320x240): Nhẹ nhất, tốc độ khung hình cao nhất (~25-30 FPS)
// - FRAMESIZE_VGA  (640x480): Khuyến nghị để chỉnh nét (Focus) và quét QR (~15-20 FPS)
// - FRAMESIZE_SVGA (800x600): Độ chi tiết cao, rất rõ nét
// - FRAMESIZE_XGA  (1024x768): Cực nét, FPS khoảng ~8-12 FPS
#define INITIAL_FRAME_SIZE  FRAMESIZE_VGA

// 3. Chất lượng nén JPEG (10 = Nét nhất, 63 = Nén nhiều nhất/mờ nhất)
// Khi dùng PSRAM 8MB (OPI), giá trị 10 - 12 cho hình ảnh rất nét và rõ từng chi tiết module QR.
#define INITIAL_JPEG_QUALITY 12

// 4. Cổng HTTP Web Server
#define HTTP_SERVER_PORT    80

#endif // CONFIG_H
