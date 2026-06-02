#include <WiFi.h>
#include <WebServer.h>
#include <DHT.h>
#include <ESP32Servo.h>
#include <esp_system.h>

#include <HTTPClient.h>

// ================= BACKEND REGISTRATION =================
const char* backendHost = "172.20.10.8";   // Replace with your Flask server's IP address
const int backendPort = 5001;

// ================= WIFI CONFIG =================
const char* ssid = "Eastern";
const char* password = "eastern123";

// ================= SERVER =================
WebServer server(80);

// ================= PIN CONFIG =================
// Đèn
#define LED_WC_PIN        18
#define LED_KITCHEN_PIN   17   // TX2 = GPIO17
#define LED_BEDROOM_PIN   16   // RX2 = GPIO16

// Siêu âm phòng bếp
#define TRIG_KITCHEN_PIN  5
#define ECHO_KITCHEN_PIN  19

// Siêu âm phòng WC
#define TRIG_WC_PIN       21
#define ECHO_WC_PIN       22

// DHT
#define DHT_LIVING_PIN    23
#define DHT_BEDROOM_PIN   25
#define DHT_TYPE          DHT11   // Nếu bạn dùng DHT22 thì đổi thành DHT22

// Gas
#define GAS_PIN           32

// Servo
#define SERVO_PIN         26

// Front-door stranger alert speaker.
#define LOA_TRUOC         27

// Indoor alarm speakers.
#define LOA_KHACH         14
#define LOA_NGU           13

// Speaker sine-wave PWM config.
#define SPEAKER_PWM_FREQ       20000
#define SPEAKER_PWM_RESOLUTION 8
#define SPEAKER_FRONT_CHANNEL  4
#define SPEAKER_KHACH_CHANNEL  5
#define SPEAKER_NGU_CHANNEL    6
#define SINE_SAMPLE_COUNT      32

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
int gasAlarmThreshold = 500;
float temperatureAlarmThreshold = 35.0;
float humidityAlarmThreshold = 80.0;
const int GAS_ALARM_HYSTERESIS = 50;
const float TEMPERATURE_ALARM_HYSTERESIS = 1.0;
const float HUMIDITY_ALARM_HYSTERESIS = 3.0;
unsigned long lastAlarmCheckMs = 0;
const unsigned long ALARM_CHECK_INTERVAL_MS = 2500;
unsigned long lastBackendRegisterMs = 0;
const unsigned long BACKEND_REGISTER_INTERVAL_MS = 30000;
unsigned long frontDoorSpeakerAlertUntilMs = 0;
unsigned long speakerAlertDurationMs = 5000;
int frontDoorSpeakerVolume = 80;
int indoorSpeakerVolume = 60;
int speakerSineFrequency = 880;
bool speakersPwmReady = false;
unsigned long lastSineUpdateUs = 0;
uint8_t sineIndex = 0;
const uint8_t SINE_TABLE[SINE_SAMPLE_COUNT] = {
  128, 152, 176, 198, 218, 234, 245, 253,
  255, 253, 245, 234, 218, 198, 176, 152,
  128, 103, 79, 57, 37, 21, 10, 2,
  0, 2, 10, 21, 37, 57, 79, 103
};

void registerWithBackend() {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("WiFi not connected, cannot register");
        return;
    }

    HTTPClient http;
    String url = "http://" + String(backendHost) + ":" + String(backendPort) + "/api/arduino/register/sensor";
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
  Serial.print(static_cast<int>(reason));

  switch (reason) {
    case ESP_RST_POWERON:
      Serial.println(" (power-on reset)");
      break;
    case ESP_RST_SW:
      Serial.println(" (software reset)");
      break;
    case ESP_RST_PANIC:
      Serial.println(" (software panic)");
      break;
    case ESP_RST_INT_WDT:
    case ESP_RST_TASK_WDT:
    case ESP_RST_WDT:
      Serial.println(" (watchdog reset)");
      break;
    case ESP_RST_BROWNOUT:
      Serial.println(" (brownout: supply voltage dropped)");
      break;
    default:
      Serial.println();
      break;
  }
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

