#include <WiFi.h>
#include <WebServer.h>
#include <DHT.h>
#include <ESP32Servo.h>
#include <esp_system.h>
#include <math.h>

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
#define DHT_LIVING_PIN    25
#define DHT_BEDROOM_PIN   23
#define DHT_TYPE          DHT11
#define GAS_PIN           32
#define SERVO_PIN         26
#define LOA_TRUOC         27
#define LOA_KHACH         14
#define LOA_NGU           13
#define FRONT_DOOR_SPEAKER_PIN LOA_TRUOC
#define HOUSE_GAS_SPEAKER_PIN  LOA_KHACH
#define HOUSE_ENV_SPEAKER_SECONDARY_PIN LOA_NGU

// ================= SERVO CONFIG =================
// Door servo range.
// 90  = close
// 180 = open
#define SERVO_MIN_US       500
#define SERVO_MAX_US       2400
#define SERVO_MAX_ANGLE    180

#define DOOR_CLOSE_ANGLE   90
#define DOOR_OPEN_ANGLE    180
#define SERVO_STEP_DELAY   20
#define SERVO_STEP_ANGLE   10

// Speaker frequency-sweep PWM config.
#define SPEAKER_PWM_RESOLUTION 8
#define SPEAKER_SWEEP_RANGE_HZ 1000
#define SPEAKER_SWEEP_INTERVAL_MS 2
#define SPEAKER_SWEEP_MAX_DEGREES 180
#define SPEAKER_MAX_DUTY       128
#define HOUSE_ENV_SPEAKER_PINS_COUNT 2

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

int currentDoorAngle = DOOR_CLOSE_ANGLE;

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
  100,
  1000,
  false,
  nullptr,
  0
};

SpeakerChannel houseGasSpeaker = {
  "house_gas",
  HOUSE_GAS_SPEAKER_PIN,
  100,
  2000,
  false,
  nullptr,
  0
};

const int HOUSE_ENV_SPEAKER_PINS[HOUSE_ENV_SPEAKER_PINS_COUNT] = {
  HOUSE_GAS_SPEAKER_PIN,
  HOUSE_ENV_SPEAKER_SECONDARY_PIN
};

bool speakersPwmReady = false;
unsigned long lastFrontDoorSweepUpdateMs = 0;
unsigned long lastHouseGasSweepUpdateMs = 0;
int frontDoorSweepDegrees = 0;
int houseGasSweepDegrees = 0;

// ================= BACKEND REGISTER =================
void registerWithBackend() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected, cannot register");
    return;
  }

  HTTPClient http;
  String url = "http://" + String(BACKEND_HOST) + ":" + String(BACKEND_PORT) + "/api/arduino/register/sensor";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

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

// ================= SERVO HELPERS =================
void writeDoorServoAngle(int angle) {
  angle = constrain(angle, 0, SERVO_MAX_ANGLE);

  int pulse = map(
    angle,
    0,
    SERVO_MAX_ANGLE,
    SERVO_MIN_US,
    SERVO_MAX_US
  );

  doorServo.writeMicroseconds(pulse);

  Serial.print("Door servo angle: ");
  Serial.print(angle);
  Serial.print(" | pulse: ");
  Serial.println(pulse);
}

void moveDoorServoSmooth(int targetAngle) {
  targetAngle = constrain(targetAngle, 0, SERVO_MAX_ANGLE);

  if (currentDoorAngle < targetAngle) {
    for (int pos = currentDoorAngle; pos <= targetAngle; pos += SERVO_STEP_ANGLE) {
      writeDoorServoAngle(pos);
      delay(SERVO_STEP_DELAY);
    }
  } else {
    for (int pos = currentDoorAngle; pos >= targetAngle; pos -= SERVO_STEP_ANGLE) {
      writeDoorServoAngle(pos);
      delay(SERVO_STEP_DELAY);
    }
  }

  writeDoorServoAngle(targetAngle);
  currentDoorAngle = targetAngle;
}

