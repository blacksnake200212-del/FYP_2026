# SDAS Mobile Applications (React Native & Expo SDK 57)

## 1. Architectural Role Segregation

To guarantee physical dam infrastructure security while delivering broad public awareness, SDAS maintains **two strictly separated client applications**:

```
                              [ Supabase Backend ]
                                  │           │
                Row Level Security│           │RLS Role Check & Auth
                 (Public View)    │           │(Device Key / JWT)
                                  ▼           ▼
                      +----------------+   +-------------------+
                      |   PUBLIC APP   |   |   OPERATOR APP    |
                      |  (Zero Login)  |   |  (Auth Guarded)   |
                      +----------------+   +-------------------+
                              │                      │
                              │                      ▼ (MQTT Broker)
                              │              [ ESP32 Gate Servo ]
                              │              (Sub-2s Override)
                              ▼
                      [ General Public ]
```

---

## 2. Operator Console (`mobile_apps/operator_app`)
- **Target Audience:** Irrigation department duty engineers, Disaster Management Centre (DMC) officers.
- **Security:** Requires Supabase Authentication and verified operator role.
- **Features:**
  - Real-time reservoir capacity gauge (%).
  - Gate position indicator (% and degrees).
  - High-speed remote commands via MQTT (<2s execution latency):
    - `OPEN_20`: Pre-emptive advisory release (20% / 36°).
    - `OPEN_50`: Emergency flood release (50% / 90° - Maximum allowed limit).
    - `CLOSE`: Gate 0% closed (0°).
    - `AUTO`: Returns control to ESP32 local state machine.
    - `ESTOP`: Emergency hardware immobilizer.
  - **Manual Watchdog Timer:** 300-second countdown; automatically restores autonomous mode if connection drops.
  - **Staged Pre-Warning SMS Trigger:** Dispatches pre-warning SMS via SIM800L module.
  - **Dual-Sensor Diagnostic Console:** Inspects individual distances for JSN-SR04T Sensor 1 and 2, delta difference, and mutual consensus.
  - **Emergency Contact Directory:** Register authority phone numbers to Supabase PostgreSQL for automated SIM800L emergency dispatch.

---

## 3. Public Advisory Portal (`mobile_apps/public_app`)
- **Target Audience:** Local farmers, residents, and businesses in downstream Puttalam basin.
- **Security:** **Login-Free**. Connects to `public_dam_status_view` via Supabase REST. Zero PII, zero operator controls exposed.
- **Features:**
  - Dynamic 4-stage color banners:
    - **Green:** NORMAL (<60%) — Gate Closed (0%)
    - **Yellow:** PRE-WARNING (60%–80%) — Gate Closed (0%)
    - **Orange:** CLEAR AREA (80%–85%) — Gate Advisory Open (20%)
    - **Red:** DANGER ($\ge 85\%$) — Gate Emergency Open (50%)
  - Trilingual Support: English, Sinhala (සිංහල), and Tamil (தமிழ்).
  - Hyperlocal Geolocation & Distance Calculation to Tabbowa Dam.
  - Live Open-Meteo Weather forecast for the Puttalam catchment basin.
  - One-tap emergency dial buttons (DMC 117, Police 119, Ambulance 1990).

---

## 4. Expo SDK 57 Setup & Installation

Both applications are configured with **Expo SDK 57**, **React Native 0.86**, and **React 19.2**.

### Install Dependencies for Operator Console:
```bash
cd mobile_apps/operator_app
npm install
```

### Install Dependencies for Public Advisory Portal:
```bash
cd mobile_apps/public_app
npm install
```

---

## 5. Running the Apps Locally (Development)

### Run Operator App:
```bash
cd mobile_apps/operator_app
npx expo start
```
- Press **`a`** to open in Android Emulator / connected device.
- Press **`i`** to open in iOS Simulator (macOS only).
- Press **`w`** to open in Web Browser.
- Scan the QR code with **Expo Go** on your physical iPhone or Android phone.

### Run Public App:
```bash
cd mobile_apps/public_app
npx expo start
```
- Press **`a`** for Android, **`i`** for iOS, or **`w`** for Web Browser.

---

## 6. Building Standalone Android APK & iOS App

Both applications include pre-configured `app.json` and `eas.json` profiles ready for EAS Build.

### Step 1: Install EAS CLI Globally (if not already installed)
```bash
npm install -g eas-cli
```

### Step 2: Log in to Expo Account
```bash
eas login
```

### Step 3: Build Standalone Android APK (Direct Installable File)
The `preview` profile is configured with `"buildType": "apk"` so it outputs a direct `.apk` file that you can install on any Android smartphone without Google Play:

```bash
# Build Operator Console APK
cd mobile_apps/operator_app
eas build -p android --profile preview

# Build Public Advisory Portal APK
cd mobile_apps/public_app
eas build -p android --profile preview
```
*Once the build finishes in the cloud, EAS CLI provides a direct URL to download the `.apk` file.*

### Step 4: Build iOS App
For iOS, the `preview` profile is configured for iOS Simulator builds:
```bash
# Build Operator Console for iOS Simulator
cd mobile_apps/operator_app
eas build -p ios --profile preview

# Build Public Advisory Portal for iOS Simulator
cd mobile_apps/public_app
eas build -p ios --profile preview
```
*To install on a physical iPhone, run `eas build -p ios --profile production` or connect your Apple Developer Team ID with ad-hoc internal distribution.*
