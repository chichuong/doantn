#ifndef CAMERA_PINS_H
#define CAMERA_PINS_H

// ============================================================================
// ĐỊNH NGHĨA CHÂN CAMERA CHO BOARD ESP32-S3 WROOM DUAL TYPE-C (N16R8)
// Giữ nguyên 100% sơ đồ chân đã kiểm thử và khởi tạo thành công ở bản chẩn đoán
// Cảm biến: OV5640 5 Megapixel (Cáp FPC 24-pin)
// ============================================================================

#define PWDN_GPIO_NUM     -1
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM     15
#define SIOD_GPIO_NUM      4  // SCCB / I2C Data
#define SIOC_GPIO_NUM      5  // SCCB / I2C Clock

// Dữ liệu 8-bit DVP (Y2 đến Y9 tương ứng D0 đến D7 của OV5640)
#define Y9_GPIO_NUM       16  // D7
#define Y8_GPIO_NUM       17  // D6
#define Y7_GPIO_NUM       18  // D5
#define Y6_GPIO_NUM       12  // D4
#define Y5_GPIO_NUM       10  // D3
#define Y4_GPIO_NUM        8  // D2
#define Y3_GPIO_NUM        9  // D1
#define Y2_GPIO_NUM       11  // D0

#define VSYNC_GPIO_NUM     6  // Vertical Sync
#define HREF_GPIO_NUM      7  // Horizontal Reference
#define PCLK_GPIO_NUM     13  // Pixel Clock

#define BUZZER_PIN        -1
#define LED_PIN           -1

#endif // CAMERA_PINS_H
