#ifndef SENSOR_NODE_CONFIG_GENERATED_H
#define SENSOR_NODE_CONFIG_GENERATED_H

// Example only. src.app generates config.generated.h on backend startup.
static const char* const WIFI_SSID = "YOUR_WIFI";
static const char* const WIFI_PASSWORD = "YOUR_PASSWORD";
static const char* const BACKEND_HOST = "192.168.1.100";
static const int BACKEND_PORT = 8000;
static const unsigned long BACKEND_REGISTER_INTERVAL_MS = 30000;
static const int SENSOR_HTTP_PORT = 80;
static const unsigned long ALARM_CHECK_INTERVAL_MS = 2500;
static const unsigned long SPEAKER_ALERT_DURATION_MS = 5000;

#endif // SENSOR_NODE_CONFIG_GENERATED_H
