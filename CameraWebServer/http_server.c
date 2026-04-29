#include "esp_http_server.h"
#include "esp_timer.h"
#include "esp_camera.h"
#include "fb_gfx.h"
#include "sdkconfig.h"
#include "camera_index.h"
#include "board_config.h"
#include "config.h"
#include "camera_hal.h"
#include "led_control.h"
#include "image_utils.h"

#if defined(ARDUINO_ARCH_ESP32) && defined(CONFIG_ARDUHAL_ESP_LOG)
#include "esp32-hal-log.h"
#endif

// ========== Stream helpers ==========
typedef struct {
    httpd_req_t *req;
    size_t len;
} jpg_chunking_t;

#define PART_BOUNDARY STREAM_BOUNDARY
static const char *_STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char *_STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char *_STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\nX-Timestamp: %d.%06d\r\n\r\n";

httpd_handle_t stream_httpd = NULL;
httpd_handle_t camera_httpd = NULL;

// ========== Running average filter ==========
typedef struct {
    size_t size; size_t index; size_t count; int sum; int *values;
} ra_filter_t;
static ra_filter_t ra_filter;

static ra_filter_t *ra_filter_init(ra_filter_t *filter, size_t sample_size) {
    memset(filter, 0, sizeof(ra_filter_t));
    filter->values = (int *)malloc(sample_size * sizeof(int));
    if (!filter->values) return NULL;
    memset(filter->values, 0, sample_size * sizeof(int));
    filter->size = sample_size;
    return filter;
}

#if ARDUHAL_LOG_LEVEL >= ARDUHAL_LOG_LEVEL_INFO
static int ra_filter_run(ra_filter_t *filter, int value) {
    if (!filter->values) return value;
    filter->sum -= filter->values[filter->index];
    filter->values[filter->index] = value;
    filter->sum += filter->values[filter->index];
    filter->index = (filter->index + 1) % filter->size;
    if (filter->count < filter->size) filter->count++;
    return filter->sum / filter->count;
}
#endif

// ========== Chunked JPEG callback ==========
static size_t jpg_encode_stream(void *arg, size_t index, const void *data, size_t len) {
    jpg_chunking_t *j = (jpg_chunking_t *)arg;
    if (!index) j->len = 0;
    if (httpd_resp_send_chunk(j->req, (const char *)data, len) != ESP_OK) return 0;
    j->len += len;
    return len;
}

// ========== BMP handler ==========
static esp_err_t bmp_handler(httpd_req_t *req) {
    camera_fb_t *fb = camera_capture();
    if (!fb) {
        log_e("Camera capture failed");
        httpd_resp_send_500(req);
        return ESP_FAIL;
    }

    httpd_resp_set_type(req, "image/x-windows-bmp");
    httpd_resp_set_hdr(req, "Content-Disposition", "inline; filename=capture.bmp");
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

    char ts[32];
    snprintf(ts, 32, "%lld.%06ld", fb->timestamp.tv_sec, fb->timestamp.tv_usec);
    httpd_resp_set_hdr(req, "X-Timestamp", ts);

    uint8_t *buf = NULL;
    size_t buf_len = 0;
    bool converted = frame_to_bmp(fb, &buf, &buf_len);
    camera_free_frame(fb);
    if (!converted) {
        log_e("BMP conversion failed");
        httpd_resp_send_500(req);
        return ESP_FAIL;
    }
    esp_err_t res = httpd_resp_send(req, (const char *)buf, buf_len);
    free_image_buf(buf);
    return res;
}

// ========== Still JPEG handler ==========
static esp_err_t capture_handler(httpd_req_t *req) {
    camera_fb_t *fb = NULL;
    esp_err_t res = ESP_OK;

#if defined(LED_GPIO_NUM)
    led_enable(true);
    vTaskDelay(150 / portTICK_PERIOD_MS);
    fb = camera_capture();
    led_enable(false);
#else
    fb = camera_capture();
#endif

    if (!fb) {
        log_e("Camera capture failed");
        httpd_resp_send_500(req);
        return ESP_FAIL;
    }

    httpd_resp_set_type(req, "image/jpeg");
    httpd_resp_set_hdr(req, "Content-Disposition", "inline; filename=capture.jpg");
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

    char ts[32];
    snprintf(ts, 32, "%lld.%06ld", fb->timestamp.tv_sec, fb->timestamp.tv_usec);
    httpd_resp_set_hdr(req, "X-Timestamp", ts);

    if (fb->format == PIXFORMAT_JPEG) {
        res = httpd_resp_send(req, (const char *)fb->buf, fb->len);
    } else {
        jpg_chunking_t jchunk = {req, 0};
        res = frame2jpg_cb(fb, DEFAULT_JPEG_QUALITY, jpg_encode_stream, &jchunk) ? ESP_OK : ESP_FAIL;
        httpd_resp_send_chunk(req, NULL, 0);
    }
    camera_free_frame(fb);
    return res;
}

