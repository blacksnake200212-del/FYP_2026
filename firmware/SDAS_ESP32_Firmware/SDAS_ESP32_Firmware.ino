// ============================================================================
// SMART DAM ALERT SYSTEM WITH AUTOMATED GATE CONTROL (SDAS)
// Corrected Production Firmware V2.0 for ESP32 DevKit V1
// Lead Authors: Dias Adrian, AAA Aadhil, JMRA Dilshan
// Faculty of Computing and IT, SLTC Research University
// ============================================================================

#include <Arduino.h>
#include "config.h"
#include "sensors.h"
#include "actuators.h"
#include "state_machine.h"
#include "gsm_modem.h"
#include "network_telemetry.h"

// Subsystem Instances
SensorManager    sensorManager;
ActuatorManager  actuatorManager;
SDASStateMachine stateMachine;
GSMManager       gsmManager;
TelemetryManager telemetryManager;

// Timing Trackers
unsigned long lastSensorSampleMs   = 0;
unsigned long lastFastUpdateMs      = 0;

// Bench Testing Simulation Override (-1.0 = use real live sensors)
float simulatedLevelPct = -1.0f;

void printSerialHelp() {
    Serial.println("\n=======================================================");
    Serial.println("         SDAS INTERACTIVE SERIAL MONITOR COMMANDS");
    Serial.println("=======================================================");
    Serial.println("  MUTE / UNMUTE   : Silence or restore the alarm buzzer");
    Serial.println("  BTN or BUTTONS  : Inspect live physical state of OPEN (14), CLOSE (26), STOP (22)");
    Serial.println("  SENSOR 1        : Use Single HC-SR04 Sensor #1 (GPIO5/19) - Bench Testing");
    Serial.println("  SENSOR DUAL     : Enable Dual HC-SR04 Sensor Voting (GPIO5/19 + GPIO18/21)");
    Serial.println("  BUZZ or BEEP    : Test active buzzer with a 500ms DC pulse");
    Serial.println("  BUZZ ON         : Force GPIO27 HIGH continuously (for DMM voltmeter check)");
    Serial.println("  BUZZ OFF        : Force GPIO27 LOW (0V)");
    Serial.println("  TONE            : Generate 2.4 kHz PWM frequency (tests for passive buzzer)");
    Serial.println("  SMS             : Send live test SMS to all 4 registered numbers");
    Serial.println("  SMS 1 / 2 / 3 / 4: Send test SMS to specific registered contact");
    Serial.println("  SMS <+94...>    : Send test SMS directly to any custom number");
    Serial.println("  RGB             : Toggle RGB LED polarity (Common Anode <-> Cathode)");
    Serial.println("  DIAG or SIM     : Run full SIM800L diagnostics (CSQ, CREG, CPIN, Volts)");
    Serial.println("  TEST            : Run hardware visual & audio cycle (Green->Yellow->Orange->Red)");
    Serial.println("  LEVEL <0-100>   : Simulate water level % (e.g. LEVEL 25 for Green, LEVEL 65 for Yellow)");
    Serial.println("  LEVEL REAL      : Disable simulation and return to real ultrasonic sensors");
    Serial.println("  OPEN            : Open sluice gate to 20% (Manual mode)");
    Serial.println("  OPEN <0-50>     : Manually open sluice gate to specified percentage");
    Serial.println("  CLOSE           : Manually close sluice gate (0%)");
    Serial.println("  SPEED <1-10>    : Adjust servo movement speed (e.g. SPEED 3 = standard, SPEED 6 = fast)");
    Serial.println("  FAST / NORMAL   : Instant presets for brisk or rapid servo travel");
    Serial.println("  STOP or ESTOP   : Toggle Emergency Stop mode");
    Serial.println("  AUTO or RESET   : Return system to autonomous control mode");
    Serial.println("  STATUS          : Print complete hardware and sensor telemetry status");
    Serial.println("  HELP            : Display this command list");
    Serial.println("=======================================================\n");
}

