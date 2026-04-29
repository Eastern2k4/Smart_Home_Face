#ifndef IMAGE_UTILS_H
#define IMAGE_UTILS_H

#include <stddef.h>
#include <stdbool.h>
#include "esp_camera.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Convert frame to JPEG buffer (allocated).
 * Returns true on success. Caller must free*buf.
 */
bool frame_to_jpeg(const camera_fb_t *fb, uint8_t **out_buf, size_t *out_len, int quality);

/**
 * Convert frame to BMP buffer (allocated).
 * Returns true on success. Caller must free*buf.
 */
bool frame_to_bmp(const camera_fb_t *fb, uint8_t **out_buf, size_t *out_len);

/**
 * Free buffer allocated by the above functions.
 */
void free_image_buf(uint8_t *buf);

#ifdef __cplusplus
}
#endif

#endif // IMAGE_UTILS_H
