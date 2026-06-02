#ifndef CONFIG_H
#define CONFIG_H

// WiFi/backend configuration is generated from config/app*.json.
#if __has_include("config.generated.h")
#include "config.generated.h"
#else
#include "config.generated.example.h"
#endif

// Camera defaults
#define DEFAULT_FRAME_SIZE     FRAMESIZE_VGA   // 640x480
#define DEFAULT_JPEG_QUALITY   80
#define DEFAULT_PIXEL_FORMAT   PIXFORMAT_JPEG
#define XCLK_FREQ_HZ           20000000
#define FB_COUNT               2

// LED (GPIO is defined in camera_pins.h)
#define CONFIG_LED_MAX_INTENSITY 255

// Stream boundary (must match client expectation)
#define STREAM_BOUNDARY       "123456789000000000000987654321"

#endif // CONFIG_H