void ensureDoorServoAttached() {
  if (doorServoAttached) {
    return;
  }

  ESP32PWM::allocateTimer(0);
  doorServo.setPeriodHertz(50);
  doorServo.attach(SERVO_PIN, SERVO_MIN_US, SERVO_MAX_US);

  currentDoorAngle = DOOR_CLOSE_ANGLE;
  writeDoorServoAngle(DOOR_CLOSE_ANGLE);

  doorServoAttached = true;
  delay(200);
}

// ================= SPEAKER HELPERS =================
void configureSpeakerPwm() {
  if (speakersPwmReady) {
    return;
  }

  ledcAttach(frontDoorSpeaker.pin, frontDoorSpeaker.frequency, SPEAKER_PWM_RESOLUTION);
  ledcWrite(frontDoorSpeaker.pin, 0);
  for (int i = 0; i < HOUSE_ENV_SPEAKER_PINS_COUNT; i++) {
    ledcAttach(HOUSE_ENV_SPEAKER_PINS[i], houseGasSpeaker.frequency, SPEAKER_PWM_RESOLUTION);
    ledcWrite(HOUSE_ENV_SPEAKER_PINS[i], 0);
  }

  speakersPwmReady = true;
}

int dutyForVolume(int volume) {
  return constrain((SPEAKER_MAX_DUTY * constrain(volume, 0, 100)) / 100, 0, 255);
}

int sweptFrequencyForChannel(SpeakerChannel &channel, int sweepDegrees) {
  float radians = sweepDegrees * 3.14159265f / 180.0f;
  int sweptFrequency = channel.frequency + static_cast<int>(sin(radians) * SPEAKER_SWEEP_RANGE_HZ);
  return constrain(sweptFrequency, 1, 20000);
}

bool speakerIsActive(SpeakerChannel &channel) {
  if (channel.activeUntilMs != 0 && millis() >= channel.activeUntilMs) {
    channel.active = false;
    channel.reason = nullptr;
    channel.activeUntilMs = 0;
  }

  return channel.active;
}

  void writeSpeakerChannel(SpeakerChannel &channel, int sweptFrequency) {
  configureSpeakerPwm();

  int duty = speakerIsActive(channel) ? dutyForVolume(channel.volume) : 0;

  if (String(channel.id) == "house_gas") {
    for (int i = 0; i < HOUSE_ENV_SPEAKER_PINS_COUNT; i++) {
      ledcChangeFrequency(HOUSE_ENV_SPEAKER_PINS[i], sweptFrequency, SPEAKER_PWM_RESOLUTION);
      ledcWrite(HOUSE_ENV_SPEAKER_PINS[i], duty);
    }
    return;
  }

  ledcChangeFrequency(channel.pin, sweptFrequency, SPEAKER_PWM_RESOLUTION);
  ledcWrite(channel.pin, duty);
}

