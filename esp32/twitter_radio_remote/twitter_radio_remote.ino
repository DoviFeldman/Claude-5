// Twitter Radio Remote — ESP32 BLE peripheral with 2 rotary encoders + 2 buttons.
//
// Signals sent to the phone app (as BLE notifications, plain ASCII):
//   Dial 1 turn (either way)  -> "SKIP"
//   Dial 2 clockwise          -> "VOLUME_UP"
//   Dial 2 counter-clockwise  -> "VOLUME_DOWN"
//   Button 1                  -> "EXPAND"
//   Button 2                  -> "NEXT_TOPIC"
//
// The remote is optional: the phone app works fully without it.
// Test mode: with no BLE client connected, signals print to Serial (115200)
// so you can verify the wiring with just a USB cable.
//
// Library: install "NimBLE-Arduino" from the Arduino Library Manager.

#include <NimBLEDevice.h>

// ---------- BLE identity (must match the app's settings) ----------
static const char* DEVICE_NAME         = "TwitterRadioRemote";
static const char* SERVICE_UUID        = "7a0b1000-b5a3-4a1c-9e0f-2b3c4d5e6f70";
static const char* CHARACTERISTIC_UUID = "7a0b1001-b5a3-4a1c-9e0f-2b3c4d5e6f70";

// ---------- Pins (change to match your wiring) ----------
static const int ENC1_A_PIN   = 32;  // dial 1: SKIP
static const int ENC1_B_PIN   = 33;
static const int ENC2_A_PIN   = 25;  // dial 2: volume
static const int ENC2_B_PIN   = 26;
static const int BUTTON1_PIN  = 27;  // EXPAND (to GND, uses internal pullup)
static const int BUTTON2_PIN  = 14;  // NEXT_TOPIC (to GND, uses internal pullup)
static const int LED_PIN      = 2;   // onboard LED on most dev boards

static const unsigned long BUTTON_DEBOUNCE_MS  = 50;
static const unsigned long ENCODER_DEBOUNCE_MS = 5;
static const unsigned long DIAL_REPEAT_MS      = 150; // min gap between dial signals

NimBLEServer* bleServer = nullptr;
NimBLECharacteristic* signalChar = nullptr;
volatile bool clientConnected = false;

class ServerCallbacks : public NimBLEServerCallbacks {
  void onConnect(NimBLEServer* server, NimBLEConnInfo& info) override {
    clientConnected = true;
    Serial.println("[ble] client connected");
    // Blink LED to confirm connection, then leave it on.
    for (int i = 0; i < 3; i++) {
      digitalWrite(LED_PIN, HIGH); delay(120);
      digitalWrite(LED_PIN, LOW);  delay(120);
    }
    digitalWrite(LED_PIN, HIGH);
  }
  void onDisconnect(NimBLEServer* server, NimBLEConnInfo& info, int reason) override {
    clientConnected = false;
    digitalWrite(LED_PIN, LOW);
    Serial.println("[ble] client disconnected, advertising again");
    NimBLEDevice::startAdvertising();
  }
};

void sendSignal(const char* signal) {
  if (clientConnected && signalChar != nullptr) {
    signalChar->setValue((const uint8_t*)signal, strlen(signal));
    signalChar->notify();
    Serial.printf("[ble] sent: %s\n", signal);
  } else {
    // Serial test mode: no phone connected, just print.
    Serial.printf("[test] %s\n", signal);
  }
}

// ---------- Debounced encoder / button state ----------
struct Encoder {
  int pinA, pinB;
  int lastA = HIGH;
  unsigned long lastEdgeMs = 0;
  unsigned long lastSignalMs = 0;
};
struct Button {
  int pin;
  int lastStable = HIGH;
  int lastRead = HIGH;
  unsigned long lastChangeMs = 0;
};

Encoder enc1 = { ENC1_A_PIN, ENC1_B_PIN };
Encoder enc2 = { ENC2_A_PIN, ENC2_B_PIN };
Button  btn1 = { BUTTON1_PIN };
Button  btn2 = { BUTTON2_PIN };

// Returns +1 (clockwise), -1 (counter-clockwise), or 0. Reads on falling edge
// of A; B's level at that moment gives the direction.
int readEncoder(Encoder& enc) {
  int a = digitalRead(enc.pinA);
  int result = 0;
  unsigned long now = millis();
  if (a != enc.lastA && (now - enc.lastEdgeMs) > ENCODER_DEBOUNCE_MS) {
    enc.lastEdgeMs = now;
    if (a == LOW && (now - enc.lastSignalMs) > DIAL_REPEAT_MS) {
      enc.lastSignalMs = now;
      result = (digitalRead(enc.pinB) == HIGH) ? 1 : -1;
    }
  }
  enc.lastA = a;
  return result;
}

// Returns true once per press (on the debounced falling edge).
bool readButton(Button& btn) {
  int reading = digitalRead(btn.pin);
  unsigned long now = millis();
  if (reading != btn.lastRead) {
    btn.lastChangeMs = now;
    btn.lastRead = reading;
  }
  if ((now - btn.lastChangeMs) > BUTTON_DEBOUNCE_MS && reading != btn.lastStable) {
    btn.lastStable = reading;
    if (reading == LOW) return true;
  }
  return false;
}

void setup() {
  Serial.begin(115200);
  pinMode(ENC1_A_PIN, INPUT_PULLUP);
  pinMode(ENC1_B_PIN, INPUT_PULLUP);
  pinMode(ENC2_A_PIN, INPUT_PULLUP);
  pinMode(ENC2_B_PIN, INPUT_PULLUP);
  pinMode(BUTTON1_PIN, INPUT_PULLUP);
  pinMode(BUTTON2_PIN, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  NimBLEDevice::init(DEVICE_NAME);
  bleServer = NimBLEDevice::createServer();
  bleServer->setCallbacks(new ServerCallbacks());

  NimBLEService* service = bleServer->createService(SERVICE_UUID);
  signalChar = service->createCharacteristic(
      CHARACTERISTIC_UUID,
      NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);
  service->start();

  NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();
  adv->addServiceUUID(SERVICE_UUID);
  adv->setName(DEVICE_NAME);
  adv->start();

  Serial.println("Twitter Radio Remote ready.");
  Serial.println("No BLE client connected yet — signals will print here (test mode).");
}

void loop() {
  if (readEncoder(enc1) != 0) sendSignal("SKIP");

  int dir = readEncoder(enc2);
  if (dir > 0) sendSignal("VOLUME_UP");
  if (dir < 0) sendSignal("VOLUME_DOWN");

  if (readButton(btn1)) sendSignal("EXPAND");
  if (readButton(btn2)) sendSignal("NEXT_TOPIC");

  delay(1); // keep the loop tight for encoder polling
}
