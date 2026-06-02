#include <WiFi.h>
#include <WebServer.h>
#include <DHT.h>
#include <ESP32Servo.h>
#include <esp_system.h>

#include <HTTPClient.h>
#include "config.h"

// ================= SERVER =================
WebServer server(SENSOR_HTTP_PORT);

// ================= OBJECTS =================
DHT dhtLiving(DHT_LIVING_PIN, DHT_TYPE);
DHT dhtBedroom(DHT_BEDROOM_PIN, DHT_TYPE);
Servo doorServo;

// ================= DEVICE STATE =================
bool wcLightState = false;
bool kitchenLightState = false;
bool bedroomLightState = false;
bool doorOpenState = false;
bool doorServoAttached = false;
bool indoorAlarmActive = false;
bool indoorAlarmEnabled = true;
bool gasAlarmActive = false;
bool temperatureAlarmActive = false;
bool humidityAlarmActive = false;
int gasAlarmThreshold = DEFAULT_GAS_ALARM_THRESHOLD;
float temperatureAlarmThreshold = DEFAULT_TEMPERATURE_ALARM_THRESHOLD;
float humidityAlarmThreshold = DEFAULT_HUMIDITY_ALARM_THRESHOLD;
unsigned long lastAlarmCheckMs = 0;
unsigned long frontDoorSpeakerAlertUntilMs = 0;
unsigned long lastBackendRegisterMs = 0;

void registerWithBackend() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi not connected, cannot register");
        return;
    }

    HTTPClient http;
    String url = "http://" + String(BACKEND_HOST) + ":" + String(BACKEND_PORT) + "/api/arduino/register/sensor";
    http.begin(url);
    http.addHeader("Content-Type", "application/json");

    // Create JSON payload with the sensor node's IP
    String payload = "{\"ip\":\"" + WiFi.localIP().toString() + "\", \"type\":\"sensor\"}";
    
    Serial.print("Registering sensor node at: ");
    Serial.println(url);
    Serial.print("Payload: ");
    Serial.println(payload);

    int httpCode = http.POST(payload);
    
    if (httpCode > 0) {
        if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
            Serial.println("✅ Sensor node registered successfully with backend");
        } else {
            Serial.printf("❌ Registration failed, HTTP code: %d\n", httpCode);
        }
    } else {
        Serial.printf("❌ Registration error: %s\n", http.errorToString(httpCode).c_str());
    }
    http.end();
    lastBackendRegisterMs = millis();
}

// ================= HELPER =================
void printResetReason() {
  esp_reset_reason_t reason = esp_reset_reason();
  Serial.print("ESP32 reset reason: ");
  Serial.println(static_cast<int>(reason));
}

void sendCORS() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

long readUltrasonicDistance(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);

  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH, 30000);

  if (duration == 0) {
    return -1;
  }

  long distance = duration * 0.034 / 2;
  return distance;
}

String jsonFloat(float value) {
  return isnan(value) ? "null" : String(value);
}

void setIndoorSpeakers(bool on) {
  indoorAlarmActive = on;
  digitalWrite(LOA_KHACH, on ? SPEAKER_ACTIVE_LEVEL : SPEAKER_INACTIVE_LEVEL);
  digitalWrite(LOA_NGU, on ? SPEAKER_ACTIVE_LEVEL : SPEAKER_INACTIVE_LEVEL);
}

void setFrontDoorSpeaker(bool on) {
  digitalWrite(LOA_TRUOC, on ? SPEAKER_ACTIVE_LEVEL : SPEAKER_INACTIVE_LEVEL);
}

void forceAllSpeakersOff() {
  pinMode(LOA_TRUOC, OUTPUT);
  pinMode(LOA_KHACH, OUTPUT);
  pinMode(LOA_NGU, OUTPUT);
  frontDoorSpeakerAlertUntilMs = 0;
  indoorAlarmActive = false;
  digitalWrite(LOA_TRUOC, SPEAKER_INACTIVE_LEVEL);
  digitalWrite(LOA_KHACH, SPEAKER_INACTIVE_LEVEL);
  digitalWrite(LOA_NGU, SPEAKER_INACTIVE_LEVEL);
}