void handleSerialCommand(String cmd) {
    cmd.trim();
    String upper = cmd;
    upper.toUpperCase();
    
    if (upper.equals("HELP") || upper.equals("?")) {
        printSerialHelp();
    } else if (upper.equals("MUTE")) {
        actuatorManager.setMuted(true);
    } else if (upper.equals("UNMUTE")) {
        actuatorManager.setMuted(false);
    } else if (upper.equals("SENSOR 1") || upper.equals("SENSOR SINGLE")) {
        sensorManager.setSensorCount(1);
    } else if (upper.equals("SENSOR 2") || upper.equals("SENSOR DUAL")) {
        sensorManager.setSensorCount(2);
    } else if (upper.equals("BUZZ") || upper.equals("BEEP")) {
        actuatorManager.testBuzzerChirp(500);
    } else if (upper.equals("BUZZ ON")) {
        actuatorManager.testBuzzerDirect(true);
    } else if (upper.equals("BUZZ OFF")) {
        actuatorManager.testBuzzerDirect(false);
    } else if (upper.equals("TONE")) {
        Serial.println("[CMD] Playing 2400 Hz test tone on GPIO27 for 800ms...");
        actuatorManager.testBuzzerTone(2400, 800);
    } else if (upper.equals("RGB")) {
        actuatorManager.togglePolarity();
    } else if (upper.equals("DIAG") || upper.equals("SIM")) {
        gsmManager.printDiagnostics();
    } else if (upper.equals("TEST")) {
        actuatorManager.runHardwareCycleTest();
    } else if (upper.equals("SMS")) {
        Serial.println("[CMD] Initiating live test SMS broadcast to all 4 registered contacts...");
        gsmManager.broadcastAlert("SDAS TEST ALERT: Hardware cellular broadcast verified. System operational.", true);
    } else if (upper.startsWith("SMS ")) {
        String param = cmd.substring(4);
        param.trim();
        String targetNum = "";
        if (param.equals("1")) targetNum = CONTACT_OPERATOR_1;
        else if (param.equals("2")) targetNum = CONTACT_OPERATOR_2;
        else if (param.equals("3")) targetNum = CONTACT_OPERATOR_3;
        else if (param.equals("4")) targetNum = CONTACT_OPERATOR_4;
        else targetNum = param;
        
        Serial.printf("[CMD] Queuing test SMS directly to %s...\n", targetNum.c_str());
        gsmManager.queueSMS(targetNum.c_str(), "SDAS TEST ALERT: Single-number SMS verified successfully!", true);
    } else if (upper.startsWith("LEVEL ")) {
        String param = upper.substring(6);
        param.trim();
        if (param.equals("REAL") || param.equals("AUTO")) {
            simulatedLevelPct = -1.0f;
            Serial.println("[SIMULATED] Deactivated. System restored to live HC-SR04 ultrasonic sensors.");
        } else {
            float val = param.toFloat();
            if (val >= 0.0f && val <= 100.0f) {
                simulatedLevelPct = val;
                Serial.printf("[SIMULATED] Water level forced to %.1f%%. Evaluating state machine...\n", val);
            } else {
                Serial.println("[CMD] Invalid level! Enter a percentage between 0 and 100 (e.g. LEVEL 65).");
            }
        }
    } else if (upper.equals("BTN") || upper.equals("BUTTONS") || upper.equals("BUTTON")) {
        stateMachine.printButtonStatus();
    } else if (upper.equals("MANUAL")) {
        stateMachine.requestManualGatePercent(actuatorManager.getCurrentGatePercent(), 0);
        actuatorManager.setBuzzerPattern(BUZZER_SHORT_BEEP);
        Serial.println("[CMD] Switched to MANUAL mode (Operator lock active, auto-revert disabled).");
    } else if (upper.equals("OPEN")) {
        stateMachine.requestManualGatePercent(20, 0);
        actuatorManager.setBuzzerPattern(BUZZER_SHORT_BEEP);
        Serial.println("[CMD] Sluice gate set to 20% (Manual mode, holding indefinitely)");
    } else if (upper.startsWith("OPEN ")) {
        int pct = upper.substring(5).toInt();
        pct = constrain(pct, 0, GATE_PCT_MAX_LIMIT);
        stateMachine.requestManualGatePercent(pct, 0);
        actuatorManager.setBuzzerPattern(BUZZER_SHORT_BEEP);
        Serial.printf("[CMD] Sluice gate set to %d%% (Manual mode, holding indefinitely)\n", pct);
    } else if (upper.equals("CLOSE")) {
        stateMachine.requestManualGatePercent(GATE_PCT_CLOSED, 0);
        actuatorManager.setTargetGatePercent(GATE_PCT_CLOSED);
        actuatorManager.setBuzzerPattern(BUZZER_SHORT_BEEP);
        Serial.println("[CMD] Sluice gate CLOSED to 0% (MANUAL CLOSE - Holding closed in Manual mode)");
    } else if (upper.startsWith("SPEED ")) {
        float spd = upper.substring(6).toFloat();
        if (spd >= 0.5f && spd <= 15.0f) {
            actuatorManager.setServoStepDeg(spd);
            Serial.printf("[SERVO] Motion speed updated to %.1f deg/step (~%d ms for 50%% travel).\n",
                spd, (int)((90.0f / spd) * 15.0f));
        } else {
            Serial.println("[SERVO] Invalid speed. Enter a number between 1.0 and 10.0 (e.g. 'SPEED 5').");
        }
    } else if (upper.equals("FAST") || upper.equals("SPEED FAST")) {
        actuatorManager.setServoStepDeg(6.0f);
        Serial.println("[SERVO] Motion speed set to FAST (6.0 deg/step - ~225ms full travel).");
    } else if (upper.equals("NORMAL") || upper.equals("SPEED NORMAL")) {
        actuatorManager.setServoStepDeg(3.0f);
        Serial.println("[SERVO] Motion speed set to BRISK NORMAL (3.0 deg/step - ~450ms full travel).");
    } else if (upper.equals("STOP") || upper.equals("ESTOP")) {
        const SystemStatus& s = stateMachine.getStatus();
        if (s.controlMode == MODE_EMERGENCY) {
            stateMachine.releaseEmergencyStop();
            actuatorManager.setBuzzerPattern(BUZZER_SHORT_BEEP);
            Serial.println("[CMD] E-STOP Released. Restored AUTO mode.");
        } else {
            stateMachine.triggerEmergencyStop(&actuatorManager);
            Serial.println("[CMD] E-STOP Triggered! Gate locked.");
        }
    } else if (upper.equals("AUTO") || upper.equals("RESET") || upper.equals("CLEAR")) {
        stateMachine.releaseEmergencyStop();
        stateMachine.revertToAuto();
        Serial.println("[CMD] Overrides cleared. Returned to autonomous AUTO mode.");
    } else if (upper.equals("STATUS")) {
        const SystemStatus& status = stateMachine.getStatus();
        Serial.println("\n--- [CURRENT SYSTEM STATUS] ---");
        Serial.printf("Water Level:       %.1f%% %s\n",
            simulatedLevelPct >= 0.0f ? simulatedLevelPct : 0.0f,
            simulatedLevelPct >= 0.0f ? "(SIMULATED)" : "(LIVE)");
        Serial.printf("Gate Percentage:   %d%% (Target: %d%%)\n", status.actualGatePercent, status.targetGatePercent);
        Serial.printf("Alert State:       %d (%s)\n", (int)status.alertState,
            status.alertState == STATE_NORMAL ? "NORMAL (Green)" :
            status.alertState == STATE_PRE_WARNING ? "PRE-WARNING (Yellow)" :
            status.alertState == STATE_CLEAR_AREA ? "CLEAR AREA (Orange)" :
            status.alertState == STATE_DANGER ? "DANGER (Red)" : "SENSOR FAULT (Purple)");
        Serial.printf("Control Mode:      %s\n", status.controlMode == MODE_AUTO ? "AUTO" :
            status.controlMode == MODE_MANUAL ? "MANUAL" : "EMERGENCY");
        Serial.printf("RGB LED Polarity:  %s\n", actuatorManager.isPolarityCommonAnode() ? "Common Anode (Active LOW)" : "Common Cathode (Active HIGH)");
        Serial.printf("GSM Modem Ready:   %s | Registered: %s | Queue: %d\n",
            gsmManager.isModemReady() ? "YES" : "NO",
            gsmManager.isRegistered() ? "YES" : "NO",
            gsmManager.getPendingCount());
        Serial.println("-------------------------------\n");
    } else {
        Serial.printf("[CMD] Unknown command '%s'. Type 'HELP' to view available commands.\n", cmd.c_str());
    }
}

