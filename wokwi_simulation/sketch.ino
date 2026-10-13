// ============================================================================
// SMART DAM ALERT SYSTEM WITH AUTOMATED GATE CONTROL (SDAS)
// Wokwi Hardware Simulation Firmware V2.1 (Optimized for Interactive Testing)
// Audited Hardware Blueprint & Pinout for ESP32 DevKit V1
// Lead Authors: Dias Adrian, AAA Aadhil, JMRA Dilshan
// Faculty of Computing and IT, SLTC Research University
// ============================================================================

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include <DHT.h>

// ----------------------------------------------------------------------------
// PIN CONFIGURATION (Audited Blueprint V2.0)
// ----------------------------------------------------------------------------
#define PIN_TRIG_1           5     // JSN-SR04T #1 Trigger
#define PIN_ECHO_1           19    // JSN-SR04T #1 Echo
#define PIN_TRIG_2           18    // JSN-SR04T #2 Trigger
#define PIN_ECHO_2           21    // JSN-SR04T #2 Echo

#define PIN_DHT              4     // DHT22 Ambient Sensor (Temp/Humidity)
#define DHTTYPE              DHT22

#define PIN_SERVO            25    // MG996R Sluice Gate Servo PWM
#define PIN_BUZZER           27    // BC547 Driven 5V Buzzer

#define PIN_LED_RED          32    // RGB LED - Red Cathode (Active LOW)
#define PIN_LED_GREEN        33    // RGB LED - Green Cathode (Active LOW)
#define PIN_LED_BLUE         13    // RGB LED - Blue Cathode (Active LOW)

#define PIN_BTN_OPEN         14    // Manual OPEN Button (Active LOW)
#define PIN_BTN_CLOSE        26    // Manual CLOSE Button (Active LOW)
#define PIN_BTN_STOP         22    // Emergency E-STOP Button (Active LOW)

// ----------------------------------------------------------------------------
// TANK GEOMETRY & HYDRAULIC THRESHOLDS
// ----------------------------------------------------------------------------
const float SENSOR_MOUNT_HEIGHT_CM = 65.0f; // Sensor to tank floor
const float TANK_MAX_DEPTH_CM      = 40.0f; // Max usable depth (100% full)
const float SENSOR_MAX_DELTA_CM    = 5.0f;  // Plausibility divergence threshold

// 4-Tier Disaster Alert Percentages
// Level >= 85%  -> DANGER (Gate opens to 50% / 90 deg)
// Level >= 80%  -> CLEAR AREA (Gate opens to 30% / 54 deg)
// Level >= 60%  -> PRE-WARNING (Gate held closed 0% to conserve water)
// Level < 60%   -> NORMAL (Gate closed 0%)
const float THRESH_NORMAL_PCT      = 60.0f;
const float THRESH_PREWARN_PCT     = 60.0f;
const float THRESH_CLEARAREA_PCT   = 80.0f;
const float THRESH_DANGER_PCT      = 85.0f;

// 3% Hysteresis Margins (Prevents rapid flapping)
const float HYSTERESIS_PCT         = 3.0f;
const float EXIT_PREWARN_PCT       = (THRESH_PREWARN_PCT - HYSTERESIS_PCT);    // 57.0%
const float EXIT_CLEARAREA_PCT     = (THRESH_CLEARAREA_PCT - HYSTERESIS_PCT);  // 77.0%
const float EXIT_DANGER_PCT        = (THRESH_DANGER_PCT - HYSTERESIS_PCT);     // 82.0%

// Sluice Gate Positions (% and Servo Degrees)
const int GATE_PCT_CLOSED          = 0;
const int GATE_PCT_CLEAR_AREA      = 30;   // 30% release (54 deg)
const int GATE_PCT_DANGER          = 50;   // 50% emergency release (90 deg)
const int GATE_PCT_FULL_OPEN       = 100;  // 100% full flush (180 deg)