void updateIndoorAlarm() {
  int gasValue = analogRead(GAS_PIN);
  float livingTemp = dhtLiving.readTemperature();
  float livingHum = dhtLiving.readHumidity();
  float bedroomTemp = dhtBedroom.readTemperature();
  float bedroomHum = dhtBedroom.readHumidity();

  gasAlarmActive = gasAlarmActive
    ? gasValue >= gasAlarmThreshold - GAS_ALARM_HYSTERESIS
    : gasValue > gasAlarmThreshold;
  temperatureAlarmActive = temperatureAlarmActive
    ? (!isnan(livingTemp) && livingTemp >= temperatureAlarmThreshold - TEMPERATURE_ALARM_HYSTERESIS) ||
      (!isnan(bedroomTemp) && bedroomTemp >= temperatureAlarmThreshold - TEMPERATURE_ALARM_HYSTERESIS)
    : (!isnan(livingTemp) && livingTemp > temperatureAlarmThreshold) ||
      (!isnan(bedroomTemp) && bedroomTemp > temperatureAlarmThreshold);
  humidityAlarmActive = humidityAlarmActive
    ? (!isnan(livingHum) && livingHum >= humidityAlarmThreshold - HUMIDITY_ALARM_HYSTERESIS) ||
      (!isnan(bedroomHum) && bedroomHum >= humidityAlarmThreshold - HUMIDITY_ALARM_HYSTERESIS)
    : (!isnan(livingHum) && livingHum > humidityAlarmThreshold) ||
      (!isnan(bedroomHum) && bedroomHum > humidityAlarmThreshold);

  setIndoorSpeakers(
    indoorAlarmEnabled &&
    (gasAlarmActive || temperatureAlarmActive || humidityAlarmActive)
  );

  bool frontDoorSpeakerAlertActive =
    frontDoorSpeakerAlertUntilMs != 0 && millis() < frontDoorSpeakerAlertUntilMs;
  setFrontDoorSpeaker(frontDoorSpeakerAlertActive);
}

void ensureDoorServoAttached() {
  if (doorServoAttached) {
    return;
  }

  ESP32PWM::allocateTimer(0);
  doorServo.setPeriodHertz(50);
  doorServo.attach(SERVO_PIN, 500, 2400);
  doorServo.write(doorOpenState ? 180 : 90);
  doorServoAttached = true;
  delay(200);
}

// ================= API HANDLERS =================

// Test server
void handleRoot() {
  sendCORS();
  server.send(200, "application/json", "{\"message\":\"ESP32 Sensor Node is running\"}");
}

// GET /api/sensors
void handleSensors() {
  sendCORS();

  float livingTemp = dhtLiving.readTemperature();
  float livingHum = dhtLiving.readHumidity();

  float bedroomTemp = dhtBedroom.readTemperature();
  float bedroomHum = dhtBedroom.readHumidity();

  int gasValue = analogRead(GAS_PIN);

  long kitchenDistance = readUltrasonicDistance(TRIG_KITCHEN_PIN, ECHO_KITCHEN_PIN);
  long wcDistance = readUltrasonicDistance(TRIG_WC_PIN, ECHO_WC_PIN);

  String json = "{";

  json += "\"livingRoom\":{";
  json += "\"temperature\":" + jsonFloat(livingTemp) + ",";
  json += "\"humidity\":" + jsonFloat(livingHum);
  json += "},";

  json += "\"bedroom\":{";
  json += "\"temperature\":" + jsonFloat(bedroomTemp) + ",";
  json += "\"humidity\":" + jsonFloat(bedroomHum);
  json += "},";

  json += "\"kitchen\":{";
  json += "\"distance\":" + String(kitchenDistance);
  json += "},";

  json += "\"wc\":{";
  json += "\"distance\":" + String(wcDistance);
  json += "},";

  json += "\"gas\":";
  json += gasValue;

  json += "}";

  server.send(200, "application/json", json);
}