// ========== MJPEG stream handler ==========
static esp_err_t stream_handler(httpd_req_t *req) {
    camera_fb_t *fb = NULL;
    struct timeval _timestamp;
    esp_err_t res = ESP_OK;
    size_t _jpg_buf_len = 0;
    uint8_t *_jpg_buf = NULL;
    char part_buf[128];

    static int64_t last_frame = 0;
    if (!last_frame) last_frame = esp_timer_get_time();

    res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
    if (res != ESP_OK) return res;

    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    httpd_resp_set_hdr(req, "X-Framerate", "60");

    led_stream_begin();

    while (true) {
        fb = camera_capture();
        if (!fb) {
            log_e("Camera capture failed");
            res = ESP_FAIL;
        } else {
            _timestamp.tv_sec = fb->timestamp.tv_sec;
            _timestamp.tv_usec = fb->timestamp.tv_usec;
            if (fb->format != PIXFORMAT_JPEG) {
                bool jpeg_converted = frame_to_jpeg(fb, &_jpg_buf, &_jpg_buf_len, DEFAULT_JPEG_QUALITY);
                camera_free_frame(fb);
                fb = NULL;
                if (!jpeg_converted) {
                    log_e("JPEG compression failed");
                    res = ESP_FAIL;
                }
            } else {
                _jpg_buf_len = fb->len;
                _jpg_buf = fb->buf;
            }
        }

        if (res == ESP_OK) {
            res = httpd_resp_send_chunk(req, _STREAM_BOUNDARY, strlen(_STREAM_BOUNDARY));
        }
        if (res == ESP_OK) {
            size_t hlen = snprintf(part_buf, sizeof(part_buf), _STREAM_PART,
                                    _jpg_buf_len, _timestamp.tv_sec, _timestamp.tv_usec);
            res = httpd_resp_send_chunk(req, part_buf, hlen);
        }
        if (res == ESP_OK) {
            res = httpd_resp_send_chunk(req, (const char *)_jpg_buf, _jpg_buf_len);
        }

        if (fb) {
            camera_free_frame(fb);
            fb = NULL;
            _jpg_buf = NULL;
        } else if (_jpg_buf) {
            free_image_buf(_jpg_buf);
            _jpg_buf = NULL;
        }

        if (res != ESP_OK) {
            log_e("Send frame failed");
            break;
        }

        int64_t fr_end = esp_timer_get_time();
        int64_t frame_time = (fr_end - last_frame) / 1000;
        last_frame = fr_end;

        uint32_t avg_frame_time = 0;
#if ARDUHAL_LOG_LEVEL >= ARDUHAL_LOG_LEVEL_INFO
        avg_frame_time = ra_filter_run(&ra_filter, frame_time);
#endif
        log_i("MJPG: %uB %lldms (%.1ffps), AVG: %ums (%.1ffps)",
              (uint32_t)_jpg_buf_len, frame_time, 1000.0 / (frame_time ? frame_time : 1),
              avg_frame_time, 1000.0 / (avg_frame_time ? avg_frame_time : 1));
    }

    led_stream_end();
    return res;
}

// ========== Query string parser ==========
static esp_err_t parse_get(httpd_req_t *req, char **obuf) {
    size_t buf_len = httpd_req_get_url_query_len(req) + 1;
    if (buf_len > 1) {
        char *buf = (char *)malloc(buf_len);
        if (!buf) {
            httpd_resp_send_500(req);
            return ESP_FAIL;
        }
        if (httpd_req_get_url_query_str(req, buf, buf_len) == ESP_OK) {
            *obuf = buf;
            return ESP_OK;
        }
        free(buf);
    }
    httpd_resp_send_404(req);
    return ESP_FAIL;
}

// ========== Control handler ==========
static esp_err_t cmd_handler(httpd_req_t *req) {
    char *buf = NULL;
    char variable[32];
    char value[32];

    if (parse_get(req, &buf) != ESP_OK) return ESP_FAIL;
    if (httpd_query_key_value(buf, "var", variable, sizeof(variable)) != ESP_OK ||
        httpd_query_key_value(buf, "val", value, sizeof(value)) != ESP_OK) {
        free(buf);
        httpd_resp_send_404(req);
        return ESP_FAIL;
    }
    free(buf);

    int val = atoi(value);
    log_i("%s = %d", variable, val);
    int res;

    if (strcmp(variable, "led_intensity") == 0) {
        led_set_intensity(val);
        res = 0;
    } else {
        res = camera_set_parameter(variable, val);
    }

    if (res < 0) {
        return httpd_resp_send_500(req);
    }
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    return httpd_resp_send(req, NULL, 0);
}