void updateSpeakerWaveforms() {
  configureSpeakerPwm();

  bool frontActive = speakerIsActive(frontDoorSpeaker);
  bool gasActive = speakerIsActive(houseGasSpeaker);

  if (!frontActive && !gasActive) {
    ledcWrite(frontDoorSpeaker.pin, 0);
    for (int i = 0; i < HOUSE_ENV_SPEAKER_PINS_COUNT; i++) {
      ledcWrite(HOUSE_ENV_SPEAKER_PINS[i], 0);
    }
    return;
  }

  unsigned long nowMs = millis();

  if (frontActive) {
    if (nowMs - lastFrontDoorSweepUpdateMs >= SPEAKER_SWEEP_INTERVAL_MS) {
      lastFrontDoorSweepUpdateMs = nowMs;
      int sweptFrequency = sweptFrequencyForChannel(frontDoorSpeaker, frontDoorSweepDegrees);
      frontDoorSweepDegrees = (frontDoorSweepDegrees + 1) % SPEAKER_SWEEP_MAX_DEGREES;
      writeSpeakerChannel(frontDoorSpeaker, sweptFrequency);
    }
  } else {
    ledcWrite(frontDoorSpeaker.pin, 0);
  }

  if (gasActive) {
    if (nowMs - lastHouseGasSweepUpdateMs >= SPEAKER_SWEEP_INTERVAL_MS) {
      lastHouseGasSweepUpdateMs = nowMs;
      int sweptFrequency = sweptFrequencyForChannel(houseGasSpeaker, houseGasSweepDegrees);
      houseGasSweepDegrees = (houseGasSweepDegrees + 1) % SPEAKER_SWEEP_MAX_DEGREES;
      writeSpeakerChannel(houseGasSpeaker, sweptFrequency);
    }
  } else {
    for (int i = 0; i < HOUSE_ENV_SPEAKER_PINS_COUNT; i++) {
      ledcWrite(HOUSE_ENV_SPEAKER_PINS[i], 0);
    }
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
  for (int i = 0; i < HOUSE_ENV_SPEAKER_PINS_COUNT; i++) {
    pinMode(HOUSE_ENV_SPEAKER_PINS[i], OUTPUT);
  }

  frontDoorSpeaker.active = false;
  frontDoorSpeaker.reason = nullptr;
  frontDoorSpeaker.activeUntilMs = 0;

  houseGasSpeaker.active = false;
  houseGasSpeaker.reason = nullptr;
  houseGasSpeaker.activeUntilMs = 0;

  if (speakersPwmReady) {
    ledcWrite(frontDoorSpeaker.pin, 0);
    for (int i = 0; i < HOUSE_ENV_SPEAKER_PINS_COUNT; i++) {
      ledcWrite(HOUSE_ENV_SPEAKER_PINS[i], 0);
    }
  }

  digitalWrite(frontDoorSpeaker.pin, SPEAKER_INACTIVE_LEVEL);
  for (int i = 0; i < HOUSE_ENV_SPEAKER_PINS_COUNT; i++) {
    digitalWrite(HOUSE_ENV_SPEAKER_PINS[i], SPEAKER_INACTIVE_LEVEL);
  }
}

// ================= ALARM LOGIC =================
bool thresholdExceeded(
  bool currentlyActive,
  float firstValue,
  float secondValue,
  float threshold,
  float hysteresis
) {
  float limit = currentlyActive ? threshold - hysteresis : threshold;

  bool firstExceeded =
    !isnan(firstValue) &&
    (currentlyActive ? firstValue >= limit : firstValue > limit);

  bool secondExceeded =
    !isnan(secondValue) &&
    (currentlyActive ? secondValue >= limit : secondValue > limit);

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
  } else if (
    houseGasSpeaker.reason != nullptr &&
    (
      String(houseGasSpeaker.reason) == "gas_threshold_exceeded" ||
      String(houseGasSpeaker.reason) == "temperature_threshold_exceeded" ||
      String(houseGasSpeaker.reason) == "humidity_threshold_exceeded"
    )
  ) {
    houseGasSpeaker.active = false;
    houseGasSpeaker.reason = nullptr;
    houseGasSpeaker.activeUntilMs = 0;
  }

  updateSpeakerWaveforms();
}

// ================= API HANDLERS =================
void handleRoot() {
  sendCORS();
  server.send(200, "application/json", "{\"message\":\"ESP32 Sensor Node is running\"}");
}

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

