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

// Command Callback for MQTT Remote Operator Overrides
void onRemoteOperatorCommand(const char* command, int param) {
    Serial.printf("[CMD] Received Remote Command: %s (Param: %d)\n", command, param);
    
    if (strcmp(command, "OPEN") == 0) {
        stateMachine.requestManualGatePercent(param, MANUAL_WATCHDOG_TIMEOUT_SEC);
        actuatorManager.setBuzzerPattern(BUZZER_SHORT_BEEP);
    } else if (strcmp(command, "CLOSE") == 0) {
        stateMachine.requestManualGatePercent(0, MANUAL_WATCHDOG_TIMEOUT_SEC);
        actuatorManager.setBuzzerPattern(BUZZER_SHORT_BEEP);
    } else if (strcmp(command, "ESTOP") == 0) {
        stateMachine.triggerEmergencyStop();
    } else if (strcmp(command, "AUTO") == 0) {
        stateMachine.revertToAuto();
    } else if (strcmp(command, "PREWARN_SMS") == 0) {
        // Operator manually triggered staged pre-warning SMS from app
        gsmManager.broadcastAlert("SDAS PRE-WARNING: Reservoir approaching 60% capacity. Monitor local advisories.");
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
    Serial.println("[INIT] SIM800L Cellular Modem initialized");

    // 5. Initialize Network & Cloud Telemetry
    telemetryManager.begin(onRemoteOperatorCommand);
    Serial.println("[INIT] Wi-Fi & MQTT command listener online");

    Serial.println("[SDAS] Setup completed successfully. Entering main control loop.\n");
}

void loop() {
    unsigned long now = millis();

    // ------------------------------------------------------------------------
    // HIGH-FREQUENCY SUB-LOOP (Runs every 15 ms)
    // Smooth servo slew-rate interpolation & danger buzzer siren pacing
    // ------------------------------------------------------------------------
    if (now - lastFastUpdateMs >= 15) {
        lastFastUpdateMs = now;
        actuatorManager.updateServoMotion();
        actuatorManager.updateBuzzer(now);
    }

    // ------------------------------------------------------------------------
    // ASYNCHRONOUS TASKS (Execute continuously without blocking)
    // ------------------------------------------------------------------------
    gsmManager.update();       // Drives non-blocking AT command SMS dispatch
    stateMachine.checkPhysicalButtons(); // Polls OPEN, CLOSE, E-STOP switches

    // ------------------------------------------------------------------------
    // MAIN SENSING & CONTROL LOOP (Runs every 2000 ms = 2.0 s)
    // Dual ultrasonic alternating pings, plausibility check & FSM evaluation
    // ------------------------------------------------------------------------
    if (now - lastSensorSampleMs >= 2000) {
        lastSensorSampleMs = now;

        // Sample dual sensors with speed-of-sound acoustic temperature correction
        SensorData sensors = sensorManager.sampleAndVerify();

        // Evaluate 4-stage alert state machine & update physical gate target
        stateMachine.evaluate(sensors, actuatorManager);

        // Check if a state transition triggered staged SMS dispatch
        if (stateMachine.checkAndClearSmsTrigger()) {
            const SystemStatus& status = stateMachine.getStatus();
            Serial.printf("[ALERT] State machine triggered SMS broadcast: %s\n", status.lastAlertMessage);
            gsmManager.broadcastAlert(status.lastAlertMessage);
            telemetryManager.publishEmergencyAlert(status.lastAlertMessage);
        }

        // Print debug telemetry to serial monitor
        const SystemStatus& status = stateMachine.getStatus();
        Serial.printf("[TELEM] Dist1: %.1fcm | Dist2: %.1fcm | Level: %.1f%% | Gate: %d%% | State: %d | Mode: %d\n",
            sensors.raw_dist_1_cm,
            sensors.raw_dist_2_cm,
            sensors.water_level_pct,
            status.actualGatePercent,
            (int)status.alertState,
            (int)status.controlMode
        );

        // Transmit telemetry to Supabase REST and MQTT broker
        telemetryManager.update(now, sensors, status);
    }
}