// Watchdog Timeout (reverts to AUTO after 30s in simulation)
const unsigned long MANUAL_WATCHDOG_MS = 30000;

// ----------------------------------------------------------------------------
// ENUMS & STATE STRUCTURES
// ----------------------------------------------------------------------------
enum AlertState {
    STATE_NORMAL,
    STATE_PRE_WARNING,
    STATE_CLEAR_AREA,
    STATE_DANGER,
    STATE_SENSOR_FAULT
};

enum ControlMode {
    MODE_AUTO,
    MODE_MANUAL,
    MODE_EMERGENCY
};

enum BuzzerCadence {
    BUZZ_OFF,
    BUZZ_CHIRP,
    BUZZ_PULSE,
    BUZZ_SIREN
};

// ----------------------------------------------------------------------------
// GLOBAL OBJECTS & STATE VARIABLES
// ----------------------------------------------------------------------------
DHT dht(PIN_DHT, DHTTYPE);
Servo gateServo;

AlertState    currentAlertState    = STATE_NORMAL;
AlertState    previousAlertState   = STATE_NORMAL;
ControlMode   currentControlMode   = MODE_AUTO;
BuzzerCadence currentBuzzerCadence = BUZZ_OFF;

float currentWaterLevelPct = 0.0f;
float currentTempC         = 28.5f;
float currentHumidityPct   = 75.0f;
float sensor1DistCm        = 45.0f;
float sensor2DistCm        = 45.0f;
bool  sensorsAgreed        = true;
bool  degradedModeActive   = false;

int   targetGatePercent    = 0;
int   actualGatePercent    = 0;
float currentServoAngle    = 0.0f;
float targetServoAngle     = 0.0f;

unsigned long lastSensorSampleMs   = 0;
unsigned long lastTelemetrySyncMs  = 0;
unsigned long lastBuzzerToggleMs   = 0;
unsigned long manualModeTimeoutMs  = 0;
bool          buzzerOutputState    = false;

// Emergency Contacts for SMS Dispatch
const char* CONTACT_OPERATOR = "+94771234567";
const char* CONTACT_DMC      = "+94112670002";
const char* CONTACT_DS       = "+94322263223";

// Live Render ML Backend
const char* CLOUD_TELEMETRY_URL = "https://sdas-ml-backend.onrender.com/api/v1/telemetry-hook";

// ----------------------------------------------------------------------------
// HARDWARE DRIVER FUNCTIONS
// ----------------------------------------------------------------------------

// Active-LOW RGB LED Helper for Common Anode
void setRGB(bool red, bool green, bool blue) {
    digitalWrite(PIN_LED_RED,   red   ? LOW : HIGH);
    digitalWrite(PIN_LED_GREEN, green ? LOW : HIGH);
    digitalWrite(PIN_LED_BLUE,  blue  ? LOW : HIGH);
}

void updateAlertLED(AlertState state) {
    switch (state) {
        case STATE_NORMAL:
            setRGB(false, true, false);  // Pure Green
            break;
        case STATE_PRE_WARNING:
            setRGB(true, true, false);   // Yellow (Red + Green)
            break;
        case STATE_CLEAR_AREA:
            setRGB(true, true, false);   // Orange / Amber
            break;
        case STATE_DANGER:
            setRGB(true, false, false);  // Pure Red
            break;
        case STATE_SENSOR_FAULT:
            setRGB(true, false, true);   // Magenta (Red + Blue)
            break;
    }
}

// Ultrasonic Pulse Measurement with Acoustic Velocity Compensation
float measureAcousticDistance(uint8_t trigPin, uint8_t echoPin, float soundSpeedMps) {
    digitalWrite(trigPin, LOW);
    delayMicroseconds(2);
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(10);
    digitalWrite(trigPin, LOW);

    long durationUs = pulseIn(echoPin, HIGH, 50000); // 50ms timeout (~8.5m)
    if (durationUs <= 0) return 65.0f; // Default to tank baseline if no echo

    // Distance = (Velocity * time) / 2
    // Velocity in m/s -> cm/us = (m/s) / 10,000
    float distanceCm = ((float)durationUs * soundSpeedMps) / 20000.0f;
    return distanceCm;
}