// Command Callback for MQTT & Supabase Remote Operator Overrides
void onRemoteOperatorCommand(const char* command, int param) {
    Serial.printf("[CMD] Received Remote Command: %s (Param: %d)\n", command, param);
    
    if (strcmp(command, "OPEN") == 0) {
        int clampedParam = constrain(param, 0, GATE_PCT_MAX_LIMIT);
        // Indefinite manual hold (duration = 0 prevents auto-revert to AUTO)
        stateMachine.requestManualGatePercent(clampedParam, 0);
        actuatorManager.setBuzzerPattern(BUZZER_SHORT_BEEP);
        Serial.printf("[CMD] Sluice gate set to %d%% (MANUAL MODE - Holding indefinitely)\n", clampedParam);
    } else if (strcmp(command, "CLOSE") == 0) {
        // Manual Close: Closes gate to 0% and STAYS in MANUAL mode!
        stateMachine.requestManualGatePercent(0, 0);
        actuatorManager.setTargetGatePercent(GATE_PCT_CLOSED);
        actuatorManager.setBuzzerPattern(BUZZER_SHORT_BEEP);
        Serial.println("[CMD] Sluice gate CLOSED to 0% (MANUAL MODE - Holding closed)");
    } else if (strcmp(command, "MANUAL") == 0) {
        // Explicitly lock into Manual Mode holding current gate position
        stateMachine.requestManualGatePercent(stateMachine.getStatus().actualGatePercent, 0);
        actuatorManager.setBuzzerPattern(BUZZER_SHORT_BEEP);
        Serial.println("[CMD] Switched to MANUAL mode (Autonomous auto-close inhibited)");
    } else if (strcmp(command, "AUTO") == 0) {
        // Return to Autonomous Mode
        stateMachine.revertToAuto();
        actuatorManager.setBuzzerPattern(BUZZER_SHORT_BEEP);
        Serial.println("[CMD] Returned to AUTO mode (Autonomous sensor control active)");
    } else if (strcmp(command, "ESTOP") == 0) {
        // Halt servo and sound continuous alarm immediately on Core 1
        stateMachine.triggerEmergencyStop(&actuatorManager);
    } else if (strcmp(command, "PREWARN_SMS") == 0) {
        // Operator manually triggered staged pre-warning SMS from app
        gsmManager.broadcastAlert("SDAS PRE-WARNING: Reservoir approaching 60% capacity. Monitor local advisories.", false);
    } else if (strcmp(command, "SENSOR_2") == 0 || strcmp(command, "DUAL") == 0) {
        sensorManager.setSensorCount(2);
        Serial.println("[CMD] Remote command enabled Dual HC-SR04 Sensors (GPIO5/19 + GPIO18/21)!");
    } else if (strcmp(command, "SENSOR_1") == 0 || strcmp(command, "SINGLE") == 0) {
        sensorManager.setSensorCount(1);
        Serial.println("[CMD] Remote command set to Single HC-SR04 Sensor (GPIO5/19)!");
    }
}

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n=======================================================");
    Serial.println("  SMART DAM ALERT SYSTEM (SDAS) - FIRMWARE BOOTING");
    Serial.println("  Hardware: ESP32 DevKit V1 | Audited Blueprint V2.0");
    Serial.println("=======================================================");

    // 1. Initialize Actuators (Sets servo to safe position & boots RGB)
    actuatorManager.begin();
    Serial.println("[INIT] Actuators initialized (Gate locked, RGB active)");

    // 2. Initialize Sensors (Configures dual ultrasonic pins & DHT22)
    sensorManager.begin();
    Serial.println("[INIT] Dual JSN-SR04T & DHT22 acoustic subsystem online");

    // 3. Initialize State Machine (Loads persistent gate state from NVS)
    stateMachine.begin();
    Serial.println("[INIT] Finite State Machine online (3% hysteresis active)");

    // 4. Initialize GSM Modem (Hardware UART2 & RST pin toggle)
    gsmManager.begin();
    Serial.println("[INIT] SIM800L Cellular Modem initialized (16-slot priority queue)");

    // 5. Initialize Network & Cloud Telemetry (Spawns FreeRTOS Task on Core 0)
    telemetryManager.begin(onRemoteOperatorCommand);
    Serial.println("[INIT] Wi-Fi & MQTT FreeRTOS Core 0 background worker online");

    Serial.println("[SDAS] Setup completed successfully. Entering main control loop.");
    Serial.println("[TIP] Type 'HELP' in Serial Monitor at any time for interactive commands!\n");
}

