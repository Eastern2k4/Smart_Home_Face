#include <WiFi.h>
#include <WebServer.h>
#include <DHT.h>
#include <ESP32Servo.h>
#include <esp_system.h>

#include "config.h"
#include <HTTPClient.h>
#if __has_include("config.generated.h")
#include "config.generated.h"
#else
#include "config.generated.example.h"
#endif

// ================= SERVER =================
WebServer server(SENSOR_HTTP_PORT);

// ================= PIN CONFIG =================
#define LED_WC_PIN        18
#define LED_KITCHEN_PIN   17
#define LED_BEDROOM_PIN   16
#define TRIG_KITCHEN_PIN  5
#define ECHO_KITCHEN_PIN  19
#define TRIG_WC_PIN       21
#define ECHO_WC_PIN       22
#define DHT_LIVING_PIN    23
#define DHT_BEDROOM_PIN   25
#define DHT_TYPE          DHT11
#define GAS_PIN           32
#define SERVO_PIN         26
#define LOA_TRUOC         27
#define LOA_KHACH         14
#define LOA_NGU           13
#define FRONT_DOOR_SPEAKER_PIN LOA_TRUOC
#define HOUSE_GAS_SPEAKER_PIN  LOA_KHACH
#define HOUSE_ENV_SPEAKER_SECONDARY_PIN LOA_NGU

// Speaker sine-wave PWM config.
#define SPEAKER_PWM_FREQ       20000
#define SPEAKER_PWM_RESOLUTION 8
#define SINE_SAMPLE_COUNT      32

// ================= OBJECTS =================
DHT dhtLiving(DHT_LIVING_PIN, DHT_TYPE);
DHT dhtBedroom(DHT_BEDROOM_PIN, DHT_TYPE);
Servo doorServo;

struct SpeakerChannel {
  const char* id;
  int pin;
  int volume;
  int frequency;
  bool active;
  const char* reason;
  unsigned long activeUntilMs;
};

// ================= DEVICE STATE =================
bool wcLightState = false;
bool kitchenLightState = false;
bool bedroomLightState = false;
bool doorOpenState = false;
bool doorServoAttached = false;
bool speakerAlarmEnabled = true;
bool gasAlarmActive = false;
bool temperatureAlarmActive = false;
bool humidityAlarmActive = false;
int gasAlarmThreshold = DEFAULT_GAS_ALARM_THRESHOLD;
float temperatureAlarmThreshold = DEFAULT_TEMPERATURE_ALARM_THRESHOLD;
float humidityAlarmThreshold = DEFAULT_HUMIDITY_ALARM_THRESHOLD;
unsigned long lastAlarmCheckMs = 0;
unsigned long lastBackendRegisterMs = 0;
unsigned long speakerAlertDurationMs = SPEAKER_ALERT_DURATION_MS;
SpeakerChannel frontDoorSpeaker = {
  "front_door",
  FRONT_DOOR_SPEAKER_PIN,
  80,
  880,
  false,
  nullptr,
  0
};
SpeakerChannel houseGasSpeaker = {
  "house_gas",
  HOUSE_GAS_SPEAKER_PIN,
  75,
  1200,
  false,
  nullptr,
  0
};
bool speakersPwmReady = false;
unsigned long lastFrontDoorSineUpdateUs = 0;
unsigned long lastHouseGasSineUpdateUs = 0;
uint8_t frontDoorSineIndex = 0;
uint8_t houseGasSineIndex = 0;
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

String jsonReason(const char* reason) {
  return reason == nullptr ? "null" : "\"" + String(reason) + "\"";
}

void configureSpeakerPwm() {
  if (speakersPwmReady) {
    return;
  }
  ledcAttach(frontDoorSpeaker.pin, SPEAKER_PWM_FREQ, SPEAKER_PWM_RESOLUTION);
  ledcAttach(houseGasSpeaker.pin, SPEAKER_PWM_FREQ, SPEAKER_PWM_RESOLUTION);
  ledcAttach(HOUSE_ENV_SPEAKER_SECONDARY_PIN, SPEAKER_PWM_FREQ, SPEAKER_PWM_RESOLUTION);
  speakersPwmReady = true;
}

