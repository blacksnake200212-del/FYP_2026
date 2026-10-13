#include "state_machine.h"

SDASStateMachine::SDASStateMachine()
    : lastBtnOpenMs(0), lastBtnCloseMs(0), lastBtnStopMs(0),
      lastBtnOpenState(HIGH), lastBtnCloseState(HIGH), lastBtnStopState(HIGH) {
    memset(&currentStatus, 0, sizeof(SystemStatus));
    currentStatus.alertState = STATE_NORMAL;
    currentStatus.controlMode = MODE_AUTO;
    currentStatus.targetGatePercent = GATE_PCT_CLOSED;
    currentStatus.actualGatePercent = GATE_PCT_CLOSED;
    currentStatus.smsDispatchRequired = false;
    currentStatus.lastAlertMessage = "NORMAL: Reservoir levels stable.";
}

void SDASStateMachine::begin() {
    // Configure hardware buttons with internal pullups
    pinMode(PIN_BTN_OPEN, INPUT_PULLUP);
    pinMode(PIN_BTN_CLOSE, INPUT_PULLUP);
    pinMode(PIN_BTN_STOP, INPUT_PULLUP);
    
    // Load last persistent gate position from ESP32 NVS flash
    preferences.begin("sdas_fsm", false);
    int savedGate = loadGateStateFromNVS();
    currentStatus.targetGatePercent = savedGate;
    currentStatus.actualGatePercent = savedGate;
}

int SDASStateMachine::loadGateStateFromNVS() {
    int saved = preferences.getInt("gate_pct", 0);
    if (saved < 0 || saved > 100) saved = 0;
    return saved;
}

void SDASStateMachine::saveGateStateToNVS(int percent) {
    preferences.putInt("gate_pct", percent);
}

void SDASStateMachine::checkPhysicalButtons() {
    unsigned long now = millis();
    int readStop  = digitalRead(PIN_BTN_STOP);
    int readOpen  = digitalRead(PIN_BTN_OPEN);
    int readClose = digitalRead(PIN_BTN_CLOSE);
    
    // 1. Emergency STOP Button (GPIO22) - Highest priority edge transition
    if (lastBtnStopState == HIGH && readStop == LOW) {
        if (now - lastBtnStopMs >= 50) {
            lastBtnStopMs = now;
            if (currentStatus.controlMode == MODE_EMERGENCY) {
                releaseEmergencyStop();
                Serial.println("[E-STOP] Released! Resumed autonomous regulation.");
            } else {
                triggerEmergencyStop();
                Serial.println("[E-STOP] Triggered! Sluice gate locked in position.");
            }
        }
    }
    lastBtnStopState = readStop;
    
    // If currently in hardware E-STOP, ignore other manual buttons
    if (currentStatus.controlMode == MODE_EMERGENCY) return;
    
    // 2. Manual CLOSE Button (GPIO26) - Immediate Full Closure (0% / 0 deg)
    if (lastBtnCloseState == HIGH && readClose == LOW) {
        if (now - lastBtnCloseMs >= 100) {
            lastBtnCloseMs = now;
            requestManualGatePercent(GATE_PCT_CLOSED, MANUAL_WATCHDOG_TIMEOUT_SEC);
            Serial.printf("[MANUAL] CLOSE Pressed -> Gate set to 0%% (Watchdog: %d s)\n", MANUAL_WATCHDOG_TIMEOUT_SEC);
        }
    }
    lastBtnCloseState = readClose;
    
    // 3. Manual OPEN Button (GPIO14) - Immediate Full Opening (100% / 180 deg)
    if (lastBtnOpenState == HIGH && readOpen == LOW) {
        if (now - lastBtnOpenMs >= 100) {
            lastBtnOpenMs = now;
            requestManualGatePercent(GATE_PCT_FULL_EMERGENCY, MANUAL_WATCHDOG_TIMEOUT_SEC);
            Serial.printf("[MANUAL] OPEN Pressed -> Sluice Gate FULLY OPENED (100%% / 180 deg) (Watchdog: %d s)\n", MANUAL_WATCHDOG_TIMEOUT_SEC);
        }
    }
    lastBtnOpenState = readOpen;
}

void SDASStateMachine::triggerEmergencyStop() {
    currentStatus.controlMode = MODE_EMERGENCY;
    currentStatus.lastAlertMessage = "EMERGENCY: Hardware E-STOP triggered! Gate immobilized.";
}

void SDASStateMachine::releaseEmergencyStop() {
    currentStatus.controlMode = MODE_AUTO;
    currentStatus.lastAlertMessage = "NORMAL: Emergency cleared. Resumed autonomous regulation.";
}

void SDASStateMachine::requestManualGatePercent(int targetPercent, uint32_t durationSec) {
    if (currentStatus.controlMode == MODE_EMERGENCY) return; // Emergency takes precedence
    
    currentStatus.controlMode = MODE_MANUAL;
    currentStatus.targetGatePercent = constrain(targetPercent, 0, 100);
    currentStatus.manualModeExpiryMs = millis() + (durationSec * 1000UL);
    saveGateStateToNVS(currentStatus.targetGatePercent);
}

void SDASStateMachine::revertToAuto() {
    currentStatus.controlMode = MODE_AUTO;
    currentStatus.manualModeExpiryMs = 0;
}

bool SDASStateMachine::checkAndClearSmsTrigger() {
    if (currentStatus.smsDispatchRequired) {
        currentStatus.smsDispatchRequired = false;
        return true;
    }
    return false;
}

