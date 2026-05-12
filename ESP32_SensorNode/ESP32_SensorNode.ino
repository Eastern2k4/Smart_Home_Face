#include <WiFi.h>
#include <WebServer.h>
#include <DHT.h>
#include <ESP32Servo.h>

#include <HTTPClient.h>

// ================= BACKEND REGISTRATION =================
const char* backendHost = "192.168.1.X";   // Replace with your Flask server's IP address
const int backendPort = 5001;

// ================= WIFI CONFIG =================
const char* ssid = "TRAM 247 STUDY CAFE & WORKSPACE";
const char* password = "tramloveyou";

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

// ================= OBJECTS =================
DHT dhtLiving(DHT_LIVING_PIN, DHT_TYPE);
DHT dhtBedroom(DHT_BEDROOM_PIN, DHT_TYPE);
Servo doorServo;

// ================= DEVICE STATE =================
bool wcLightState = false;
bool kitchenLightState = false;
bool bedroomLightState = false;
bool doorOpenState = false;

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
}

// ================= HELPER =================
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
  json += "\"temperature\":" + String(livingTemp) + ",";
  json += "\"humidity\":" + String(livingHum);
  json += "},";

  json += "\"bedroom\":{";
  json += "\"temperature\":" + String(bedroomTemp) + ",";
  json += "\"humidity\":" + String(bedroomHum);
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
  json += "\"doorOpen\":" + String(doorOpenState ? "true" : "false");
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

  // quay từ 180 -> 90 doorServo.write(90); 
  for (int pos = 180; pos >= 90; pos--) {
    doorServo.write(pos);
    delay(20); // càng lớn thì quay càng chậm
  }

  doorOpenState = false;
  server.send(200, "application/json", "{\"success\":true,\"doorOpen\":false}");
}

// ================= SETUP =================
void setup() {
  Serial.begin(115200);

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

  // Servo
  doorServo.attach(SERVO_PIN);
  doorServo.write(90);

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

  server.begin();
  Serial.println("HTTP server started");
}

// ================= LOOP =================
void loop() {
  server.handleClient();
}
