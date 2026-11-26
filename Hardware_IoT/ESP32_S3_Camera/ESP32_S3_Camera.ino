/*
 * KARAT RETAIL - ESP32-S3 + OV5640
 * BAN CHAN DOAN CAMERA (DIAGNOSTIC MODE)
 *
 * Muc dich: bien dich va kiem tra camera truoc.
 * Chua quet QR / chua goi Backend trong ban nay.
 *
 * Truoc khi nap:
 * 1. Giu file camera_pins.h trong cung thu muc sketch.
 * 2. Giu file config.h trong cung thu muc sketch.
 * 3. Trong config.h, dat:
 *      #define DIAGNOSTIC_MODE true
 *      #define CAMERA_FRAME_SIZE FRAMESIZE_QVGA
 * 4. Arduino IDE: Board ESP32-S3 dung voi board thuc te,
 *    PSRAM = OPI PSRAM (neu menu board co muc nay).
 */

#include <Arduino.h>
#include "esp_camera.h"
#include "camera_pins.h"
#include "config.h"

void printBanner();
void checkPSRAM();
bool initCameraManual();
void runDiagnostics();

void setup() {
  Serial.begin(115200);
  delay(1500);

  printBanner();
  checkPSRAM();

  Serial.println();
  Serial.println("[MODE] CAMERA DIAGNOSTIC");
  Serial.println("[INFO] Ban nay chi kiem tra camera, chua quet QR.");
  Serial.println("[INFO] Dang khoi tao camera OV5640...");

  if (!initCameraManual()) {
    Serial.println("[STOP] Camera khoi tao that bai. Kiem tra log phia tren.");
    while (true) {
      delay(1000);
    }
  }

  sensor_t *sensor = esp_camera_sensor_get();
  if (sensor != nullptr) {
    Serial.printf("[OK] Camera PID: 0x%04X\n", sensor->id.PID);

    // Thiet lap hinh anh co ban; neu board bi nguoc co the doi set_vflip.
    if (sensor->set_contrast)   sensor->set_contrast(sensor, 2);
    if (sensor->set_brightness) sensor->set_brightness(sensor, 0);
    if (sensor->set_saturation) sensor->set_saturation(sensor, -2);
    if (sensor->set_sharpness)  sensor->set_sharpness(sensor, 2);
    // Neu hinh bi lat nguoc, doi 1 thanh 0.
    if (sensor->set_vflip)      sensor->set_vflip(sensor, 1);
  } else {
    Serial.println("[WARN] Khong doc duoc thong tin sensor.");
  }

  Serial.println();
  Serial.println("[OK] Camera da khoi tao.");
  Serial.println("[INFO] Mo Serial Monitor o baud 115200 de xem ket qua.");
  Serial.println("------------------------------------------------------------");
}

void loop() {
  runDiagnostics();
  delay(10);
}

void printBanner() {
  Serial.println();
  Serial.println("============================================================");
  Serial.println(" KARAT RETAIL - ESP32-S3 WROOM N16R8 + OV5640");
  Serial.printf(" Chip: ESP32-S3 | CPU: %d MHz | Flash: %u MB\n",
                ESP.getCpuFreqMHz(),
                (unsigned int)(ESP.getFlashChipSize() / (1024 * 1024)));
  Serial.println("============================================================");
}

void checkPSRAM() {
  if (psramFound()) {
    Serial.printf("[PSRAM] OK - Tong: %u MB | Con trong: %u KB\n",
                  (unsigned int)(ESP.getPsramSize() / (1024 * 1024)),
                  (unsigned int)(ESP.getFreePsram() / 1024));
  } else {
    Serial.println("[PSRAM][WARN] Khong tim thay PSRAM.");
    Serial.println("Kiem tra board/PSRAM settings trong Arduino IDE.");
  }
}

bool initCameraManual() {
  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;

  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;

  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;

  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_GRAYSCALE;
  config.frame_size = CAMERA_FRAME_SIZE;
  config.grab_mode = CAMERA_GRAB_LATEST;
  config.fb_location = CAMERA_FB_IN_PSRAM;
  config.fb_count = 2;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[CAMERA][FAIL] esp_camera_init error: 0x%x\n", err);
    Serial.println("Kiem tra day FPC, pin mapping trong camera_pins.h, va PSRAM.");
    return false;
  }

  Serial.println("[CAMERA][OK] esp_camera_init thanh cong.");
  return true;
}

void runDiagnostics() {
  static unsigned long lastCaptureTime = 0;
  static unsigned long captureCount = 0;

  const unsigned long now = millis();
  if (now - lastCaptureTime < 1500) {
    return;
  }
  lastCaptureTime = now;
  captureCount++;

  const unsigned long start = millis();
  camera_fb_t *fb = esp_camera_fb_get();
  const unsigned long duration = millis() - start;

  if (fb == nullptr) {
    Serial.printf("[SHOT %lu][FAIL] Khong lay duoc frame tu camera.\n", captureCount);
    return;
  }

  Serial.printf("[SHOT %lu][OK] %ux%u | %u bytes | %lu ms\n",
                captureCount,
                (unsigned int)fb->width,
                (unsigned int)fb->height,
                (unsigned int)fb->len,
                duration);

  esp_camera_fb_return(fb);
}
