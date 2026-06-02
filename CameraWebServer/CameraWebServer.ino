#include <WiFi.h>
#include "config.h"
#include "camera_hal.h"
#include "led_control.h"
#include "http_server.h"
#include <HTTPClient.h>

unsigned long lastBackendRegisterMs = 0;

void registerCameraWithBackend() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("Camera register skipped: WiFi not connected");
        return;
    }

    HTTPClient http;
    String url =
        "http://" + String(BACKEND_HOST) + ":" + String(BACKEND_PORT) +
        "/api/arduino/register/camera";
    String body = "{\"ip\":\"" + WiFi.localIP().toString() + "\"}";

    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    int responseCode = http.POST(body);
    Serial.print("Camera Register Response: ");
    Serial.println(responseCode);
    Serial.println(http.getString());

    http.end();
    lastBackendRegisterMs = millis();
}

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
    String ip = WiFi.localIP().toString();
    Serial.println(ip);

    registerCameraWithBackend();
    Serial.println(WiFi.localIP());

    // Start HTTP servers
    start_camera_server();
}

void loop() {
    // Nothing here – everything is handled by the web server
    // If you need periodic tasks, add them here
    if (WiFi.status() == WL_CONNECTED &&
        millis() - lastBackendRegisterMs >= BACKEND_REGISTER_INTERVAL_MS) {
        registerCameraWithBackend();
    }
    delay(10);
}
