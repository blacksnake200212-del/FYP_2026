# SDAS ESP32 Firmware Guide & Compilation Instructions

## 1. Directory Structure

- `SDAS_ESP32_Firmware.ino`: Main Arduino setup and loop routines.
- `config.h`: Central hardware pin map, acoustic geometry, thresholds (60%, 80%, 85%, 3% hysteresis), and cloud credentials.
- `sensors.h` / `sensors.cpp`: Dual HC-SR04 alternating trigger logic (40 ms blanking), DHT22 temperature compensation, and plausibility voting.
- `actuators.h` / `actuators.cpp`: MG90S servo LEDC driver with smooth slew rate, balanced active-LOW RGB LED driver, and buzzer alarm generator.
- `state_machine.h` / `state_machine.cpp`: 4-tier alert finite state machine with 3% hysteresis, control modes (Emergency > Manual > Auto) and NVS flash persistence. Note: MANUAL mode is held until an AUTO command (no automatic 300 s revert, although `MANUAL_WATCHDOG_TIMEOUT_SEC` is defined in config.h).
- `gsm_modem.h` / `gsm_modem.cpp`: SIM800L hardware UART2 (RX=16, TX=17) driver, GPIO23 reset, and non-blocking staged SMS queue.
- `network_telemetry.h` / `network_telemetry.cpp`: Wi-Fi management, Supabase REST JSON poster, and MQTT command listener (<2s latency).

---

## 2. Compilation Prerequisites in Arduino IDE

1. **Board Package:**
   - Install **esp32 by Espressif Systems** via Board Manager (v2.0.14 or later).
   - Select Board: **DOIT ESP32 DEVKIT V1** (or ESP32 Dev Module).
   - Flash Frequency: 80 MHz, Upload Speed: 921600.
2. **Credentials (required):**
   - Copy `secrets.example.h` to `secrets.h` and enter your Wi-Fi name/password. The build stops with an error if `secrets.h` is missing. `secrets.h` is git-ignored, so it never reaches GitHub.
   - Optional: add `#define SDAS_DEVICE_KEY "..."` to `secrets.h` so the node texts the contacts saved in the dashboard / operator app (see `database/README.md` section 4). Without it the 4 numbers in `config.h` are used.
   - Remote commands come from the Supabase `commands` table. Commands on the public MQTT broker are ignored unless you set `MQTT_ACCEPT_COMMANDS 1` in `config.h` (not recommended: anyone can publish there).
   - Remote MANUAL / OPEN / CLOSE return to AUTO after `MANUAL_WATCHDOG_TIMEOUT_SEC` (300 s). Buttons and Serial commands are not timed.
3. **Library Dependencies:**
   - `PubSubClient` by Nick O'Leary (for MQTT communications).
   - Standard built-in ESP32 libraries: `WiFi`, `HTTPClient`, `Preferences`.
4. **Flashing Safeguard:**
   - **Disconnect the 12V power supply** before plugging the USB programming cable into the ESP32.
   - Do NOT power VIN and USB simultaneously.