int sineDutyForVolume(int volume, uint8_t sineIndex) {
  int centered = static_cast<int>(SINE_TABLE[sineIndex]) - 128;
  int scaled = 128 + (centered * constrain(volume, 0, 100)) / 100;
  return constrain(scaled, 0, 255);
}

bool speakerIsActive(SpeakerChannel &channel) {
  if (channel.activeUntilMs != 0 && millis() >= channel.activeUntilMs) {
    channel.active = false;
    channel.reason = nullptr;
    channel.activeUntilMs = 0;
  }
  return channel.active;
}

void writeSpeakerChannel(SpeakerChannel &channel, uint8_t sineIndex) {
  configureSpeakerPwm();
  int duty = speakerIsActive(channel) ? sineDutyForVolume(channel.volume, sineIndex) : 0;
  ledcWrite(channel.pin, duty);
  if (String(channel.id) == "house_gas") {
    ledcWrite(HOUSE_ENV_SPEAKER_SECONDARY_PIN, duty);
  }
}

void updateSpeakerWaveforms() {
  configureSpeakerPwm();
  bool frontActive = speakerIsActive(frontDoorSpeaker);
  bool gasActive = speakerIsActive(houseGasSpeaker);

  if (!frontActive && !gasActive) {
    ledcWrite(frontDoorSpeaker.pin, 0);
    ledcWrite(houseGasSpeaker.pin, 0);
    ledcWrite(HOUSE_ENV_SPEAKER_SECONDARY_PIN, 0);
    return;
  }

  unsigned long nowUs = micros();

  if (frontActive) {
    unsigned long frontIntervalUs =
      1000000UL / max(1, frontDoorSpeaker.frequency * SINE_SAMPLE_COUNT);
    if (nowUs - lastFrontDoorSineUpdateUs >= frontIntervalUs) {
      lastFrontDoorSineUpdateUs = nowUs;
      frontDoorSineIndex = (frontDoorSineIndex + 1) % SINE_SAMPLE_COUNT;
      writeSpeakerChannel(frontDoorSpeaker, frontDoorSineIndex);
    }
  } else {
    ledcWrite(frontDoorSpeaker.pin, 0);
  }

  if (gasActive) {
    unsigned long gasIntervalUs =
      1000000UL / max(1, houseGasSpeaker.frequency * SINE_SAMPLE_COUNT);
    if (nowUs - lastHouseGasSineUpdateUs >= gasIntervalUs) {
      lastHouseGasSineUpdateUs = nowUs;
      houseGasSineIndex = (houseGasSineIndex + 1) % SINE_SAMPLE_COUNT;
      writeSpeakerChannel(houseGasSpeaker, houseGasSineIndex);
    }
  } else {
    ledcWrite(houseGasSpeaker.pin, 0);
    ledcWrite(HOUSE_ENV_SPEAKER_SECONDARY_PIN, 0);
  }
}

void triggerTimedSpeaker(SpeakerChannel &channel, const char* reason) {
  channel.active = true;
  channel.reason = reason;
  channel.activeUntilMs = millis() + speakerAlertDurationMs;
  updateSpeakerWaveforms();
}

void forceAllSpeakersOff() {
  pinMode(frontDoorSpeaker.pin, OUTPUT);
  pinMode(houseGasSpeaker.pin, OUTPUT);
  pinMode(HOUSE_ENV_SPEAKER_SECONDARY_PIN, OUTPUT);
  frontDoorSpeaker.active = false;
  frontDoorSpeaker.reason = nullptr;
  frontDoorSpeaker.activeUntilMs = 0;
  houseGasSpeaker.active = false;
  houseGasSpeaker.reason = nullptr;
  houseGasSpeaker.activeUntilMs = 0;
  digitalWrite(frontDoorSpeaker.pin, SPEAKER_INACTIVE_LEVEL);
  digitalWrite(houseGasSpeaker.pin, SPEAKER_INACTIVE_LEVEL);
  digitalWrite(HOUSE_ENV_SPEAKER_SECONDARY_PIN, SPEAKER_INACTIVE_LEVEL);
}

