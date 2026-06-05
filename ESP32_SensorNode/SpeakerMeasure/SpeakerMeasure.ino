// Standalone speaker/buzzer measurement sketch for ESP32.
// Upload this sketch alone when you want to measure output frequency or find
// each buzzer's loudest resonance point.

#define LOA_TRUOC 27
#define LOA_KHACH 14
#define LOA_NGU 13

#define PWM_RESOLUTION 8
#define DUTY_50_PERCENT 128

const int SPEAKER_PINS[] = {LOA_TRUOC, LOA_KHACH, LOA_NGU};
const int SPEAKER_COUNT = sizeof(SPEAKER_PINS) / sizeof(SPEAKER_PINS[0]);

int selectedPin = LOA_TRUOC;
int selectedFrequency = 2000;
bool outputEnabled = false;

void printMenu() {
  Serial.println();
  Serial.println("SpeakerMeasure commands:");
  Serial.println("  1        select GPIO 27");
  Serial.println("  2        select GPIO 14");
  Serial.println("  3        select GPIO 13");
  Serial.println("  f 2000   set frequency in Hz");
  Serial.println("  on       start selected pin");
  Serial.println("  off      stop all pins");
  Serial.println("  sweep    sweep 500..5000 Hz on selected pin");
  Serial.println("  all      test 2000 Hz on each pin");
  Serial.println("  ?        show this menu");
  Serial.println();
}

void stopAllSpeakers() {
  for (int i = 0; i < SPEAKER_COUNT; i++) {
    ledcWrite(SPEAKER_PINS[i], 0);
  }
  outputEnabled = false;
}

void startToneOnPin(int pin, int frequency) {
  stopAllSpeakers();
  selectedPin = pin;
  selectedFrequency = constrain(frequency, 1, 20000);

  ledcAttach(selectedPin, selectedFrequency, PWM_RESOLUTION);
  ledcWrite(selectedPin, DUTY_50_PERCENT);
  outputEnabled = true;

  Serial.print("ON GPIO ");
  Serial.print(selectedPin);
  Serial.print(" at ");
  Serial.print(selectedFrequency);
  Serial.println(" Hz, 50% duty");
}

void sweepSelectedPin() {
  Serial.print("Sweep GPIO ");
  Serial.println(selectedPin);

  for (int freq = 500; freq <= 5000; freq += 250) {
    startToneOnPin(selectedPin, freq);
    delay(900);
  }

  stopAllSpeakers();
  Serial.println("Sweep done");
}

void testAllPins() {
  for (int i = 0; i < SPEAKER_COUNT; i++) {
    startToneOnPin(SPEAKER_PINS[i], selectedFrequency);
    delay(1500);
  }

  stopAllSpeakers();
  Serial.println("All-pin test done");
}

String readCommand() {
  String command = Serial.readStringUntil('\n');
  command.trim();
  command.toLowerCase();
  return command;
}

void handleCommand(const String &command) {
  if (command.length() == 0) {
    return;
  }

  if (command == "?") {
    printMenu();
  } else if (command == "1") {
    selectedPin = LOA_TRUOC;
    Serial.println("Selected GPIO 27");
  } else if (command == "2") {
    selectedPin = LOA_KHACH;
    Serial.println("Selected GPIO 14");
  } else if (command == "3") {
    selectedPin = LOA_NGU;
    Serial.println("Selected GPIO 13");
  } else if (command.startsWith("f ")) {
    selectedFrequency = constrain(command.substring(2).toInt(), 1, 20000);
    Serial.print("Frequency set to ");
    Serial.print(selectedFrequency);
    Serial.println(" Hz");
    if (outputEnabled) {
      startToneOnPin(selectedPin, selectedFrequency);
    }
  } else if (command == "on") {
    startToneOnPin(selectedPin, selectedFrequency);
  } else if (command == "off") {
    stopAllSpeakers();
    Serial.println("OFF");
  } else if (command == "sweep") {
    sweepSelectedPin();
  } else if (command == "all") {
    testAllPins();
  } else {
    Serial.println("Unknown command. Type ? for help.");
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);

  for (int i = 0; i < SPEAKER_COUNT; i++) {
    pinMode(SPEAKER_PINS[i], OUTPUT);
    ledcAttach(SPEAKER_PINS[i], selectedFrequency, PWM_RESOLUTION);
    ledcWrite(SPEAKER_PINS[i], 0);
  }

  Serial.println("SpeakerMeasure ready");
  printMenu();
}

void loop() {
  if (Serial.available()) {
    handleCommand(readCommand());
  }
}