// GET /api/devices
void handleDevices() {
  sendCORS();

  String json = "{";
  json += "\"wcLight\":" + String(wcLightState ? "true" : "false") + ",";
  json += "\"kitchenLight\":" + String(kitchenLightState ? "true" : "false") + ",";
  json += "\"bedroomLight\":" + String(bedroomLightState ? "true" : "false") + ",";
  json += "\"doorOpen\":" + String(doorOpenState ? "true" : "false") + ",";
  json += "\"livingRoomSpeaker\":" + String(indoorAlarmActive ? "true" : "false") + ",";
  json += "\"bedroomSpeaker\":" + String(indoorAlarmActive ? "true" : "false") + ",";
  json += "\"indoorAlarmActive\":" + String(indoorAlarmActive ? "true" : "false") + ",";
  json += "\"alarmTriggers\":{";
  json += "\"gas\":" + String(gasAlarmActive ? "true" : "false") + ",";
  json += "\"temperature\":" + String(temperatureAlarmActive ? "true" : "false") + ",";
  json += "\"humidity\":" + String(humidityAlarmActive ? "true" : "false");
  json += "}";
  json += "}";

  server.send(200, "application/json", json);
}

// WC light
void handleWcLightOn() {
  sendCORS();
  wcLightState = true;
  digitalWrite(LED_WC_PIN, HIGH);
  server.send(200, "application/json", "{\"success\":true,\"wcLight\":true}");
}

void handleWcLightOff() {
  sendCORS();
  wcLightState = false;
  digitalWrite(LED_WC_PIN, LOW);
  server.send(200, "application/json", "{\"success\":true,\"wcLight\":false}");
}

// Kitchen light
void handleKitchenLightOn() {
  sendCORS();
  kitchenLightState = true;
  digitalWrite(LED_KITCHEN_PIN, HIGH);
  server.send(200, "application/json", "{\"success\":true,\"kitchenLight\":true}");
}

void handleKitchenLightOff() {
  sendCORS();
  kitchenLightState = false;
  digitalWrite(LED_KITCHEN_PIN, LOW);
  server.send(200, "application/json", "{\"success\":true,\"kitchenLight\":false}");
}

// Bedroom light
void handleBedroomLightOn() {
  sendCORS();
  bedroomLightState = true;
  digitalWrite(LED_BEDROOM_PIN, HIGH);
  server.send(200, "application/json", "{\"success\":true,\"bedroomLight\":true}");
}

void handleBedroomLightOff() {
  sendCORS();
  bedroomLightState = false;
  digitalWrite(LED_BEDROOM_PIN, LOW);
  server.send(200, "application/json", "{\"success\":true,\"bedroomLight\":false}");
}

void handleDoorOpen() {
  sendCORS();
  ensureDoorServoAttached();

  // quay từ 90 -> 180 chậm
  for (int pos = 90; pos <= 180; pos++) {
    doorServo.write(pos);
    delay(20); // càng lớn thì quay càng chậm
  }

  doorOpenState = true;
  server.send(200, "application/json", "{\"success\":true,\"doorOpen\":true}");
}

void handleDoorClose() {
  sendCORS();
  ensureDoorServoAttached();

  // quay từ 180 -> 90 doorServo.write(90); 
  for (int pos = 180; pos >= 90; pos--) {
    doorServo.write(pos);
    delay(20); // càng lớn thì quay càng chậm
  }

  doorOpenState = false;
  server.send(200, "application/json", "{\"success\":true,\"doorOpen\":false}");
}

void handleSpeakerSettings() {
  sendCORS();

  String json = "{";
  json += "\"enabled\":" + String(indoorAlarmEnabled ? "true" : "false") + ",";
  json += "\"gasThreshold\":" + String(gasAlarmThreshold) + ",";
  json += "\"temperatureThreshold\":" + String(temperatureAlarmThreshold) + ",";
  json += "\"humidityThreshold\":" + String(humidityAlarmThreshold) + ",";
  json += "\"indoorAlarmActive\":" + String(indoorAlarmActive ? "true" : "false") + ",";
  json += "\"alarmTriggers\":{";
  json += "\"gas\":" + String(gasAlarmActive ? "true" : "false") + ",";
  json += "\"temperature\":" + String(temperatureAlarmActive ? "true" : "false") + ",";
  json += "\"humidity\":" + String(humidityAlarmActive ? "true" : "false");
  json += "}";
  json += "}";

  server.send(200, "application/json", json);
}