// ========== Register dump helpers ==========
static int print_reg(char *p, sensor_t *s, uint16_t reg, uint32_t mask) {
    return sprintf(p, "\"0x%x\":%u,", reg, s->get_reg(s, reg, mask));
}

// ========== Status handler ==========
static esp_err_t status_handler(httpd_req_t *req) {
    static char json_response[1024];
    sensor_t *s = camera_get_sensor();
    if (!s) {
        httpd_resp_send_500(req);
        return ESP_FAIL;
    }

    char *p = json_response;
    *p++ = '{';

    // Register dumps for specific sensors
    if (s->id.PID == OV5640_PID || s->id.PID == OV3660_PID) {
        for (int reg = 0x3400; reg < 0x3406; reg += 2) p += print_reg(p, s, reg, 0xFFF);
        p += print_reg(p, s, 0x3406, 0xFF);
        p += print_reg(p, s, 0x3500, 0xFFFF0);
        p += print_reg(p, s, 0x3503, 0xFF);
        p += print_reg(p, s, 0x350a, 0x3FF);
        p += print_reg(p, s, 0x350c, 0xFFFF);
        for (int reg = 0x5480; reg <= 0x5490; reg++) p += print_reg(p, s, reg, 0xFF);
        for (int reg = 0x5380; reg <= 0x538b; reg++) p += print_reg(p, s, reg, 0xFF);
        for (int reg = 0x5580; reg < 0x558a; reg++) p += print_reg(p, s, reg, 0xFF);
        p += print_reg(p, s, 0x558a, 0x1FF);
    } else if (s->id.PID == OV2640_PID) {
        p += print_reg(p, s, 0xd3, 0xFF);
        p += print_reg(p, s, 0x111, 0xFF);
        p += print_reg(p, s, 0x132, 0xFF);
    }

    // Standard status fields
    p += sprintf(p, "\"xclk\":%u,", s->xclk_freq_hz / 1000000);
    p += sprintf(p, "\"pixformat\":%u,", s->pixformat);
    p += sprintf(p, "\"framesize\":%u,", s->status.framesize);
    p += sprintf(p, "\"quality\":%u,", s->status.quality);
    p += sprintf(p, "\"brightness\":%d,", s->status.brightness);
    p += sprintf(p, "\"contrast\":%d,", s->status.contrast);
    p += sprintf(p, "\"saturation\":%d,", s->status.saturation);
    p += sprintf(p, "\"sharpness\":%d,", s->status.sharpness);
    p += sprintf(p, "\"special_effect\":%u,", s->status.special_effect);
    p += sprintf(p, "\"wb_mode\":%u,", s->status.wb_mode);
    p += sprintf(p, "\"awb\":%u,", s->status.awb);
    p += sprintf(p, "\"awb_gain\":%u,", s->status.awb_gain);
    p += sprintf(p, "\"aec\":%u,", s->status.aec);
    p += sprintf(p, "\"aec2\":%u,", s->status.aec2);
    p += sprintf(p, "\"ae_level\":%d,", s->status.ae_level);
    p += sprintf(p, "\"aec_value\":%u,", s->status.aec_value);
    p += sprintf(p, "\"agc\":%u,", s->status.agc);
    p += sprintf(p, "\"agc_gain\":%u,", s->status.agc_gain);
    p += sprintf(p, "\"gainceiling\":%u,", s->status.gainceiling);
    p += sprintf(p, "\"bpc\":%u,", s->status.bpc);
    p += sprintf(p, "\"wpc\":%u,", s->status.wpc);
    p += sprintf(p, "\"raw_gma\":%u,", s->status.raw_gma);
    p += sprintf(p, "\"lenc\":%u,", s->status.lenc);
    p += sprintf(p, "\"hmirror\":%u,", s->status.hmirror);
    p += sprintf(p, "\"vflip\":%u,", s->status.vflip);
    p += sprintf(p, "\"dcw\":%u,", s->status.dcw);
    p += sprintf(p, "\"colorbar\":%u", s->status.colorbar);
#if defined(LED_GPIO_NUM)
    // We need the current LED duty – we'll get it via a function in led_control
    extern int led_get_duty(void);
    p += sprintf(p, ",\"led_intensity\":%u", led_get_duty());
#else
    p += sprintf(p, ",\"led_intensity\":%d", -1);
#endif
    *p++ = '}';
    *p++ = '\0';

    httpd_resp_set_type(req, "application/json");
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    return httpd_resp_send(req, json_response, strlen(json_response));
}

