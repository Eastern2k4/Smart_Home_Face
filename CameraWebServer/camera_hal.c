#include "camera_hal.h"
#include "config.h"
#include "board_config.h"
#include "camera_pins.h"
#include <string.h>   // add this line


static bool is_initialised = false;

bool camera_init(void) {
    camera_config_t config = {0};
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
    config.xclk_freq_hz = XCLK_FREQ_HZ;
    config.frame_size = DEFAULT_FRAME_SIZE;
    config.pixel_format = DEFAULT_PIXEL_FORMAT;
    config.grab_mode = CAMERA_GRAB_LATEST;
    config.fb_location = CAMERA_FB_IN_PSRAM;
    config.jpeg_quality = DEFAULT_JPEG_QUALITY;
    config.fb_count = FB_COUNT;

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        return false;
    }

    // Apply sensor‑specific tweaks
    sensor_t *s = esp_camera_sensor_get();
    if (s->id.PID == OV3660_PID) {
        s->set_vflip(s, 1);
        s->set_brightness(s, 1);
        s->set_saturation(s, -2);
    }
#if defined(CAMERA_MODEL_M5STACK_WIDE) || defined(CAMERA_MODEL_M5STACK_ESP32CAM)
    s->set_vflip(s, 1);
    s->set_hmirror(s, 1);
#endif

    is_initialised = true;
    return true;
}

camera_fb_t* camera_capture(void) {
    if (!is_initialised) return NULL;
    return esp_camera_fb_get();
}

void camera_free_frame(camera_fb_t *fb) {
    if (fb) esp_camera_fb_return(fb);
}

sensor_t* camera_get_sensor(void) {
    return is_initialised ? esp_camera_sensor_get() : NULL;
}

int camera_set_parameter(const char *var, int val) {
    sensor_t *s = camera_get_sensor();
    if (!s) return -1;

    if (strcmp(var, "framesize") == 0) {
        if (s->pixformat == PIXFORMAT_JPEG)
            return s->set_framesize(s, (framesize_t)val);
    } else if (strcmp(var, "quality") == 0) {
        return s->set_quality(s, val);
    } else if (strcmp(var, "contrast") == 0) {
        return s->set_contrast(s, val);
    } else if (strcmp(var, "brightness") == 0) {
        return s->set_brightness(s, val);
    } else if (strcmp(var, "saturation") == 0) {
        return s->set_saturation(s, val);
    } else if (strcmp(var, "gainceiling") == 0) {
        return s->set_gainceiling(s, (gainceiling_t)val);
    } else if (strcmp(var, "colorbar") == 0) {
        return s->set_colorbar(s, val);
    } else if (strcmp(var, "awb") == 0) {
        return s->set_whitebal(s, val);
    } else if (strcmp(var, "agc") == 0) {
        return s->set_gain_ctrl(s, val);
    } else if (strcmp(var, "aec") == 0) {
        return s->set_exposure_ctrl(s, val);
    } else if (strcmp(var, "hmirror") == 0) {
        return s->set_hmirror(s, val);
    } else if (strcmp(var, "vflip") == 0) {
        return s->set_vflip(s, val);
    } else if (strcmp(var, "awb_gain") == 0) {
        return s->set_awb_gain(s, val);
    } else if (strcmp(var, "agc_gain") == 0) {
        return s->set_agc_gain(s, val);
    } else if (strcmp(var, "aec_value") == 0) {
        return s->set_aec_value(s, val);
    } else if (strcmp(var, "aec2") == 0) {
        return s->set_aec2(s, val);
    } else if (strcmp(var, "dcw") == 0) {
        return s->set_dcw(s, val);
    } else if (strcmp(var, "bpc") == 0) {
        return s->set_bpc(s, val);
    } else if (strcmp(var, "wpc") == 0) {
        return s->set_wpc(s, val);
    } else if (strcmp(var, "raw_gma") == 0) {
        return s->set_raw_gma(s, val);
    } else if (strcmp(var, "lenc") == 0) {
        return s->set_lenc(s, val);
    } else if (strcmp(var, "special_effect") == 0) {
        return s->set_special_effect(s, val);
    } else if (strcmp(var, "wb_mode") == 0) {
        return s->set_wb_mode(s, val);
    } else if (strcmp(var, "ae_level") == 0) {
        return s->set_ae_level(s, val);
    }
    return -1; // unknown parameter
}

int camera_get_parameter(const char *var) {
    sensor_t *s = camera_get_sensor();
    if (!s) return -1;
    // For simplicity, we only return the current status fields.
    // More can be added.
    if (strcmp(var, "framesize") == 0) return s->status.framesize;
    if (strcmp(var, "quality") == 0) return s->status.quality;
    if (strcmp(var, "brightness") == 0) return s->status.brightness;
    // ...
    return -1;
}