void handleSpeakerSettingsUpdate() {
  sendCORS();

  if (!server.hasArg("enabled") || !server.hasArg("gas") ||
      !server.hasArg("temperature") || !server.hasArg("humidity")) {
    server.send(400, "application/json", "{\"error\":\"Missing speaker settings\"}");
    return;
  }

  int newGasThreshold = server.arg("gas").toInt();
  float newTemperatureThreshold = server.arg("temperature").toFloat();
  float newHumidityThreshold = server.arg("humidity").toFloat();

  if (newGasThreshold < 0 || newTemperatureThreshold <= 0 || newHumidityThreshold <= 0) {
    server.send(400, "application/json", "{\"error\":\"Invalid speaker thresholds\"}");
    return;
  }

  indoorAlarmEnabled = server.arg("enabled") == "true";
  gasAlarmThreshold = newGasThreshold;
  temperatureAlarmThreshold = newTemperatureThreshold;
  humidityAlarmThreshold = newHumidityThreshold;
  updateIndoorAlarm();
  handleSpeakerSettings();
}

void handleSpeakerAlert() {
  sendCORS();
  frontDoorSpeakerAlertUntilMs = millis() + SPEAKER_ALERT_DURATION_MS;
  updateIndoorAlarm();
  server.send(200, "application/json", "{\"success\":true,\"frontDoorSpeakerAlert\":true}");
}

// ================= SETUP =================
void setup() {
  Serial.begin(115200);
  delay(100);
  printResetReason();
  forceAllSpeakersOff();

  // DHT
  dhtLiving.begin();
  dhtBedroom.begin();

  // Đèn
  pinMode(LED_WC_PIN, OUTPUT);
  pinMode(LED_KITCHEN_PIN, OUTPUT);
  pinMode(LED_BEDROOM_PIN, OUTPUT);

  digitalWrite(LED_WC_PIN, LOW);
  digitalWrite(LED_KITCHEN_PIN, LOW);
  digitalWrite(LED_BEDROOM_PIN, LOW);

  // Siêu âm
  pinMode(TRIG_KITCHEN_PIN, OUTPUT);
  pinMode(ECHO_KITCHEN_PIN, INPUT);

  pinMode(TRIG_WC_PIN, OUTPUT);
  pinMode(ECHO_WC_PIN, INPUT);

  // Gas
  pinMode(GAS_PIN, INPUT);

  // Speakers stay off after upload/reset until an alarm is triggered.
  forceAllSpeakersOff();

  // WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.println("WiFi connected");
  Serial.print("ESP32 Sensor API: http://");
  Serial.println(WiFi.localIP());

  registerWithBackend();

  // Routes
  server.on("/", HTTP_GET, handleRoot);

  server.on("/api/sensors", HTTP_GET, handleSensors);
  server.on("/api/devices", HTTP_GET, handleDevices);

  server.on("/api/light/wc/on", HTTP_GET, handleWcLightOn);
  server.on("/api/light/wc/off", HTTP_GET, handleWcLightOff);

  server.on("/api/light/kitchen/on", HTTP_GET, handleKitchenLightOn);
  server.on("/api/light/kitchen/off", HTTP_GET, handleKitchenLightOff);

  server.on("/api/light/bedroom/on", HTTP_GET, handleBedroomLightOn);
  server.on("/api/light/bedroom/off", HTTP_GET, handleBedroomLightOff);

  server.on("/api/door/open", HTTP_GET, handleDoorOpen);
  server.on("/api/door/close", HTTP_GET, handleDoorClose);

  server.on("/api/speaker/settings", HTTP_GET, handleSpeakerSettings);
  server.on("/api/speaker/settings/update", HTTP_GET, handleSpeakerSettingsUpdate);
  server.on("/api/speaker/alert", HTTP_GET, handleSpeakerAlert);

  server.begin();
  Serial.println("HTTP server started");
}

// ================= LOOP =================
void loop() {
  server.handleClient();

  if (WiFi.status() == WL_CONNECTED &&
      millis() - lastBackendRegisterMs >= BACKEND_REGISTER_INTERVAL_MS) {
    registerWithBackend();
  }

  unsigned long now = millis();
  if (now - lastAlarmCheckMs >= ALARM_CHECK_INTERVAL_MS) {
    lastAlarmCheckMs = now;
    updateIndoorAlarm();
  }
}