// Servo Gate Actuation with Immediate Visual Feedback
void applyGatePosition(int percent) {
    targetGatePercent = constrain(percent, 0, 100);
    targetServoAngle = ((float)targetGatePercent / 100.0f) * 180.0f;
    gateServo.write((int)targetServoAngle);
    actualGatePercent = targetGatePercent;
    currentServoAngle = targetServoAngle;
}

// Buzzer Cadence Driver
void updateBuzzer(unsigned long now) {
    switch (currentBuzzerCadence) {
        case BUZZ_OFF:
            digitalWrite(PIN_BUZZER, LOW);
            buzzerOutputState = false;
            break;

        case BUZZ_CHIRP:
            // Single 100ms chirp every 4000ms
            if ((now % 4000) < 100) {
                digitalWrite(PIN_BUZZER, HIGH);
            } else {
                digitalWrite(PIN_BUZZER, LOW);
            }
            break;

        case BUZZ_PULSE:
            // Intermittent warning: 400ms ON / 400ms OFF
            if (now - lastBuzzerToggleMs >= 400) {
                lastBuzzerToggleMs = now;
                buzzerOutputState = !buzzerOutputState;
                digitalWrite(PIN_BUZZER, buzzerOutputState ? HIGH : LOW);
            }
            break;

        case BUZZ_SIREN:
            // Rapid emergency siren: 150ms ON / 100ms OFF
            unsigned long phase = now % 250;
            if (phase < 150) {
                digitalWrite(PIN_BUZZER, HIGH);
            } else {
                digitalWrite(PIN_BUZZER, LOW);
            }
            break;
    }
}

// Simulated SIM800L SMS Dispatch
void dispatchEmergencySMS(const char* recipient, const char* message) {
    Serial.println("\n---------------------------------------------------------");
    Serial.printf("[GSM-MODEM] AT+CMGS=\"%s\"\n", recipient);
    Serial.printf("[GSM-MODEM] > %s\n", message);
    Serial.println("[GSM-MODEM] SMS DISPATCHED SUCCESSFULLY [OK]");
    Serial.println("---------------------------------------------------------");
}

void broadcastAlertSms(AlertState state, float levelPct) {
    char msg[160];
    if (state == STATE_DANGER) {
        snprintf(msg, sizeof(msg),
            "CRITICAL DANGER: Tabbowa Dam reservoir at %.1f%%. Auto-gate opened to 50%%. Initiate riverbank evacuation!",
            levelPct);
        dispatchEmergencySMS(CONTACT_OPERATOR, msg);
        dispatchEmergencySMS(CONTACT_DMC, msg);
        dispatchEmergencySMS(CONTACT_DS, msg);
    } else if (state == STATE_PRE_WARNING) {
        snprintf(msg, sizeof(msg),
            "SDAS ADVISORY: Tabbowa Dam at %.1f%%. Pre-warning threshold reached. Gate held closed to conserve water.",
            levelPct);
        dispatchEmergencySMS(CONTACT_OPERATOR, msg);
    }
}

