#include "led_control.h"
#include "config.h"
#include "esp32-hal-ledc.h"
#include "board_config.h"  // for LED_GPIO_NUM

#if defined(LED_GPIO_NUM)
static int led_duty = 0;
static bool is_streaming = false;

// in led_control.c
int led_get_duty(void) {
    return led_duty;
}

void led_init(void) {
    ledcAttach(LED_GPIO_NUM, 5000, 8);
    ledcWrite(LED_GPIO_NUM, 0);
}

void led_set_intensity(int duty) {
    led_duty = duty;
    if (is_streaming) led_enable(true);
}

void led_enable(bool on) {
    int duty = on ? led_duty : 0;
    if (on && is_streaming && led_duty > CONFIG_LED_MAX_INTENSITY)
        duty = CONFIG_LED_MAX_INTENSITY;
    ledcWrite(LED_GPIO_NUM, duty);
}

void led_stream_begin(void) {
    is_streaming = true;
    led_enable(true);
}

void led_stream_end(void) {
    is_streaming = false;
    led_enable(false);
}

#else   // LED_GPIO_NUM not defined

void led_init(void) {}
void led_set_intensity(int duty) { (void)duty; }
void led_enable(bool on) { (void)on; }
void led_stream_begin(void) {}
void led_stream_end(void) {}

#endif