bool thresholdExceeded(bool currentlyActive, float firstValue, float secondValue, float threshold, float hysteresis) {
  float limit = currentlyActive ? threshold - hysteresis : threshold;
  bool firstExceeded = !isnan(firstValue) && (currentlyActive ? firstValue >= limit : firstValue > limit);
  bool secondExceeded = !isnan(secondValue) && (currentlyActive ? secondValue >= limit : secondValue > limit);
  return firstExceeded || secondExceeded;
}

void updateEnvironmentAlarm() {
  int gasValue = analogRead(GAS_PIN);
  float livingTemp = dhtLiving.readTemperature();
  float livingHum = dhtLiving.readHumidity();
  float bedroomTemp = dhtBedroom.readTemperature();
  float bedroomHum = dhtBedroom.readHumidity();

  gasAlarmActive = gasAlarmActive
    ? gasValue >= gasAlarmThreshold - GAS_ALARM_HYSTERESIS
    : gasValue > gasAlarmThreshold;
  temperatureAlarmActive = thresholdExceeded(
    temperatureAlarmActive,
    livingTemp,
    bedroomTemp,
    temperatureAlarmThreshold,
    TEMPERATURE_ALARM_HYSTERESIS
  );
  humidityAlarmActive = thresholdExceeded(
    humidityAlarmActive,
    livingHum,
    bedroomHum,
    humidityAlarmThreshold,
    HUMIDITY_ALARM_HYSTERESIS
  );

  if (speakerAlarmEnabled && (gasAlarmActive || temperatureAlarmActive || humidityAlarmActive)) {
    houseGasSpeaker.active = true;
    if (gasAlarmActive) {
      houseGasSpeaker.reason = "gas_threshold_exceeded";
    } else if (temperatureAlarmActive) {
      houseGasSpeaker.reason = "temperature_threshold_exceeded";
    } else {
      houseGasSpeaker.reason = "humidity_threshold_exceeded";
    }
    houseGasSpeaker.activeUntilMs = 0;
  } else if (houseGasSpeaker.reason != nullptr && (
             String(houseGasSpeaker.reason) == "gas_threshold_exceeded" ||
             String(houseGasSpeaker.reason) == "temperature_threshold_exceeded" ||
             String(houseGasSpeaker.reason) == "humidity_threshold_exceeded")) {
    houseGasSpeaker.active = false;
    houseGasSpeaker.reason = nullptr;
    houseGasSpeaker.activeUntilMs = 0;
  }

  updateSpeakerWaveforms();
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
  json += "\"speakers\":{";
  json += "\"front_door\":{";
  json += "\"active\":" + String(speakerIsActive(frontDoorSpeaker) ? "true" : "false") + ",";
  json += "\"volume\":" + String(frontDoorSpeaker.volume) + ",";
  json += "\"reason\":" + jsonReason(frontDoorSpeaker.reason);
  json += "},";
  json += "\"house_gas\":{";
  json += "\"active\":" + String(speakerIsActive(houseGasSpeaker) ? "true" : "false") + ",";
  json += "\"volume\":" + String(houseGasSpeaker.volume) + ",";
  json += "\"reason\":" + jsonReason(houseGasSpeaker.reason);
  json += "}";
  json += "},";
  json += "\"alarmTriggers\":{";
  json += "\"gas\":" + String(gasAlarmActive ? "true" : "false") + ",";
  json += "\"temperature\":" + String(temperatureAlarmActive ? "true" : "false") + ",";
  json += "\"humidity\":" + String(humidityAlarmActive ? "true" : "false") + ",";
  json += "\"stranger\":" + String(speakerIsActive(frontDoorSpeaker) ? "true" : "false");
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
  json += "\"enabled\":" + String(speakerAlarmEnabled ? "true" : "false") + ",";
  json += "\"gasThreshold\":" + String(gasAlarmThreshold) + ",";
  json += "\"thresholds\":{";
  json += "\"gas\":" + String(gasAlarmThreshold) + ",";
  json += "\"temperature\":" + String(temperatureAlarmThreshold) + ",";
  json += "\"humidity\":" + String(humidityAlarmThreshold);
  json += "},";
  json += "\"alertDurationMs\":" + String(speakerAlertDurationMs) + ",";
  json += "\"waveform\":\"sine\",";
  json += "\"speakers\":{";
  json += "\"front_door\":{";
  json += "\"active\":" + String(speakerIsActive(frontDoorSpeaker) ? "true" : "false") + ",";
  json += "\"volume\":" + String(frontDoorSpeaker.volume) + ",";
  json += "\"reason\":" + jsonReason(frontDoorSpeaker.reason);
  json += "},";
  json += "\"house_gas\":{";
  json += "\"active\":" + String(speakerIsActive(houseGasSpeaker) ? "true" : "false") + ",";
  json += "\"volume\":" + String(houseGasSpeaker.volume) + ",";
  json += "\"reason\":" + jsonReason(houseGasSpeaker.reason);
  json += "}";
  json += "},";
  json += "\"alarmTriggers\":{";
  json += "\"gas\":" + String(gasAlarmActive ? "true" : "false") + ",";
  json += "\"temperature\":" + String(temperatureAlarmActive ? "true" : "false") + ",";
  json += "\"humidity\":" + String(humidityAlarmActive ? "true" : "false") + ",";
  json += "\"stranger\":" + String(speakerIsActive(frontDoorSpeaker) ? "true" : "false");
  json += "}";
  json += "}";

  server.send(200, "application/json", json);
}