// ----------------------------------------------------------------------------
// DISASTER FINITE STATE MACHINE (FSM) WITH 3% HYSTERESIS
// ----------------------------------------------------------------------------
void evaluateStateMachine(float levelPct) {
    if (currentControlMode == MODE_EMERGENCY) {
        currentBuzzerCadence = BUZZ_SIREN;
        updateAlertLED(STATE_DANGER);
        return;
    }

    AlertState nextState = currentAlertState;

    // FSM State Transition Logic with 3% Hysteresis
    switch (currentAlertState) {
        case STATE_NORMAL:
            if (levelPct >= THRESH_DANGER_PCT) {
                nextState = STATE_DANGER;
            } else if (levelPct >= THRESH_CLEARAREA_PCT) {
                nextState = STATE_CLEAR_AREA;
            } else if (levelPct >= THRESH_PREWARN_PCT) {
                nextState = STATE_PRE_WARNING;
            }
            break;

        case STATE_PRE_WARNING:
            if (levelPct >= THRESH_DANGER_PCT) {
                nextState = STATE_DANGER;
            } else if (levelPct >= THRESH_CLEARAREA_PCT) {
                nextState = STATE_CLEAR_AREA;
            } else if (levelPct < EXIT_PREWARN_PCT) {
                nextState = STATE_NORMAL;
            }
            break;

        case STATE_CLEAR_AREA:
            if (levelPct >= THRESH_DANGER_PCT) {
                nextState = STATE_DANGER;
            } else if (levelPct < EXIT_CLEARAREA_PCT) {
                nextState = (levelPct >= THRESH_PREWARN_PCT) ? STATE_PRE_WARNING : STATE_NORMAL;
            }
            break;

        case STATE_DANGER:
            if (levelPct < EXIT_DANGER_PCT) {
                nextState = (levelPct >= THRESH_CLEARAREA_PCT) ? STATE_CLEAR_AREA : STATE_PRE_WARNING;
            }
            break;

        case STATE_SENSOR_FAULT:
            if (levelPct >= THRESH_DANGER_PCT) {
                nextState = STATE_DANGER;
            } else if (levelPct >= THRESH_CLEARAREA_PCT) {
                nextState = STATE_CLEAR_AREA;
            } else {
                nextState = STATE_NORMAL;
            }
            break;
    }

    // State Entry Actions & Automatic Gate Actuation
    if (nextState != currentAlertState) {
        Serial.printf("\n[FSM] State Transition: %d -> %d (Level: %.1f%%)\n",
            currentAlertState, nextState, levelPct);
        
        previousAlertState = currentAlertState;
        currentAlertState  = nextState;

        if (currentControlMode == MODE_AUTO) {
            switch (currentAlertState) {
                case STATE_NORMAL:
                    applyGatePosition(GATE_PCT_CLOSED);
                    currentBuzzerCadence = BUZZ_OFF;
                    Serial.println(">>> GATE CLOSED (0% - Normal Level) <<<");
                    break;

                case STATE_PRE_WARNING:
                    applyGatePosition(GATE_PCT_CLOSED); // Conserve water
                    currentBuzzerCadence = BUZZ_CHIRP;
                    broadcastAlertSms(STATE_PRE_WARNING, levelPct);
                    Serial.println(">>> PRE-WARNING ACTIVE: Gate Held Closed (0%) to Conserve Water <<<");
                    break;

                case STATE_CLEAR_AREA:
                    applyGatePosition(GATE_PCT_CLEAR_AREA); // 30% gate release
                    currentBuzzerCadence = BUZZ_PULSE;
                    Serial.println("\n*******************************************************");
                    Serial.println(">>> GATE OPENED TO 30% (CLEAR AREA WARNING - 54 deg) <<<");
                    Serial.println("*******************************************************");
                    break;

                case STATE_DANGER:
                    applyGatePosition(GATE_PCT_DANGER); // 50% emergency release
                    currentBuzzerCadence = BUZZ_SIREN;
                    broadcastAlertSms(STATE_DANGER, levelPct);
                    Serial.println("\n*******************************************************");
                    Serial.println(">>> CRITICAL DANGER! GATE OPENED TO 50% (90 deg) <<<");
                    Serial.println("*******************************************************");
                    break;

                case STATE_SENSOR_FAULT:
                    applyGatePosition(GATE_PCT_CLOSED);
                    currentBuzzerCadence = BUZZ_PULSE;
                    break;
            }
        }
    }

    if (degradedModeActive && currentAlertState != STATE_DANGER && currentAlertState != STATE_CLEAR_AREA) {
        updateAlertLED(STATE_SENSOR_FAULT);
    } else {
        updateAlertLED(currentAlertState);
    }
}

