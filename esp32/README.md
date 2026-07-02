# Step 3 — ESP32 Remote (optional)

A physical BLE remote for the radio: two dials, two buttons. The app works
completely without it — this is just nicer to use while driving.

## Wiring (default pins, changeable at the top of the sketch)

| Part | Pins |
|---|---|
| Dial 1 (rotary encoder) — SKIP | A→GPIO32, B→GPIO33, GND→GND |
| Dial 2 (rotary encoder) — volume | A→GPIO25, B→GPIO26, GND→GND |
| Button 1 — EXPAND | GPIO27 → button → GND |
| Button 2 — NEXT TOPIC | GPIO14 → button → GND |
| LED | onboard (GPIO2) — blinks then stays on when the phone connects |

All inputs use internal pull-ups, so no resistors needed. Standard KY-040
encoder modules work fine (connect CLK→A, DT→B, GND→GND; VCC not needed).

## Flash it

1. Arduino IDE → install the **ESP32 board package** (Boards Manager) and the
   **NimBLE-Arduino** library (Library Manager).
2. Open `twitter_radio_remote/twitter_radio_remote.ino`, pick your board
   (e.g. "ESP32 Dev Module") and port, and Upload.

## Test without the phone

Open Serial Monitor at **115200 baud**. With no BLE client connected, every
dial twist / button press prints like `[test] SKIP` — that's how you verify
the wiring before touching the app.

## Connect from the app

In the app: Settings → BLE device name = `TwitterRadioRemote` (the default) →
Connect. The LED blinks 3 times and stays lit. Dials and buttons now trigger
the same actions as the on-screen controls.

BLE UUIDs (must match `app/src/ble.js` if you change them):

- Service: `7a0b1000-b5a3-4a1c-9e0f-2b3c4d5e6f70`
- Characteristic: `7a0b1001-b5a3-4a1c-9e0f-2b3c4d5e6f70`
