#include "image_utils.h"
#include "img_converters.h"
#include <stdlib.h>

bool frame_to_jpeg(const camera_fb_t *fb, uint8_t **out_buf, size_t *out_len, int quality) {
    if (!fb || !out_buf || !out_len) return false;
    return frame2jpg(fb, quality, out_buf, out_len);
}

bool frame_to_bmp(const camera_fb_t *fb, uint8_t **out_buf, size_t *out_len) {
    if (!fb || !out_buf || !out_len) return false;
    return frame2bmp(fb, out_buf, out_len);
}

void free_image_buf(uint8_t *buf) {
    free(buf);
}