// ----------------------------------------------------------------------------
// CLOUD TELEMETRY & AI INFERENCE SYNCHRONIZATION
// ----------------------------------------------------------------------------
void syncCloudTelemetry() {
    if (WiFi.status() != WL_CONNECTED) return;

    WiFiClientSecure client;
    client.setInsecure(); // Bypass SSL verification in simulation
    HTTPClient http;
    http.setTimeout(1500); // Fast non-blocking timeout

    if (http.begin(client, CLOUD_TELEMETRY_URL)) {
        http.addHeader("Content-Type", "application/json");

        StaticJsonDocument<256> doc;
        doc["water_level_pct"]   = round(currentWaterLevelPct * 10.0f) / 10.0f;
        doc["sensor_1_dist_cm"]  = round(sensor1DistCm * 10.0f) / 10.0f;
        doc["sensor_2_dist_cm"]  = round(sensor2DistCm * 10.0f) / 10.0f;
        doc["temperature_c"]     = round(currentTempC * 10.0f) / 10.0f;
        doc["humidity_pct"]      = round(currentHumidityPct * 10.0f) / 10.0f;
        doc["gate_percent"]      = actualGatePercent;
        doc["rainfall_mm"]       = 0.0;

        String requestBody;
        serializeJson(doc, requestBody);

        int httpCode = http.POST(requestBody);
        if (httpCode == 200) {
            String response = http.getString();
            StaticJsonDocument<512> resDoc;
            deserializeJson(resDoc, response);

            Serial.println("\n[CLOUD-AI] Telemetry Synchronized to Render Backend:");
            const char* verdict = resDoc["anomaly_analysis"]["anomaly_verdict"];
            const char* risk    = resDoc["risk_classification"]["hazard_label"];
            float conf          = resDoc["risk_classification"]["confidence_score"];

            Serial.printf("  > Autoencoder Anomaly Verdict : %s\n", verdict ? verdict : "OK");
            Serial.printf("  > Random Forest Hazard Class  : %s (Conf: %.1f%%)\n", risk ? risk : "NORMAL", conf * 100.0f);
        }
        http.end();
    }
}

// ----------------------------------------------------------------------------
// MANUAL BUTTONS & SAFETY WATCHDOG
// ----------------------------------------------------------------------------
void handleButtons() {
    // 1. Emergency STOP (GPIO22)
    if (digitalRead(PIN_BTN_STOP) == LOW) {
        delay(30); // Software debounce
        if (digitalRead(PIN_BTN_STOP) == LOW) {
            currentControlMode = MODE_EMERGENCY;
            Serial.println("\n[CRITICAL] EMERGENCY STOP BUTTON PRESSED! Gate Locked in Position.");
            currentBuzzerCadence = BUZZ_SIREN;
            return;
        }
    }

    if (currentControlMode == MODE_EMERGENCY) return;

    // 2. Manual OPEN Button (GPIO14)
    if (digitalRead(PIN_BTN_OPEN) == LOW) {
        delay(30);
        if (digitalRead(PIN_BTN_OPEN) == LOW) {
            currentControlMode = MODE_MANUAL;
            manualModeTimeoutMs = millis() + MANUAL_WATCHDOG_MS;
            int newGate = min(100, actualGatePercent + 10);
            applyGatePosition(newGate);
            Serial.printf("[MANUAL] OPEN Pressed -> Target Gate: %d%% (Servo: %d deg)\n", actualGatePercent, (int)currentServoAngle);
            delay(150);
        }
    }

    // 3. Manual CLOSE Button (GPIO26)
    if (digitalRead(PIN_BTN_CLOSE) == LOW) {
        delay(30);
        if (digitalRead(PIN_BTN_CLOSE) == LOW) {
            currentControlMode = MODE_MANUAL;
            manualModeTimeoutMs = millis() + MANUAL_WATCHDOG_MS;
            int newGate = max(0, actualGatePercent - 10);
            applyGatePosition(newGate);
            Serial.printf("[MANUAL] CLOSE Pressed -> Target Gate: %d%% (Servo: %d deg)\n", actualGatePercent, (int)currentServoAngle);
            delay(150);
        }
    }

    // 4. Manual Mode Safety Watchdog
    if (currentControlMode == MODE_MANUAL) {
        if (millis() > manualModeTimeoutMs) {
            Serial.println("\n[WATCHDOG] Manual override timed out (30s). Reverting to autonomous regulation.");
            currentControlMode = MODE_AUTO;
            evaluateStateMachine(currentWaterLevelPct);
        }
    }
}