// ========== XCLK handler ==========
static esp_err_t xclk_handler(httpd_req_t *req) {
    char *buf = NULL;
    char _xclk[32];
    if (parse_get(req, &buf) != ESP_OK) return ESP_FAIL;
    if (httpd_query_key_value(buf, "xclk", _xclk, sizeof(_xclk)) != ESP_OK) {
        free(buf);
        httpd_resp_send_404(req);
        return ESP_FAIL;
    }
    free(buf);
    int xclk = atoi(_xclk);
    log_i("Set XCLK: %d MHz", xclk);
    sensor_t *s = camera_get_sensor();
    if (!s || s->set_xclk(s, LEDC_TIMER_0, xclk) != 0) {
        return httpd_resp_send_500(req);
    }
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    return httpd_resp_send(req, NULL, 0);
}

// ========== Register write handler ==========
static esp_err_t reg_handler(httpd_req_t *req) {
    char *buf = NULL;
    char _reg[32], _mask[32], _val[32];
    if (parse_get(req, &buf) != ESP_OK) return ESP_FAIL;
    if (httpd_query_key_value(buf, "reg", _reg, sizeof(_reg)) != ESP_OK ||
        httpd_query_key_value(buf, "mask", _mask, sizeof(_mask)) != ESP_OK ||
        httpd_query_key_value(buf, "val", _val, sizeof(_val)) != ESP_OK) {
        free(buf);
        httpd_resp_send_404(req);
        return ESP_FAIL;
    }
    free(buf);
    int reg = atoi(_reg);
    int mask = atoi(_mask);
    int val = atoi(_val);
    log_i("Set register: 0x%02x mask 0x%02x val 0x%02x", reg, mask, val);
    sensor_t *s = camera_get_sensor();
    if (!s || s->set_reg(s, reg, mask, val) != 0) {
        return httpd_resp_send_500(req);
    }
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    return httpd_resp_send(req, NULL, 0);
}

// ========== Register read handler ==========
static esp_err_t greg_handler(httpd_req_t *req) {
    char *buf = NULL;
    char _reg[32], _mask[32];
    if (parse_get(req, &buf) != ESP_OK) return ESP_FAIL;
    if (httpd_query_key_value(buf, "reg", _reg, sizeof(_reg)) != ESP_OK ||
        httpd_query_key_value(buf, "mask", _mask, sizeof(_mask)) != ESP_OK) {
        free(buf);
        httpd_resp_send_404(req);
        return ESP_FAIL;
    }
    free(buf);
    int reg = atoi(_reg);
    int mask = atoi(_mask);
    sensor_t *s = camera_get_sensor();
    if (!s) return httpd_resp_send_500(req);
    int res = s->get_reg(s, reg, mask);
    if (res < 0) return httpd_resp_send_500(req);
    char buffer[20];
    const char *val = itoa(res, buffer, 10);
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    return httpd_resp_send(req, val, strlen(val));
}

// ========== PLL handler ==========
static int parse_get_var(char *buf, const char *key, int def) {
    char _int[16];
    if (httpd_query_key_value(buf, key, _int, sizeof(_int)) != ESP_OK) return def;
    return atoi(_int);
}

static esp_err_t pll_handler(httpd_req_t *req) {
    char *buf = NULL;
    if (parse_get(req, &buf) != ESP_OK) return ESP_FAIL;
    int bypass = parse_get_var(buf, "bypass", 0);
    int mul    = parse_get_var(buf, "mul", 0);
    int sys    = parse_get_var(buf, "sys", 0);
    int root   = parse_get_var(buf, "root", 0);
    int pre    = parse_get_var(buf, "pre", 0);
    int seld5  = parse_get_var(buf, "seld5", 0);
    int pclken = parse_get_var(buf, "pclken", 0);
    int pclk   = parse_get_var(buf, "pclk", 0);
    free(buf);
    sensor_t *s = camera_get_sensor();
    if (!s || s->set_pll(s, bypass, mul, sys, root, pre, seld5, pclken, pclk) != 0) {
        return httpd_resp_send_500(req);
    }
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    return httpd_resp_send(req, NULL, 0);
}

