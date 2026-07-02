# Step 2 — Android App

Your radio: downloads the latest briefing from the VPS (all text + all audio up
front, so controls are instant), plays it through the phone speaker or any
Bluetooth speaker, and always shows the current text on screen in case audio
isn't working. The screen is kept awake while the app is open so audio and BLE
never cut out.

## Controls

| Control | What it does |
|---|---|
| ▶ / ⏸ | Play / pause |
| Next ⏭ | Jump to the next topic's summary |
| ⏮ Back | Re-open the **previous** topic's deep dive |
| 🔍 Deep dive | Play the full story of the current topic |
| ↻ Reload | Re-download the latest briefing from the VPS |
| Volume slider | Also controllable from the ESP32 dial |

Topics the AI thinks you really care about (based on your onboarding answers)
auto-continue from summary into deep dive; everything else plays just the
summary and moves on. Audio files are wiped from the phone on every reload —
history lives on the VPS for a week.

## Build the APK (one-time)

This is an Expo **dev-client** app (BLE needs native code, so Expo Go won't work).

Easiest — cloud build, no Android SDK needed:

```bash
cd app
npm install
npm install -g eas-cli
eas login                 # free Expo account
eas build -p android --profile preview
```

That prints a link to download an APK — open it on your phone and install.
(First time, EAS will offer to create the build profile; accept the defaults,
or add an `eas.json` with a `preview` profile using `"buildType": "apk"`.)

Or locally, if you have Android Studio + a connected phone:

```bash
cd app
npm install
npx expo run:android
```

## First run

1. The onboarding chat asks for your VPS URL + token, then your interests,
   favorite accounts, commute length, depth, and never-topics. It saves your
   profile to the VPS. ("Redo setup" lives in settings.)
2. Settings → **Test VPS connection** (checks `/status`).
3. Settings → **Test mode** — runs the server's mock pipeline and plays the
   result: verifies the whole VPS → download → audio path with zero Twitter.
4. Main screen → ↻ Reload for the real briefing.

## ESP32 remote (optional)

Tap the `○ remote` badge on the main screen to scan and connect. Dials and
buttons then drive the same actions as the on-screen controls. If no remote is
found the app just keeps working normally.