// ----------------------------------------------------------------------------
// ARDUINO SETUP & INITIALIZATION
// ----------------------------------------------------------------------------
void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println("\n=======================================================");
    Serial.println("  SMART DAM ALERT SYSTEM (SDAS) - WOKWI SIMULATOR V2.1");
    Serial.println("  Target Hardware: ESP32 DevKit V1 | Blueprint V2.0");
    Serial.println("=======================================================");

    // 1. Actuators & Indicators Setup
    pinMode(PIN_LED_RED,   OUTPUT);
    pinMode(PIN_LED_GREEN, OUTPUT);
    pinMode(PIN_LED_BLUE,  OUTPUT);
    setRGB(false, false, false);

    pinMode(PIN_BUZZER, OUTPUT);
    digitalWrite(PIN_BUZZER, LOW);

    // Standard ESP32Servo Setup
    ESP32PWM::allocateTimer(0);
    ESP32PWM::allocateTimer(1);
    ESP32PWM::allocateTimer(2);
    ESP32PWM::allocateTimer(3);
    gateServo.setPeriodHertz(50);
    gateServo.attach(PIN_SERVO, 500, 2400);
    applyGatePosition(0);

    // 2. Sensors Setup
    pinMode(PIN_TRIG_1, OUTPUT);
    pinMode(PIN_ECHO_1, INPUT);
    pinMode(PIN_TRIG_2, OUTPUT);
    pinMode(PIN_ECHO_2, INPUT);
    dht.begin();

    // 3. Manual Buttons Setup
    pinMode(PIN_BTN_OPEN,  INPUT_PULLUP);
    pinMode(PIN_BTN_CLOSE, INPUT_PULLUP);
    pinMode(PIN_BTN_STOP,  INPUT_PULLUP);

    // 4. Connect to Wokwi Simulated Wi-Fi
    Serial.print("[WIFI] Connecting to Wokwi Virtual Gateway (Wokwi-GUEST)...");
    WiFi.begin("Wokwi-GUEST", "");
    unsigned long startWifi = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startWifi < 4000) {
        delay(200);
        Serial.print(".");
    }
    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("\n[WIFI] Connected! Simulated IP: %s\n", WiFi.localIP().toString().c_str());
    } else {
        Serial.println("\n[WIFI] Running in offline telemetry mode.");
    }

    Serial.println("[SDAS] Hardware initialization completed.\n");
}

