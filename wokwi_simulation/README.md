# SDAS Wokwi Hardware Simulation Environment

This folder contains a complete, self-contained **Wokwi online hardware simulation** for the **Smart Dam Alert System with Automated Gate Control (SDAS)**.

You can run and test the complete audited circuit, sensors, actuators, disaster state machine, safety watchdog, and live cloud telemetry in any web browser without needing physical hardware!

---

## 1. Components Simulated in Wokwi

| Component | Wokwi Model | ESP32 Pins | Function in Simulation |
|-----------|-------------|------------|------------------------|
| **Microcontroller** | `board-esp32-devkit-c-v4` | All | ESP32 DevKit V1 central processing node |
| **Ultrasonic Sensor 1** | `wokwi-hc-sr04` | Trig: **GPIO5**, Echo: **GPIO19** | Simulates JSN-SR04T #1 (Water level primary transducer) |
| **Ultrasonic Sensor 2** | `wokwi-hc-sr04` | Trig: **GPIO18**, Echo: **GPIO21** | Simulates JSN-SR04T #2 (Redundant plausibility verification) |
| **Environmental Sensor** | `wokwi-dht22` | Data: **GPIO4** | Dynamic temperature/humidity for acoustic velocity formula |
| **Sluice Gate Servo** | `wokwi-servo` | PWM: **GPIO25** | Simulates MG996R gate arm (0° = 0%, 54° = 30%, 90° = 50%) |
| **4-Tier Alert RGB LED** | `wokwi-rgb-led` (Common Anode) | R: **GPIO32**, G: **GPIO33**, B: **GPIO13** | Visual alert indicator (Green, Yellow, Orange, Red, Magenta) |
| **Audio Alarm / Siren** | `wokwi-buzzer` | Signal: **GPIO27** | Audible alarm with 4 distinct cadences driven via BC547 driver |
| **Manual OPEN Button** | `wokwi-pushbutton` (Green) | Signal: **GPIO14** $\rightarrow$ GND | Fully opens gate (100% / 180°) and activates MANUAL mode [Key: O] |
| **Manual CLOSE Button**| `wokwi-pushbutton` (Grey) | Signal: **GPIO26** $\rightarrow$ GND | Fully closes gate (0% / 0°) and activates MANUAL mode [Key: C] |
| **Emergency STOP Button**| `wokwi-pushbutton` (Red) | Signal: **GPIO22** $\rightarrow$ GND | Freezes gate position & triggers siren alarm [Key: S] |
| **Virtual Wi-Fi** | `Wokwi-GUEST` | Internal | Connects to live Render ML Cloud API |

---

## 2. How to Run in Wokwi (Step-by-Step)

### Option A: Run in Web Browser (Fastest - 1 Minute)

