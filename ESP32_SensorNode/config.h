#ifndef SENSOR_NODE_CONFIG_H
#define SENSOR_NODE_CONFIG_H

#include <DHT.h>

// WiFi/backend/timing configuration is generated from config/app*.json.
#if __has_include("config.generated.h")
#include "config.generated.h"
#else
#include "config.generated.example.h"
#endif

// Light pins
#define LED_WC_PIN        18
#define LED_KITCHEN_PIN   17
#define LED_BEDROOM_PIN   16

// Ultrasonic sensor pins
#define TRIG_KITCHEN_PIN  5
#define ECHO_KITCHEN_PIN  19
#define TRIG_WC_PIN       21
#define ECHO_WC_PIN       22

// DHT sensors
#define DHT_LIVING_PIN    23
#define DHT_BEDROOM_PIN   25
#define DHT_TYPE          DHT11

// Gas sensor
#define GAS_PIN           32

// Door servo
#define SERVO_PIN         26

// Speaker pins and levels
#define LOA_TRUOC         27
#define LOA_KHACH         14
#define LOA_NGU           13
#define FRONT_DOOR_SPEAKER_PIN LOA_TRUOC
#define HOUSE_GAS_SPEAKER_PIN  LOA_KHACH
#define HOUSE_ENV_SPEAKER_SECONDARY_PIN LOA_NGU
#define SPEAKER_ACTIVE_LEVEL   HIGH
#define SPEAKER_INACTIVE_LEVEL LOW

// Alarm defaults
static const int DEFAULT_GAS_ALARM_THRESHOLD = 500;
static const float DEFAULT_TEMPERATURE_ALARM_THRESHOLD = 35.0;
static const float DEFAULT_HUMIDITY_ALARM_THRESHOLD = 80.0;
static const int GAS_ALARM_HYSTERESIS = 50;
static const float TEMPERATURE_ALARM_HYSTERESIS = 1.0;
static const float HUMIDITY_ALARM_HYSTERESIS = 3.0;

#endif // SENSOR_NODE_CONFIG_H