void SDASStateMachine::evaluate(const SensorData& sensorData, ActuatorManager& actuators) {
    unsigned long now = millis();
    
    // Check hardware push buttons first
    checkPhysicalButtons();
    
    // --- Step 1: Watchdog Auto-Revert for Manual Mode ---
    if (currentStatus.controlMode == MODE_MANUAL) {
        if (now >= currentStatus.manualModeExpiryMs) {
            revertToAuto();
        }
    }
    
    // --- Step 2: Handle Emergency Mode ---
    if (currentStatus.controlMode == MODE_EMERGENCY) {
        actuators.emergencyStop();
        return;
    }
    
    // --- Step 3: Handle Sensor Fault / Degraded Mode ---
    if (sensorData.critical_sensor_fault) {
        currentStatus.alertState = STATE_SENSOR_FAULT;
        actuators.setRGBAlert(STATE_SENSOR_FAULT);
        actuators.setBuzzerPattern(BUZZER_PULSE_DANGER);
        return;
    }
    
    // --- Step 4: Evaluate 4-Tier State Machine with 3% Hysteresis ---
    float level = sensorData.water_level_pct;
    AlertState previousAlert = currentStatus.alertState;
    AlertState nextAlert = previousAlert;
    
    switch (previousAlert) {
        case STATE_NORMAL:
            if (level >= THRESH_DANGER_PCT) {
                nextAlert = STATE_DANGER;
            } else if (level >= THRESH_CLEARAREA_PCT) {
                nextAlert = STATE_CLEAR_AREA;
            } else if (level >= THRESH_PREWARN_PCT) {
                nextAlert = STATE_PRE_WARNING;
            }
            break;
            
        case STATE_PRE_WARNING:
            if (level >= THRESH_DANGER_PCT) {
                nextAlert = STATE_DANGER;
            } else if (level >= THRESH_CLEARAREA_PCT) {
                nextAlert = STATE_CLEAR_AREA;
            } else if (level < EXIT_PREWARN_PCT) { // < 57.0%
                nextAlert = STATE_NORMAL;
            }
            break;
            
        case STATE_CLEAR_AREA:
            if (level >= THRESH_DANGER_PCT) {
                nextAlert = STATE_DANGER;
            } else if (level < EXIT_CLEARAREA_PCT) { // < 77.0%
                nextAlert = STATE_PRE_WARNING;
            }
            break;
            
        case STATE_DANGER:
            if (level < EXIT_DANGER_PCT) { // < 82.0%
                nextAlert = STATE_CLEAR_AREA;
            }
            break;
            
        case STATE_SENSOR_FAULT:
            if (!sensorData.critical_sensor_fault) {
                nextAlert = STATE_NORMAL;
            }
            break;
    }
    
    // Check if alert state stepped UP to trigger automatic SMS
    if (nextAlert != previousAlert) {
        currentStatus.alertState = nextAlert;
        
        if (nextAlert == STATE_CLEAR_AREA) {
            currentStatus.smsDispatchRequired = true;
            currentStatus.lastAlertMessage = "CLEAR AREA ALERT: Reservoir at 80%+. Sluice gate opening 30%. Evacuate spillway zones.";
        } else if (nextAlert == STATE_DANGER) {
            currentStatus.smsDispatchRequired = true;
            currentStatus.lastAlertMessage = "CRITICAL DANGER: Reservoir at 85%+. Sluice gate opening 50%. High flood risk imminent!";
        }
    }
    
    // --- Step 5: Update Visual and Audible Actuators ---
    if (sensorData.degraded_mode && currentStatus.alertState != STATE_DANGER && currentStatus.alertState != STATE_CLEAR_AREA) {
        actuators.setRGBAlert(STATE_SENSOR_FAULT);
    } else {
        actuators.setRGBAlert(currentStatus.alertState);
    }
    
    if (currentStatus.alertState == STATE_DANGER) {
        actuators.setBuzzerPattern(BUZZER_PULSE_DANGER);
    } else {
        actuators.setBuzzerPattern(BUZZER_OFF);
    }
    actuators.updateBuzzer(now);
    
    // --- Step 6: Determine Gate Position (If in AUTO Mode) ---
    if (currentStatus.controlMode == MODE_AUTO) {
        switch (currentStatus.alertState) {
            case STATE_NORMAL:
            case STATE_PRE_WARNING:
                // Preserve water: Gate remains 0% closed
                currentStatus.targetGatePercent = GATE_PCT_CLOSED;
                break;
                
            case STATE_CLEAR_AREA:
                // Pre-emptive discharge: Gate 30% open
                currentStatus.targetGatePercent = GATE_PCT_CLEAR_AREA;
                break;
                
            case STATE_DANGER:
                // Major emergency discharge: Gate 50% open
                currentStatus.targetGatePercent = GATE_PCT_DANGER;
                break;
                
            case STATE_SENSOR_FAULT:
                // Hold last gate position
                break;
        }
    }
    
    // Apply gate position to servo with smooth motion
    actuators.setTargetGatePercent(currentStatus.targetGatePercent);
    actuators.updateServoMotion();
    currentStatus.actualGatePercent = actuators.getCurrentGatePercent();
    
    // Save to flash if target changed
    static int lastSavedTarget = -1;
    if (currentStatus.targetGatePercent != lastSavedTarget) {
        lastSavedTarget = currentStatus.targetGatePercent;
        saveGateStateToNVS(lastSavedTarget);
    }
}
