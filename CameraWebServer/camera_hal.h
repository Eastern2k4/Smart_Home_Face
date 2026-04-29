#ifndef CAMERA_HAL_H
#define CAMERA_HAL_H

#include "esp_camera.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Initialise the camera with given configuration.
 * Returns true on success.
 */
bool camera_init(void);

/**
 * Capture a frame. Caller must free with camera_free_frame().
 * Returns NULL on failure.
 */
camera_fb_t* camera_capture(void);

/**
 * Return a frame buffer to the driver.
 */
void camera_free_frame(camera_fb_t *fb);

/**
 * Get sensor pointer for low‑level control.
 */
sensor_t* camera_get_sensor(void);

/**
 * Set a camera parameter by name (used by /control endpoint).
 * Returns 0 on success, negative on error.
 */
int camera_set_parameter(const char *var, int val);

/**
 * Get current parameter value (used for status).
 */
int camera_get_parameter(const char *var);

#ifdef __cplusplus
}
#endif

#endif // CAMERA_HAL_H