// ========== Resolution/window handler ==========
static esp_err_t win_handler(httpd_req_t *req) {
    char *buf = NULL;
    if (parse_get(req, &buf) != ESP_OK) return ESP_FAIL;
    int startX  = parse_get_var(buf, "sx", 0);
    int startY  = parse_get_var(buf, "sy", 0);
    int endX    = parse_get_var(buf, "ex", 0);
    int endY    = parse_get_var(buf, "ey", 0);
    int offsetX = parse_get_var(buf, "offx", 0);
    int offsetY = parse_get_var(buf, "offy", 0);
    int totalX  = parse_get_var(buf, "tx", 0);
    int totalY  = parse_get_var(buf, "ty", 0);
    int outputX = parse_get_var(buf, "ox", 0);
    int outputY = parse_get_var(buf, "oy", 0);
    bool scale  = parse_get_var(buf, "scale", 0) == 1;
    bool binning = parse_get_var(buf, "binning", 0) == 1;
    free(buf);
    sensor_t *s = camera_get_sensor();
    if (!s || s->set_res_raw(s, startX, startY, endX, endY, offsetX, offsetY,
                             totalX, totalY, outputX, outputY, scale, binning) != 0) {
        return httpd_resp_send_500(req);
    }
    httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
    return httpd_resp_send(req, NULL, 0);
}

// ========== Index HTML handler ==========
static esp_err_t index_handler(httpd_req_t *req) {
    httpd_resp_set_type(req, "text/html");
    httpd_resp_set_hdr(req, "Content-Encoding", "gzip");
    sensor_t *s = camera_get_sensor();
    if (!s) {
        log_e("Camera sensor not found");
        return httpd_resp_send_500(req);
    }
    if (s->id.PID == OV3660_PID) {
        return httpd_resp_send(req, (const char *)index_ov3660_html_gz, index_ov3660_html_gz_len);
    } else if (s->id.PID == OV5640_PID) {
        return httpd_resp_send(req, (const char *)index_ov5640_html_gz, index_ov5640_html_gz_len);
    } else {
        return httpd_resp_send(req, (const char *)index_ov2640_html_gz, index_ov2640_html_gz_len);
    }
}

// ========== Public server start ==========
void start_camera_server(void) {
    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.max_uri_handlers = 16;

    httpd_uri_t index_uri   = { .uri = "/", .method = HTTP_GET, .handler = index_handler };
    httpd_uri_t status_uri  = { .uri = "/status", .method = HTTP_GET, .handler = status_handler };
    httpd_uri_t cmd_uri     = { .uri = "/control", .method = HTTP_GET, .handler = cmd_handler };
    httpd_uri_t capture_uri = { .uri = "/capture", .method = HTTP_GET, .handler = capture_handler };
    httpd_uri_t stream_uri  = { .uri = "/stream", .method = HTTP_GET, .handler = stream_handler };
    httpd_uri_t bmp_uri     = { .uri = "/bmp", .method = HTTP_GET, .handler = bmp_handler };
    httpd_uri_t xclk_uri    = { .uri = "/xclk", .method = HTTP_GET, .handler = xclk_handler };
    httpd_uri_t reg_uri     = { .uri = "/reg", .method = HTTP_GET, .handler = reg_handler };
    httpd_uri_t greg_uri    = { .uri = "/greg", .method = HTTP_GET, .handler = greg_handler };
    httpd_uri_t pll_uri     = { .uri = "/pll", .method = HTTP_GET, .handler = pll_handler };
    httpd_uri_t win_uri     = { .uri = "/resolution", .method = HTTP_GET, .handler = win_handler };

    ra_filter_init(&ra_filter, 20);

    log_i("Starting web server on port: %d", config.server_port);
    if (httpd_start(&camera_httpd, &config) == ESP_OK) {
        httpd_register_uri_handler(camera_httpd, &index_uri);
        httpd_register_uri_handler(camera_httpd, &cmd_uri);
        httpd_register_uri_handler(camera_httpd, &status_uri);
        httpd_register_uri_handler(camera_httpd, &capture_uri);
        httpd_register_uri_handler(camera_httpd, &bmp_uri);
        httpd_register_uri_handler(camera_httpd, &xclk_uri);
        httpd_register_uri_handler(camera_httpd, &reg_uri);
        httpd_register_uri_handler(camera_httpd, &greg_uri);
        httpd_register_uri_handler(camera_httpd, &pll_uri);
        httpd_register_uri_handler(camera_httpd, &win_uri);
    }

    config.server_port += 1;
    config.ctrl_port += 1;
    log_i("Starting stream server on port: %d", config.server_port);
    if (httpd_start(&stream_httpd, &config) == ESP_OK) {
        httpd_register_uri_handler(stream_httpd, &stream_uri);
    }
}
