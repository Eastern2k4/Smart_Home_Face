#include <WiFi.h>
#include "config.h"
#include "camera_hal.h"
#include "led_control.h"
#include "http_server.h"
#include <HTTPClient.h>

// WiFi credentials (must match the extern in config.h)
const char* WIFI_SSID = "TRAM 247 STUDY CAFE & WORKSPACE";
const char* WIFI_PASSWORD = "tramloveyou";
const char* BACKEND_HOST = "172.16.2.113";
const int BACKEND_PORT = 5001;

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

HTTPClient http;

http.begin(
  "http://" + String(BACKEND_HOST) + ":" + String(BACKEND_PORT) + "/api/arduino/register/camera"
);

http.addHeader(
  "Content-Type",
  "application/json"
);

String body = "{";

body += "\"ip\":\"" + ip + "\"";

body += "}";

int responseCode =
  http.POST(body);

Serial.print("Register Response: ");
Serial.println(responseCode);

String response =
  http.getString();

Serial.println(response);

http.end();
    Serial.println(WiFi.localIP());

    // Start HTTP servers
    start_camera_server();
}

void loop() {
    // Nothing here – everything is handled by the web server
    // If you need periodic tasks, add them here
    delay(10);
}