void configureSpeakerPwm() {
  if (speakersPwmReady) {
    return;
  }
  ledcSetup(SPEAKER_FRONT_CHANNEL, SPEAKER_PWM_FREQ, SPEAKER_PWM_RESOLUTION);
  ledcSetup(SPEAKER_KHACH_CHANNEL, SPEAKER_PWM_FREQ, SPEAKER_PWM_RESOLUTION);
  ledcSetup(SPEAKER_NGU_CHANNEL, SPEAKER_PWM_FREQ, SPEAKER_PWM_RESOLUTION);
  ledcAttachPin(LOA_TRUOC, SPEAKER_FRONT_CHANNEL);
  ledcAttachPin(LOA_KHACH, SPEAKER_KHACH_CHANNEL);
  ledcAttachPin(LOA_NGU, SPEAKER_NGU_CHANNEL);
  speakersPwmReady = true;
}

int sineDutyForVolume(int volume) {
  int centered = static_cast<int>(SINE_TABLE[sineIndex]) - 128;
  int scaled = 128 + (centered * constrain(volume, 0, 100)) / 100;
  return constrain(scaled, 0, 255);
}

void writeSpeakerSine(bool frontActive, bool indoorActive) {
  configureSpeakerPwm();
  ledcWrite(SPEAKER_FRONT_CHANNEL, frontActive ? sineDutyForVolume(frontDoorSpeakerVolume) : 0);
  ledcWrite(SPEAKER_KHACH_CHANNEL, indoorActive ? sineDutyForVolume(indoorSpeakerVolume) : 0);
  ledcWrite(SPEAKER_NGU_CHANNEL, indoorActive ? sineDutyForVolume(indoorSpeakerVolume) : 0);
}

void updateSpeakerWaveforms() {
  configureSpeakerPwm();
  bool frontActive =
    frontDoorSpeakerAlertUntilMs != 0 && millis() < frontDoorSpeakerAlertUntilMs;
  bool indoorActive = indoorAlarmActive;

  if (!frontActive && !indoorActive) {
    writeSpeakerSine(false, false);
    return;
  }

  unsigned long intervalUs =
    1000000UL / max(1, speakerSineFrequency * SINE_SAMPLE_COUNT);
  unsigned long nowUs = micros();
  if (nowUs - lastSineUpdateUs >= intervalUs) {
    lastSineUpdateUs = nowUs;
    sineIndex = (sineIndex + 1) % SINE_SAMPLE_COUNT;
    writeSpeakerSine(frontActive, indoorActive);
  }
}

void setIndoorSpeakers(bool on) {
  indoorAlarmActive = on;
  updateSpeakerWaveforms();
}

void setFrontDoorSpeaker(bool on) {
  frontDoorSpeakerAlertUntilMs = on ? millis() + speakerAlertDurationMs : 0;
  updateSpeakerWaveforms();
}

