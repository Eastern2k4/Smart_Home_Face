#include <WiFi.h>
#include "config.h"
#include "camera_hal.h"
#include "led_control.h"
#include "http_server.h"

// WiFi credentials (must match the extern in config.h)
const char* WIFI_SSID = "TRAM 247 STUDY CAFE & WORKSPACE";
const char* WIFI_PASSWORD = "tramloveyou";

void setup() {
    Serial.begin(9600);
    Serial.setDebugOutput(true);
    Serial.println();

    // Initialise camera
    if (!camera_init()) {
        Serial.println("Camera init failed");
        return;
    }
    Serial.println("Camera initialised");

    // Initialise LED flash (if present)
    led_init();

    // Connect to WiFi
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    WiFi.setSleep(false);
    Serial.print("Connecting to WiFi");
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.println("\nWiFi connected");
    Serial.print("Camera ready! Connect to http://");
    Serial.println(WiFi.localIP());

    // Start HTTP servers
    start_camera_server();
}

void loop() {
    // Nothing here – everything is handled by the web server
    // If you need periodic tasks, add them here
    delay(10);
}