// GET /api/speaker/settings/update?enabled=true&gas=3000&temperature=35&humidity=80
void handleSpeakerSettingsUpdate() {
  sendCORS();

  if (!server.hasArg("enabled") && !server.hasArg("gas") &&
      !server.hasArg("temperature") && !server.hasArg("humidity")) {
    server.send(400, "application/json", "{\"error\":\"Missing speaker settings\"}");
    return;
  }

  int newGasThreshold = server.hasArg("gas") ? server.arg("gas").toInt() : gasAlarmThreshold;
  float newTemperatureThreshold = server.hasArg("temperature") ? server.arg("temperature").toFloat() : temperatureAlarmThreshold;
  float newHumidityThreshold = server.hasArg("humidity") ? server.arg("humidity").toFloat() : humidityAlarmThreshold;

  if (newGasThreshold < 0 || newTemperatureThreshold <= 0 || newHumidityThreshold <= 0) {
    server.send(400, "application/json", "{\"error\":\"Invalid speaker thresholds\"}");
    return;
  }

  if (server.hasArg("enabled")) {
    speakerAlarmEnabled = server.arg("enabled") == "true";
  }
  gasAlarmThreshold = newGasThreshold;
  temperatureAlarmThreshold = newTemperatureThreshold;
  humidityAlarmThreshold = newHumidityThreshold;
  updateEnvironmentAlarm();
  handleSpeakerSettings();
}

void handleFrontDoorSpeakerAlert() {
  sendCORS();
  triggerTimedSpeaker(frontDoorSpeaker, "stranger_5_frames");
  server.send(200, "application/json", "{\"success\":true,\"target\":\"front_door\",\"reason\":\"stranger_5_frames\"}");
}

void handleHouseGasSpeakerAlert() {
  sendCORS();
  triggerTimedSpeaker(houseGasSpeaker, "manual_test");
  server.send(200, "application/json", "{\"success\":true,\"target\":\"house_gas\",\"reason\":\"manual_test\"}");
}