1. Open **[https://wokwi.com/projects/new/esp32](https://wokwi.com/projects/new/esp32)** in your browser.
2. In the top toolbar, click on the **`diagram.json`** tab:
   - Delete any existing code.
   - Copy the entire contents of [`wokwi_simulation/diagram.json`](diagram.json) and paste it into the tab.
3. Click on the **`sketch.ino`** tab:
   - Delete any existing code.
   - Copy the entire contents of [`wokwi_simulation/sketch.ino`](sketch.ino) and paste it into the tab.
4. Click on the **`Library Manager`** tab (or the **`+`** icon next to the file tabs):
   - Add the following libraries (or paste [`wokwi_simulation/libraries.txt`](libraries.txt)):
     - `ESP32Servo`
     - `DHT sensor library`
     - `ArduinoJson`
5. Click the green **Play (Start Simulation)** button at the top!
6. The ESP32 will boot, connect to Wokwi virtual Wi-Fi, and begin reading telemetry in the Serial Monitor.

---

### Option B: Run in VS Code with the Wokwi Extension

1. Install the **Wokwi Simulator** extension from the VS Code Marketplace.
2. Open this folder in VS Code.
3. Open `wokwi_simulation/diagram.json`.
4. Press `Ctrl + Shift + P` (or `F1`), type **Wokwi: Start Simulator**, and hit Enter.

---

## 3. Interactive Testing Guide & Scenarios

While the simulation is running, you can click on any component to adjust its values and watch the system respond in real time:

### Scenario 1: Normal Reservoir Baseline (< 60%)
- **How to test:** Click on **Sensor 1** and **Sensor 2** and set distance to **45 cm**.
- **Expected Behavior:**
  - Water Level $\approx 50.0\%$
  - Alert State: **NORMAL**
  - Gate Servo: **0% (0° - Closed)**
  - RGB LED: **Green**
  - Buzzer: **Silent**

### Scenario 2: Pre-Warning Advisory (60.0% – 79.9%)
- **How to test:** Set both ultrasonic sensors to **37 cm**.
- **Expected Behavior:**
  - Water Level $\approx 70.0\%$
  - Alert State: **PRE-WARNING**
  - Gate Servo: **0% (0° - Held closed to conserve agricultural water)**
  - RGB LED: **Yellow**
  - Buzzer: **Single periodic chirp**
  - Serial Console: Prints staged pre-warning SMS alert.

### Scenario 3: Automated Clear Area Gate Release (80.0% – 84.9%)
- **How to test:** Set both ultrasonic sensors to **32 cm**.
- **Expected Behavior:**
  - Water Level $\approx 82.5\%$
  - Alert State: **CLEAR AREA**
  - Gate Servo: **Smoothly opens to 30% (54°)**
  - RGB LED: **Orange / Amber**
  - Buzzer: **Pulsed warning (400ms ON / 400ms OFF)**

### Scenario 4: Critical Danger Flood Emergency ( $\ge$ 85%)
- **How to test:** Set both ultrasonic sensors to **28 cm**.
- **Expected Behavior:**
  - Water Level $\approx 92.5\%$
  - Alert State: **DANGER**
  - Gate Servo: **Smoothly opens to 50% (90° emergency flush)**
  - RGB LED: **Red**
  - Buzzer: **Continuous rapid siren (150ms ON / 100ms OFF)**
  - Serial Console: Simulated SIM800L dispatches emergency SMS to **Chief Irrigation Engineer**, **DMC**, and **Divisional Secretariat**.

### Scenario 5: Verifying 3% Hysteresis (Anti-Chatter)
- **How to test:** After entering **DANGER** ($\ge 85\%$), slide the distance back to **31.5 cm** (Level $\approx 83.7\%$).
- **Expected Behavior:**
  - The system **remains in DANGER** with the gate at 50% because the level has not dropped below the exit threshold ($85\% - 3\% = 82\%$).
  - Once distance is increased to **33 cm** (Level $< 82\%$), it safely transitions back to CLEAR AREA.

### Scenario 6: Sensor Divergence / Fault Detection (Plausibility Engine)
- **How to test:** Set **Sensor 1 to 25 cm** and **Sensor 2 to 45 cm** ($\Delta = 20\text{ cm} > 5\text{ cm}$).
- **Expected Behavior:**
  - Plausibility engine detects acoustic mismatch: `[WARNING] Sensor Divergence! (Delta=20.0cm > 5cm)`.
  - Enters **DEGRADED MODE**: selects the conservative fail-safe reading.
  - RGB LED: **Magenta / Purple** warning.

### Scenario 7: Manual Override & Safety Watchdog
- **How to test:**
  1. Click the **green OPEN button** (GPIO14 or press keyboard key **`O`**) $\rightarrow$ Sluice gate rotates to **FULL OPEN (100% / 180°)**, switches from `AUTO` to `MANUAL` mode.
  2. Click the **grey CLOSE button** (GPIO26 or press keyboard key **`C`**) $\rightarrow$ Sluice gate rotates to **FULL CLOSE (0% / 0°)**.
  3. Click the **red E-STOP button** (GPIO22 or press keyboard key **`S`**) $\rightarrow$ Sluice gate locks instantly in place and continuous emergency siren sounds. Press **`S`** again to safely release E-STOP.
  4. Leave the dam untouched for **60 seconds** $\rightarrow$ Watchdog safely expires and restores autonomous regulation (`MODE_AUTO`), setting the gate to match current water levels.
  5. **Serial Monitor Console:** You can also type `OPEN`, `CLOSE`, `30`, `50`, `100`, `AUTO`, or `STOP` into the Serial Monitor for instant testing!

### Scenario 8: Live Render AI Backend Sync
- **How to test:** Watch the Serial Monitor every 10 seconds.
- **Expected Behavior:**
  - ESP32 sends live telemetry over Wokwi virtual Wi-Fi to your Render server (`https://sdas-ml-backend.onrender.com/api/v1/telemetry-hook`).
  - Serial prints live AI feedback:
    ```text
    [CLOUD-AI] Telemetry Synchronized to Render Backend:
      > Autoencoder Anomaly Verdict : NOMINAL_HEALTHY
      > Random Forest Hazard Class  : NORMAL (Conf: 95.0%)
    ```

---

## 4. File Manifest

```
wokwi_simulation/
├── diagram.json      # Complete visual circuit diagram & wire connections
├── sketch.ino        # Full C++ firmware with FSM, acoustic math & actuators
├── wokwi.toml        # Wokwi project configuration
├── libraries.txt     # Required Arduino libraries for Wokwi
└── README.md         # This comprehensive simulation guide
```
