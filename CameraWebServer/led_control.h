#ifndef LED_CONTROL_H
#define LED_CONTROL_H

#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif
int led_get_duty(void);
void led_init(void);
void led_set_intensity(int duty);
void led_enable(bool on);
void led_stream_begin(void);
void led_stream_end(void);

#ifdef __cplusplus
}
#endif

#endif // LED_CONTROL_H