void handleDevices() {
  sendCORS();

  String json = "{";

  json += "\"wcLight\":" + String(wcLightState ? "true" : "false") + ",";
  json += "\"kitchenLight\":" + String(kitchenLightState ? "true" : "false") + ",";
  json += "\"bedroomLight\":" + String(bedroomLightState ? "true" : "false") + ",";
  json += "\"doorOpen\":" + String(doorOpenState ? "true" : "false") + ",";
  json += "\"doorAngle\":" + String(currentDoorAngle) + ",";

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

// ================= LIGHT HANDLERS =================
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

// ================= DOOR HANDLERS =================
void handleDoorOpen() {
  sendCORS();
  ensureDoorServoAttached();

  moveDoorServoSmooth(DOOR_OPEN_ANGLE);

  doorOpenState = true;
  server.send(
    200,
    "application/json",
    "{\"success\":true,\"doorOpen\":true,\"angle\":180}"
  );
}

void handleDoorClose() {
  sendCORS();
  ensureDoorServoAttached();

  moveDoorServoSmooth(DOOR_CLOSE_ANGLE);

  doorOpenState = false;
  server.send(
    200,
    "application/json",
    "{\"success\":true,\"doorOpen\":false,\"angle\":90}"
  );
}

// ================= SPEAKER API =================
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
  json += "\"waveform\":\"frequency_sweep\",";

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

void handleSpeakerSettingsUpdate() {
  sendCORS();

  if (
    !server.hasArg("enabled") &&
    !server.hasArg("gas") &&
    !server.hasArg("temperature") &&
    !server.hasArg("humidity")
  ) {
    server.send(400, "application/json", "{\"error\":\"Missing speaker settings\"}");
    return;
  }

  int newGasThreshold =
    server.hasArg("gas") ? server.arg("gas").toInt() : gasAlarmThreshold;

  float newTemperatureThreshold =
    server.hasArg("temperature") ? server.arg("temperature").toFloat() : temperatureAlarmThreshold;

  float newHumidityThreshold =
    server.hasArg("humidity") ? server.arg("humidity").toFloat() : humidityAlarmThreshold;

  if (
    newGasThreshold < 0 ||
    newTemperatureThreshold <= 0 ||
    newHumidityThreshold <= 0
  ) {
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
  server.send(
    200,
    "application/json",
    "{\"success\":true,\"target\":\"front_door\",\"reason\":\"stranger_5_frames\"}"
  );
}

void handleHouseGasSpeakerAlert() {
  sendCORS();
  triggerTimedSpeaker(houseGasSpeaker, "manual_test");
  server.send(
    200,
    "application/json",
    "{\"success\":true,\"target\":\"house_gas\",\"reason\":\"manual_test\"}"
  );
}

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
    gasAlarmThreshold = max(0L, server.arg("gas").toInt());
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
  server.send(
    200,
    "application/json",
    "{\"success\":true,\"target\":\"front_door\",\"reason\":\"manual_test\",\"waveform\":\"frequency_sweep\"}"
  );
}

void handleHouseGasSpeakerTest() {
  sendCORS();
  triggerTimedSpeaker(houseGasSpeaker, "manual_test");
  server.send(
    200,
    "application/json",
    "{\"success\":true,\"target\":\"house_gas\",\"reason\":\"manual_test\",\"waveform\":\"frequency_sweep\"}"
  );
}

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

  // Lights
  pinMode(LED_WC_PIN, OUTPUT);
  pinMode(LED_KITCHEN_PIN, OUTPUT);
  pinMode(LED_BEDROOM_PIN, OUTPUT);

  digitalWrite(LED_WC_PIN, LOW);
  digitalWrite(LED_KITCHEN_PIN, LOW);
  digitalWrite(LED_BEDROOM_PIN, LOW);

  // Ultrasonic
  pinMode(TRIG_KITCHEN_PIN, OUTPUT);
  pinMode(ECHO_KITCHEN_PIN, INPUT);

  pinMode(TRIG_WC_PIN, OUTPUT);
  pinMode(ECHO_WC_PIN, INPUT);

  // Gas
  pinMode(GAS_PIN, INPUT);

  // Servo starts closed
  ensureDoorServoAttached();

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

  // Must be called continuously to sweep speaker tone frequency.
  updateSpeakerWaveforms();

  if (
    WiFi.status() == WL_CONNECTED &&
    millis() - lastBackendRegisterMs >= BACKEND_REGISTER_INTERVAL_MS
  ) {
    registerWithBackend();
  }

  unsigned long now = millis();

  if (now - lastAlarmCheckMs >= ALARM_CHECK_INTERVAL_MS) {
    lastAlarmCheckMs = now;
    updateEnvironmentAlarm();
  }
}
