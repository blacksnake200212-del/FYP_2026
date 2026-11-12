# SDAS – Full Project Review and Fixes (12 Nov 2026)

Repository reviewed: `blacksnake200212-del/FYP_2026`, commit `46ad450` (8 Nov 2026).
36 files changed, 2 new files. Every change in the code is marked with a `FIX` comment.

## Merged with your local changes (12 Nov 2026, 14:00)
Three files on your PC were newer than GitHub. Your changes were **kept** and the fixes merged on top:
- `firmware/.../network_telemetry.cpp` + `.h`:
  - **Kept your changes:**
    - Wi-Fi hotspot reconnect/reset logic, Wi-Fi sleep off and connection logging;
    - 16 KB network task stack and heap checks before HTTPS;
    - `buildRestEndpoint()`, a fresh TLS client per request, and MQTT published first.
  - **Added:**
    - the command fixes (oldest-first, expiry, `type` field, never twice, MQTT/Supabase dedupe, test SMS, `MQTT_ACCEPT_COMMANDS`) and NTP time;
    - `null` temperature when the DHT22 fails, sent to both Supabase and MQTT;
    - sensor distances in the MQTT message.
- `web_dashboard/app.js`:
  - **Kept your changes:** live MQTT telemetry and your duplicate-row filter.
  - **Added:**
    - all dashboard fixes;
    - `null` temperature/humidity no longer shows "NaN";
    - the DHT card says "NO READING" instead of "ONLINE" when it has no data.

**Note:** the dashboard now also trusts telemetry from the public MQTT topic `dam/puttalam/telemetry`. Anyone can publish fake readings there, so the dashboard could show a fake level when Supabase is quiet. For the demo this is fine; for real use, put the broker behind a username/password.

**How the fixes were tested (no real ESP32 or phone was available):**

| Part | Test |
|---|---|
| ESP32 firmware | All 6 files compiled with `g++ -Wall` against stand-in Arduino/ESP32 headers (no errors or warnings). New parsing, phone-number checks and duplicate-command logic unit-tested. **Still needs a real Arduino IDE build and bench test.** |
| Database | `schema.sql`, `seed_data.sql`, `rls_hardening.sql` each run twice on PostgreSQL 16; permissions checked as `anon` and as a logged-in operator. |
| Web dashboard | Opened in headless Chromium with a simulated failed-sensor row; server checked with curl. |
| Mobile apps | Every `.js` file parsed with esbuild (syntax only; not run on a phone). |
| Apps Script | Run in Node with mocked Google services. |
| Diagram scripts | Both generators run; output checked visually. |
| ML backend | Python syntax checked. FastAPI/scikit-learn could not be installed here, so **run `python backend_ml/tests/test_api.py` yourself** after retraining. |

---

## 1. Do these first (in this order)

1. **Check `firmware/SDAS_ESP32_Firmware/secrets.h`** has your Wi-Fi details (yours was left untouched). The firmware refuses to compile without it.
2. Run the SQL files in Supabase → SQL Editor: `database/schema.sql`, then (after reading section 7) `database/rls_hardening.sql`.
3. **So the node texts the contacts saved in the apps:** add `#define SDAS_DEVICE_KEY "your-long-random-text"` to `secrets.h` and register the same text in Supabase (exact SQL in `database/README.md`, section 4).
4. **Flash the new firmware**, then check the Serial Monitor (see section 9). You should see `[CONTACTS] N SMS recipients loaded from Supabase.`
5. Paste the new `google_sheets/SDAS_GoogleSheets_Logger.gs` into Apps Script and **redeploy** (Deploy → Manage deployments → Edit → New version).
6. Retrain the ML models (section 6), then run the ML tests.
7. Rebuild both mobile apps.

---

## 2. ESP32 firmware (`firmware/SDAS_ESP32_Firmware/`)

### The cause of your −1 cm / 0% / "NORMAL" readings
In `sensors.cpp`, when an HC-SR04 returned **no echo** (−1), the code replaced it with 50 cm and marked the sensor **valid**. 50 cm from a sensor mounted 50 cm above the floor means **"tank empty, 0%"**. So:
- two disconnected or unpowered sensors reported "0%, NORMAL, sensors agree" (exactly what your CSV shows);
- if the water rose into the sensor's blind zone, the tank was reported **empty** and AUTO mode **closed the gate** at the worst moment.