void forceAllSpeakersOff() {
  configureSpeakerPwm();
  frontDoorSpeakerAlertUntilMs = 0;
  indoorAlarmActive = false;
  ledcWrite(SPEAKER_FRONT_CHANNEL, 0);
  ledcWrite(SPEAKER_KHACH_CHANNEL, 0);
  ledcWrite(SPEAKER_NGU_CHANNEL, 0);
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

// GET /api/speaker/settings
void handleSpeakerSettings() {
  sendCORS();

  String json = "{";
  json += "\"enabled\":" + String(indoorAlarmEnabled ? "true" : "false") + ",";
  json += "\"gasThreshold\":" + String(gasAlarmThreshold) + ",";
  json += "\"temperatureThreshold\":" + String(temperatureAlarmThreshold) + ",";
  json += "\"humidityThreshold\":" + String(humidityAlarmThreshold) + ",";
  json += "\"frontDoorVolume\":" + String(frontDoorSpeakerVolume) + ",";
  json += "\"indoorVolume\":" + String(indoorSpeakerVolume) + ",";
  json += "\"sineFrequency\":" + String(speakerSineFrequency) + ",";
  json += "\"alertDurationMs\":" + String(speakerAlertDurationMs) + ",";
  json += "\"waveform\":\"sine\",";
  json += "\"indoorAlarmActive\":" + String(indoorAlarmActive ? "true" : "false") + ",";
  json += "\"alarmTriggers\":{";
  json += "\"gas\":" + String(gasAlarmActive ? "true" : "false") + ",";
  json += "\"temperature\":" + String(temperatureAlarmActive ? "true" : "false") + ",";
  json += "\"humidity\":" + String(humidityAlarmActive ? "true" : "false");
  json += "}";
  json += "}";

  server.send(200, "application/json", json);
}

// GET /api/speaker/settings/update?enabled=true&gas=500&temperature=35&humidity=80
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

// GET /api/speaker/alert
void handleSpeakerAlert() {
  sendCORS();
  frontDoorSpeakerAlertUntilMs = millis() + speakerAlertDurationMs;
  updateIndoorAlarm();
  server.send(200, "application/json", "{\"success\":true,\"frontDoorSpeakerAlert\":true}");
}

// GET /api/speaker/audio/update?frontVolume=80&indoorVolume=60&frequency=880&duration=5000
void handleSpeakerAudioUpdate() {
  sendCORS();

  if (server.hasArg("frontVolume")) {
    frontDoorSpeakerVolume = constrain(server.arg("frontVolume").toInt(), 0, 100);
  }
  if (server.hasArg("indoorVolume")) {
    indoorSpeakerVolume = constrain(server.arg("indoorVolume").toInt(), 0, 100);
  }
  if (server.hasArg("frequency")) {
    speakerSineFrequency = constrain(server.arg("frequency").toInt(), 100, 3000);
  }
  if (server.hasArg("duration")) {
    speakerAlertDurationMs = constrain(server.arg("duration").toInt(), 500, 30000);
  }

  handleSpeakerSettings();
}

// GET /api/speaker/test?target=front|indoor
void handleSpeakerTest() {
  sendCORS();
  String target = server.arg("target");
  if (target == "indoor") {
    indoorAlarmActive = true;
    unsigned long stopAt = millis() + speakerAlertDurationMs;
    while (millis() < stopAt) {
      updateSpeakerWaveforms();
      delay(1);
    }
    indoorAlarmActive = false;
    forceAllSpeakersOff();
  } else {
    frontDoorSpeakerAlertUntilMs = millis() + speakerAlertDurationMs;
    unsigned long stopAt = frontDoorSpeakerAlertUntilMs;
    while (millis() < stopAt) {
      updateSpeakerWaveforms();
      delay(1);
    }
    forceAllSpeakersOff();
  }
  server.send(200, "application/json", "{\"success\":true,\"waveform\":\"sine\"}");
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

  // Den
  pinMode(LED_WC_PIN, OUTPUT);
  pinMode(LED_KITCHEN_PIN, OUTPUT);
  pinMode(LED_BEDROOM_PIN, OUTPUT);

  digitalWrite(LED_WC_PIN, LOW);
  digitalWrite(LED_KITCHEN_PIN, LOW);
  digitalWrite(LED_BEDROOM_PIN, LOW);

  // Sieu am
  pinMode(TRIG_KITCHEN_PIN, OUTPUT);
  pinMode(ECHO_KITCHEN_PIN, INPUT);

  pinMode(TRIG_WC_PIN, OUTPUT);
  pinMode(ECHO_WC_PIN, INPUT);

  // Gas
  pinMode(GAS_PIN, INPUT);

  // Speakers stay off after upload/reset until an alarm is triggered.
  forceAllSpeakersOff();

  // WiFi
  WiFi.begin(ssid, password);
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
  forceAllSpeakersOff();

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