// GET /api/speaker/audio/update?frontVolume=80&houseGasVolume=75&duration=5000&gas=3000&temperature=35&humidity=80
void handleSpeakerAudioUpdate() {
  sendCORS();

  if (server.hasArg("frontVolume")) {
    frontDoorSpeaker.volume = constrain(server.arg("frontVolume").toInt(), 0, 100);
  }
  if (server.hasArg("houseGasVolume")) {
    houseGasSpeaker.volume = constrain(server.arg("houseGasVolume").toInt(), 0, 100);
  }
  if (server.hasArg("duration")) {
    speakerAlertDurationMs = constrain(server.arg("duration").toInt(), 500, 30000);
  }
  if (server.hasArg("gas")) {
    gasAlarmThreshold = max(0, server.arg("gas").toInt());
  }
  if (server.hasArg("temperature")) {
    temperatureAlarmThreshold = max(1.0f, server.arg("temperature").toFloat());
  }
  if (server.hasArg("humidity")) {
    humidityAlarmThreshold = max(1.0f, server.arg("humidity").toFloat());
  }

  updateEnvironmentAlarm();
  handleSpeakerSettings();
}

void handleFrontDoorSpeakerTest() {
  sendCORS();
  triggerTimedSpeaker(frontDoorSpeaker, "manual_test");
  server.send(200, "application/json", "{\"success\":true,\"target\":\"front_door\",\"reason\":\"manual_test\",\"waveform\":\"sine\"}");
}

void handleHouseGasSpeakerTest() {
  sendCORS();
  triggerTimedSpeaker(houseGasSpeaker, "manual_test");
  server.send(200, "application/json", "{\"success\":true,\"target\":\"house_gas\",\"reason\":\"manual_test\",\"waveform\":\"sine\"}");
}

// POST /api/speaker/volume?speakerId=1&volume=50
void handleSpeakerVolume() {
  sendCORS();
  if (server.hasArg("speakerId") && server.hasArg("volume")) {
    int id = server.arg("speakerId").toInt();
    int vol = server.arg("volume").toInt();
    if (id == 1) {
      frontDoorSpeaker.volume = constrain(vol, 0, 100);
    } else if (id == 2) {
      houseGasSpeaker.volume = constrain(vol, 0, 100);
    }
    server.send(200, "application/json", "{\"success\":true}");
  } else {
    server.send(400, "application/json", "{\"error\":\"Missing speakerId or volume\"}");
  }
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
  server.on("/api/speaker/alert", HTTP_GET, handleFrontDoorSpeakerAlert);
  server.on("/api/speaker/alert/front-door", HTTP_GET, handleFrontDoorSpeakerAlert);
  server.on("/api/speaker/alert/house-gas", HTTP_GET, handleHouseGasSpeakerAlert);
  server.on("/api/speaker/audio/update", HTTP_GET, handleSpeakerAudioUpdate);
  server.on("/api/speaker/test/front-door", HTTP_GET, handleFrontDoorSpeakerTest);
  server.on("/api/speaker/test/house-gas", HTTP_GET, handleHouseGasSpeakerTest);
  server.on("/api/speaker/volume", HTTP_POST, handleSpeakerVolume);

  server.begin();
  Serial.println("HTTP server started");
}

// ================= LOOP =================
void loop() {
  server.handleClient();
  updateSpeakerWaveforms(); // CHÚ Ý: Phải gọi liên tục để tạo sóng Sin mượt

  if (WiFi.status() == WL_CONNECTED &&
      millis() - lastBackendRegisterMs >= BACKEND_REGISTER_INTERVAL_MS) {
    registerWithBackend();
  }

  unsigned long now = millis();
  if (now - lastAlarmCheckMs >= ALARM_CHECK_INTERVAL_MS) {
    lastAlarmCheckMs = now;
    updateEnvironmentAlarm();
  }
}
