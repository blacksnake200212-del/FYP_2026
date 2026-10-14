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
        int clampedParam = constrain(param, 0, GATE_PCT_MAX_LIMIT);
        stateMachine.requestManualGatePercent(clampedParam, MANUAL_WATCHDOG_TIMEOUT_SEC);
        actuatorManager.setBuzzerPattern(BUZZER_SHORT_BEEP);
    } else if (strcmp(command, "CLOSE") == 0) {
        stateMachine.requestManualGatePercent(0, MANUAL_WATCHDOG_TIMEOUT_SEC);
        actuatorManager.setBuzzerPattern(BUZZER_SHORT_BEEP);
    } else if (strcmp(command, "ESTOP") == 0) {
        // Halt servo and sound continuous alarm immediately on Core 1
        stateMachine.triggerEmergencyStop(&actuatorManager);
    } else if (strcmp(command, "AUTO") == 0) {
        stateMachine.revertToAuto();
    } else if (strcmp(command, "PREWARN_SMS") == 0) {
        // Operator manually triggered staged pre-warning SMS from app
        gsmManager.broadcastAlert("SDAS PRE-WARNING: Reservoir approaching 60% capacity. Monitor local advisories.", false);
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

    Serial.println("[SDAS] Setup completed successfully. Entering main control loop.\n");
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
    // MAIN SENSING & CONTROL LOOP (Runs every 2000 ms = 2.0 s on Core 1)
    // Dual ultrasonic alternating pings, plausibility check & FSM evaluation
    // ------------------------------------------------------------------------
    if (now - lastSensorSampleMs >= 2000) {
        lastSensorSampleMs = now;

        // Sample dual sensors with speed-of-sound acoustic temperature correction
        SensorData sensors = sensorManager.sampleAndVerify();

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
        Serial.printf("[TELEM] Dist1: %.1fcm | Dist2: %.1fcm | Level: %.1f%% | Gate: %d%% | State: %d | Mode: %d\n",
            sensors.raw_dist_1_cm,
            sensors.raw_dist_2_cm,
            sensors.water_level_pct,
            status.actualGatePercent,
            (int)status.alertState,
            (int)status.controlMode
        );

        // Provide thread-safe telemetry snapshot to FreeRTOS Core 0 networking task (non-blocking)
        telemetryManager.update(now, sensors, status);
    }
}