void loop() {
    unsigned long now = millis();

    // ------------------------------------------------------------------------
    // HIGH-FREQUENCY SUB-LOOP (Runs every 15 ms on Core 1)
    // Smooth servo slew-rate interpolation, danger siren & Orange LED PWM
    // ------------------------------------------------------------------------
    if (now - lastFastUpdateMs >= 15) {
        lastFastUpdateMs = now;
        actuatorManager.updateServoMotion();
        actuatorManager.updateIndicators(now);
    }

    // ------------------------------------------------------------------------
    // ASYNCHRONOUS TASKS (Execute continuously on Core 1 without blocking)
    // ------------------------------------------------------------------------
    gsmManager.update();                              // Drives non-blocking AT command SMS dispatch
    stateMachine.checkPhysicalButtons(&actuatorManager); // Polls OPEN, CLOSE, E-STOP switches with instant response

    // ------------------------------------------------------------------------
    // INTERACTIVE SERIAL MONITOR COMMAND INTERPRETER
    // ------------------------------------------------------------------------
    if (Serial.available()) {
        String line = Serial.readStringUntil('\n');
        line.trim();
        if (line.length() > 0) {
            handleSerialCommand(line);
        }
    }

    // ------------------------------------------------------------------------
    // MAIN SENSING & CONTROL LOOP (Runs every 2000 ms = 2.0 s on Core 1)
    // Dual ultrasonic alternating pings, plausibility check & FSM evaluation
    // ------------------------------------------------------------------------
    if (now - lastSensorSampleMs >= 2000) {
        lastSensorSampleMs = now;

        // Sample dual sensors with speed-of-sound acoustic temperature correction
        SensorData sensors = sensorManager.sampleAndVerify();

        // Check if manual level simulation is active
        if (simulatedLevelPct >= 0.0f) {
            sensors.water_level_pct = simulatedLevelPct;
            sensors.water_level_cm = (simulatedLevelPct / 100.0f) * TANK_MAX_DEPTH_CM;
            sensors.critical_sensor_fault = false;
        }

        // Evaluate 4-stage alert state machine & update physical gate target
        stateMachine.evaluate(sensors, actuatorManager);

        // Check if a state transition triggered staged SMS dispatch
        bool isPriority = false;
        if (stateMachine.checkAndClearSmsTrigger(&isPriority)) {
            const SystemStatus& status = stateMachine.getStatus();
            Serial.printf("[ALERT] State machine triggered SMS broadcast (Priority: %s): %s\n",
                isPriority ? "HIGH" : "NORMAL", status.lastAlertMessage);
            gsmManager.broadcastAlert(status.lastAlertMessage, isPriority);
            telemetryManager.publishEmergencyAlert(status.lastAlertMessage);
        }

        // Print debug telemetry to serial monitor
        const SystemStatus& status = stateMachine.getStatus();
        Serial.printf("[TELEM] Dist1: %.1fcm | Dist2: %.1fcm | Level: %.1f%% %s | Gate: %d%% | State: %d | Mode: %d\n",
            sensors.raw_dist_1_cm,
            sensors.raw_dist_2_cm,
            sensors.water_level_pct,
            simulatedLevelPct >= 0.0f ? "[SIM]" : "[LIVE]",
            status.actualGatePercent,
            (int)status.alertState,
            (int)status.controlMode
        );

        // Provide thread-safe telemetry snapshot to FreeRTOS Core 0 networking task (non-blocking)
        telemetryManager.update(now, sensors, status);
    }
}