// ----------------------------------------------------------------------------
// MAIN EXECUTION LOOP
// ----------------------------------------------------------------------------
void loop() {
    unsigned long now = millis();

    // 1. High-Frequency Fast Loop - Buzzer Cadence & Physical Buttons
    updateBuzzer(now);
    handleButtons();

    // 2. Sensor Sampling & FSM Processing Loop (Every 2.0 Seconds)
    if (now - lastSensorSampleMs >= 2000) {
        lastSensorSampleMs = now;

        // A. Read DHT22
        float t = dht.readTemperature();
        float h = dht.readHumidity();
        if (!isnan(t)) currentTempC = t;
        if (!isnan(h)) currentHumidityPct = h;

        // B. Acoustic Sound Speed Compensation Formula
        // v = 331.4 + 0.606 * Temp + 0.0124 * Humidity
        float soundSpeed = 331.4f + (0.606f * currentTempC) + (0.0124f * currentHumidityPct);

        // C. Read Dual Ultrasonic Sensors (Alternating pings to avoid cross-talk)
        sensor1DistCm = measureAcousticDistance(PIN_TRIG_1, PIN_ECHO_1, soundSpeed);
        delay(40); // 40ms acoustic decay margin
        sensor2DistCm = measureAcousticDistance(PIN_TRIG_2, PIN_ECHO_2, soundSpeed);

        // D. Smart Sensor Fusion & Plausibility Engine
        // If one sensor is moved by user in Wokwi (<=65cm) while other is untouched (>65cm),
        // seamlessly follow the active sensor so interactive testing is effortless!
        float effectiveDist = 65.0f;

        if (sensor1DistCm <= 65.0f && sensor2DistCm > 65.0f) {
            effectiveDist = sensor1DistCm;
            sensorsAgreed = true;
            degradedModeActive = false;
        } else if (sensor2DistCm <= 65.0f && sensor1DistCm > 65.0f) {
            effectiveDist = sensor2DistCm;
            sensorsAgreed = true;
            degradedModeActive = false;
        } else {
            float delta = fabsf(sensor1DistCm - sensor2DistCm);
            if (delta <= SENSOR_MAX_DELTA_CM) {
                sensorsAgreed = true;
                degradedModeActive = false;
                effectiveDist = (sensor1DistCm + sensor2DistCm) / 2.0f;
            } else {
                sensorsAgreed = false;
                degradedModeActive = true;
                // Conservative fail-safe: use the sensor detecting higher water
                effectiveDist = min(sensor1DistCm, sensor2DistCm);
                Serial.printf("[WARNING] Sensor Divergence! S1=%.1fcm, S2=%.1fcm (Delta=%.1fcm > 5cm)\n",
                    sensor1DistCm, sensor2DistCm, delta);
            }
        }

        // E. Compute Reservoir Water Level %
        // Depth = Mount Height (65cm) - Measured Distance
        // % = (Depth / Max Usable Depth (40cm)) * 100
        float depthCm = SENSOR_MOUNT_HEIGHT_CM - effectiveDist;
        currentWaterLevelPct = constrain((depthCm / TANK_MAX_DEPTH_CM) * 100.0f, 0.0f, 100.0f);

        // F. Run Finite State Machine Evaluation
        evaluateStateMachine(currentWaterLevelPct);

        // G. Telemetry Dashboard Output
        const char* stateNames[] = { "NORMAL", "PRE-WARNING", "CLEAR AREA", "DANGER", "FAULT" };
        const char* modeNames[]  = { "AUTO", "MANUAL", "EMERGENCY" };

        Serial.printf("\n[SDAS TELEMETRY] Water Level: %5.1f%% | State: %-11s | Gate: %3d%% (Servo: %3d deg) | Mode: %s\n",
            currentWaterLevelPct,
            stateNames[currentAlertState],
            actualGatePercent,
            (int)currentServoAngle,
            modeNames[currentControlMode]);
        Serial.printf("                 Dist1: %4.1fcm | Dist2: %4.1fcm | Temp: %4.1fC | Humid: %4.1f%%\n",
            sensor1DistCm, sensor2DistCm, currentTempC, currentHumidityPct);
    }

    // 3. Cloud Synchronization Loop (Every 10 Seconds)
    if (now - lastTelemetrySyncMs >= 10000) {
        lastTelemetrySyncMs = now;
        syncCloudTelemetry();
    }
}