| # | File | Problem | Fix |
|---|---|---|---|
| 1 | `sensors.cpp` | No echo treated as "empty tank" (above) | No echo = sensor invalid. Both invalid for 3 cycles (6 s) = **SENSOR FAULT** (alert state 4, blue LED, gate holds, one SMS). Fault reported at once if there has never been a good reading since boot (so a reboot can't close an open gate). |
| 2 | `sensors.cpp` | Water inside the 2–3 cm blind zone gave "no reading" | 2 of 3 blind-zone echoes = **100% full** (what `config.h` already promised). |
| 3 | `sensors.cpp`, `network_telemetry.cpp` | DHT22 starts at 28 °C / 75 % and keeps those values forever if reads fail; they were uploaded as real | New `dht_valid` flag; after 30 s with no good read, `null` is sent (dashboard shows `--` and a DHT fault). |
| 4 | `network_telemetry.cpp` | Every dashboard command arrives by MQTT **and** from Supabase, and both copies ran: **every SMS broadcast was sent twice**, "RGB" toggled twice (no change) | Supabase copy of a command already received by MQTT within 15 s is marked done but not run again. |
| 5 | `network_telemetry.cpp` | Supabase commands ran **newest first**: OPEN_50 then CLOSE → CLOSE ran first, OPEN_50 later, gate left **open** | Oldest first. |
| 6 | `network_telemetry.cpp` | `expires_at` ignored: a command queued while the node was offline ran hours later | Clock synced with NTP; expired commands skipped. |
| 7 | `network_telemetry.cpp` | Command type found by searching the whole row text (params include words like "OPERATOR", "AUTO") | Reads the `type` field. Unknown types marked `REJECTED`. |
| 8 | `network_telemetry.cpp` | If marking a command EXECUTED failed, it ran again every 5 s (e.g. SMS every 5 s) | The same command id is never executed twice. |
| 9 | `.ino` | Remote commands ran on the network core (Core 0) while `loop()` used the same objects on Core 1, with no lock; RGB toggle blocked the network 750 ms | Commands are queued and executed in `loop()` on Core 1. |
| 10 | `.ino`, `network_telemetry.cpp` | Dashboard "Ping"/"Test SMS" sent `PREWARN_SMS`, a **real flood pre-warning to all 4 numbers** | New `TEST_SMS` / `TEST_SMS:+94…` command sends a clearly labelled test text (one number or all). Phone numbers validated. |
| 11 | `gsm_modem.cpp` | With no cell signal and an SMS waiting, an 800 ms blocking check ran on **every loop pass**, freezing the servo, LEDs and the **physical E-STOP button** | Checked every 5 s instead. |
| 12 | `state_machine.cpp` | A loose sensor wire flickering OK/fault sent a fault SMS to all 4 numbers on every flicker | At most one fault SMS per 30 min. |
| 13 | `state_machine.cpp` | After a fault, the stage reset to NORMAL; because fault = 4 and DANGER = 3, returning to DANGER **sent no DANGER SMS** | Real stage evaluated at once; recovery compared against NORMAL so the SMS is sent. |
| 14 | `actuators.cpp` | `MUTE` was saved to flash, so the danger siren stayed silent after every reboot | Mute lasts until reboot; old saved mute is cleared. |
| 15 | `.ino` | `STATUS` always printed 0.0% in live mode; boot message said "JSN-SR04T" | Fixed. |
| 16 | `config.h`, `secrets.example.h` | Wi-Fi name/password in the public repo | Removed; build stops with a clear message if `secrets.h` is missing. |

### Second round ("fix all") – the items that were left as decisions are now fixed
| # | File | Problem | Fix |
|---|---|---|---|
| 17 | `config.h` | Anyone on the public broker `broker.emqx.io` could publish `OPEN_50` or `ESTOP` to `dam/puttalam/commands` | `MQTT_ACCEPT_COMMANDS` is now **0**: commands come only from Supabase (about 5 s delay). The dashboard no longer publishes commands to MQTT. |
| 18 | `.ino`, `state_machine.cpp` | MANUAL mode never timed out and survived reboots, so AUTO flood control could stay off forever | Remote MANUAL / OPEN / CLOSE return to AUTO after **300 s** (`MANUAL_WATCHDOG_TIMEOUT_SEC`), and so does a MANUAL mode restored after a reboot. Physical buttons and Serial commands are not timed. |
| 19 | `gsm_modem.*`, `network_telemetry.*`, `.ino`, `schema.sql` | SMS went only to the 4 numbers in `config.h`; contacts saved in the dashboard/app were never texted | The node downloads up to 10 opted-in numbers from Supabase every 10 minutes through a key-protected function (`get_sms_recipients`). The public anon key still cannot read phone numbers. If the download fails or no key is set, the `config.h` numbers are used. |
| – | | `setInsecure()` disables HTTPS certificate checks | Left as is (fine for a prototype; mention it in the viva). |

---

## 3. Web dashboard (`web_dashboard/`)
Same fixes as the first review (duplicate rows every 3 s, failed PIN-session commands, slider sending 50% for 30%, "Ping" alerting everyone, contact delete, fake success messages, chart lines, server port loop, server exposing every file). Additionally:
- Test SMS uses `test_only` / `target_phone` in Supabase (and `TEST_SMS` / `TEST_SMS:+94…` over MQTT if you ever re-enable MQTT commands).
- **Quick-Fill button removed** (it contained a real password).
- Contact messages now say the node picks up new contacts within 10 minutes (needs the device key).
- Commands are no longer published to the public MQTT broker (the node ignores them by default). The status says "node picks it up within ~5 s".
- The LIVE badge says "via MQTT (unverified)" when the newest reading came from the public MQTT topic instead of Supabase.
- Manual buttons explain the 5-minute return to AUTO.

## 4. Operator app (`mobile_apps/operator_app/`)
| Problem | Fix |
|---|---|
| **Login let anyone in.** A wrong password was still accepted if the email contained "operator", "admin", "kantalai", "tabbowa" or "sltc.ac.lk", and the error branch accepted **any email with a 4+ character password** | Wrong passwords always rejected (`LoginScreen.js`). |
| Gate commands showed "transmitted to ESP32" even when the insert failed (Supabase returns `{error}`, it doesn't throw) | New `src/commandService.js` checks the result; screens show "Command NOT Sent" on failure. |
| Gate Control commands expired after **10 s** (can expire before the node's 5 s poll if phone/ESP32 clocks differ) | 5 minutes, same as the dashboard. |
| E-STOP displayed the gate as closed (0%); E-STOP freezes it in place | Display fixed. |
| Contacts "Send alert" said "Dispatched" though nothing reads `sms_jobs`, and published a **"CRITICAL DANGER" alert at a made-up 68%** on the public timeline | Honest message (use "Open Native SMS" to actually send); public alert uses the real latest stage and level. |
| Contact delete ignored database errors | Error shown. |

`AlertsSMSScreen.js` and `HoldButton.js` are not used anywhere. AlertsSMSScreen faked a "BROADCAST DELIVERED (6)" result and logged a made-up 81.5% level; it now sends a real `PREWARN_SMS` command to the node, reports failures, and no longer invents numbers. Contacts screen text updated for the new SMS sync.

## 5. Public app (`mobile_apps/public_app/`)
| Problem | Fix |
|---|---|
| Home status card had no **CLEAR AREA** stage (80–85%, "evacuate riverbanks" showed as "Pre-Warning") | Added. |
| **Sensor fault and offline/old data showed green "No danger at the moment"** (what residents would see now) | Shows "Sensor Check in Progress" / "Status Not Live … follow local authorities (DMC 117)". |
| Flood report "add photo" attached a **stock internet photo** of another flood; depth always "0.5 m", distance always "2.4 km"; failed sends said "Report Sent" | No fake photo/depth/distance; failures say "Report NOT Sent… call 117". |
| Wind 12 km/h and rain 20% were hard-coded and shown as weather | Shows `--`. |

| "Change location" only toggled between two fixed place names; reports had no real location | The citizen types the village/road/landmark (required); stored as "typed by citizen, no GPS". The app has no GPS permission yet (add `expo-location` later). After sending, the app returns to Home. |

## 6. ML backend (`backend_ml/`)
| Problem | Fix |
|---|---|
| Training data assumed the sensor at **65 cm**; the real tank/firmware use **50 cm** | Generator and service use 50 cm. **You must retrain:** run the 4 commands in `backend_ml/README.md` section 3. |
| Two dead sensors (−1/−1) reported "NOMINAL_HEALTHY … safe for automated gate regulation" | Reported as `BOTH_SENSORS_NO_ECHO`. |
| Empty history list crashed `/api/v1/forecast` (HTTP 500) | Fixed. |
| Risk classifier crashes if the model lacks a class | Uses `rf.classes_`. |
| Advice said CLEAR AREA opens 30%; firmware uses 20% | Fixed. |
| `scikit-learn>=1.4` but the saved models are 1.9.1 (Render could install a version that can't load them); `paho-mqtt` unused | Pinned to 1.9.1; paho removed. |
| Tests | Nominal test updated to 50 cm; 2 new tests (dead sensors, empty history). |

**For the viva:**
- **"LSTM" naming:** `train_lstm.py` is really scikit-learn's `MLPRegressor`, not an LSTM, so describe it accurately.
- **F1 = 1.00:** the Random Forest's label is computed directly from `water_level_pct`, which is also an input. That's why it scores F1 = 1.00, so present it as a rule-learning check, not a strong result.
- **Webhook rate:** `/telemetry-hook` uses a fixed rate of change (0.05).

## 7. Database (`database/`)
- `schema.sql`: allows `MANUAL`, `SENSOR_2`, `RGB` commands (they were rejected); upgrades older tables; contacts no longer duplicated on re-run.
- `seed_data.sql`: no duplicate phone numbers (each phone could get every alert twice).
- **New `rls_hardening.sql`:** today the public anon key (in every app) can read operator emails and phone numbers, insert gate commands, delete contacts, edit dam limits and sign up as ADMIN. This file closes that and keeps the ESP32 working (insert readings, read commands, update command status only). **Step B is safe for the firmware:** it reads contacts only through the key-protected `get_sms_recipients` function (section 21 of `schema.sql`), which still works after hardening. After it, the dashboard's Master-PIN login can't send commands (use a real account). Re-run it after every `schema.sql`.
- `README.md`: the "AES-GCM encrypted" claim was false (`enc_aes256_` is just text); corrected. New section 4 explains the device key.
- **New in `schema.sql` (section 21):** `private.device_keys` table (only key hashes, not readable by the apps) and `get_sms_recipients(p_key)`. Tested on PostgreSQL: wrong key returns nothing; right key returns the opted-in numbers without duplicates, tier 1 first, max 10; `anon` cannot read the private table.

## 8. Other files
- **Apps Script:** wrote numeric codes (e.g. `3`) as the alert stage, mislabelled alert 0 / mode 0, ignored the lock result, wrote "YES" agreement for two dead sensors. All fixed. **Redeploy needed.**
- **`tools/sync_readings_to_sheets.js`:** Supabase errors hidden; the webhook upload was an empty stub; unknown mode written as ESTOP, unknown alert as NORMAL. Fixed.
- **Diagram scripts:** Windows-only fonts and `C:\Users\adria\.gemini` paths, text overflow and word-order bug, MG996R label. Fixed; output now saved into `hardware_docs/`.
- **Master schematic / XL4015 guide (second round):** pre-warning shown as 75% → **60%** (matches firmware); E-STOP described as a "< 1 ms hardware interrupt" → it is a debounced software poll (stops the servo on the next control cycle); **fuse 5 A → 3 A**, because the 1N5408 reverse-polarity diode behind it is rated 3 A. The images in `hardware_docs/` were regenerated.
- **Docs:** Blueprint thresholds, firmware README (wrong sensor/servo, non-existent watchdog), database README.

**Wokwi simulation (`wokwi_simulation/`):** now uses the **50 cm** mount, the **MG90S** label, the 20% clear-area gate, and **no echo on both sensors = SENSOR FAULT** (was "empty tank"). Recovery from a fault goes to the real stage. README test distances recalculated for 50 cm (e.g. 22 cm = 70% pre-warning, 13 cm = 92.5% danger). It is still a simpler demo sketch (60 s manual timeout, magenta fault LED), not the production firmware.

---

## 9. Checking the hardware after flashing
Open the Serial Monitor at 115200 baud:
1. `PING` shows raw echo times for both sensors. **TIMEOUT** on both means power/wiring:
   - HC-SR04 VCC must be 5 V;
   - the level shifter needs HV = 5 V, LV = 3.3 V and **GND on both sides**;
   - Echo1 → LV2 → GPIO19 and Echo2 → LV4 → GPIO21;
   - Trig can go straight to GPIO5/18.
2. With both sensors disconnected you should now see State 4 (SENSOR FAULT) and a **blue** LED, never "0% NORMAL".
3. Hold a flat object 20 cm under the sensors: level ≈ (50 − 20) / 40 = 75%.
4. `STATUS` shows the live level and modem state. `DIAG` checks the SIM800L.
5. Dashboard "Ping" on one contact → only that number gets a message starting "SDAS TEST".
6. Send OPEN_50 then CLOSE quickly from the dashboard → the gate must end **closed**.
7. Send MANUAL from the dashboard → after 5 minutes the Serial Monitor shows the return to AUTO.
8. Add a test number in the dashboard, wait up to 10 minutes (or reboot the node), then "Test SMS" to all → the new number should get the test text.
