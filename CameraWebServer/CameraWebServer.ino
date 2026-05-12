#include <WiFi.h>
#include "config.h"
#include "camera_hal.h"
#include "led_control.h"
#include "http_server.h"
#include <HTTPClient.h>

// WiFi credentials (must match the extern in config.h)
const char* WIFI_SSID = "67676767";
const char* WIFI_PASSWORD = "67676767";

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

String streamUrl =
  "http://" + ip + ":81/stream";

String captureUrl =
  "http://" + ip + "/capture";

HTTPClient http;

http.begin(
  "http://10.133.233.165:5001/register-device"
);

http.addHeader(
  "Content-Type",
  "application/json"
);

String body = "{";

body += "\"device_id\":\"esp32cam01\",";
body += "\"stream_url\":\"" + streamUrl + "\",";
body += "\"capture_url\":\"" + captureUrl + "\"";

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
