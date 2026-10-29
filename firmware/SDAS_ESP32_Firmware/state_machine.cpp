#include "state_machine.h"

SDASStateMachine::SDASStateMachine()
    : previousFaultState(false),
      lastBtnOpenMs(0), lastBtnCloseMs(0), lastBtnStopMs(0),
      lastBtnOpenState(HIGH), lastBtnCloseState(HIGH), lastBtnStopState(HIGH) {
    memset(&currentStatus, 0, sizeof(SystemStatus));
    currentStatus.alertState = STATE_NORMAL;
    currentStatus.controlMode = MODE_AUTO;
    currentStatus.targetGatePercent = GATE_PCT_CLOSED;
    currentStatus.actualGatePercent = GATE_PCT_CLOSED;
    currentStatus.smsDispatchRequired = false;
    currentStatus.smsIsPriority = false;
    currentStatus.lastAlertMessage = "NORMAL: Reservoir levels stable.";
}

void SDASStateMachine::begin() {
    // Configure hardware buttons with internal pullups
    pinMode(PIN_BTN_OPEN, INPUT_PULLUP);
    pinMode(PIN_BTN_CLOSE, INPUT_PULLUP);
    pinMode(PIN_BTN_STOP, INPUT_PULLUP);
    
    // Sample initial button states on boot to prevent spurious edge triggers
    delay(10);
    lastBtnOpenState  = digitalRead(PIN_BTN_OPEN);
    lastBtnCloseState = digitalRead(PIN_BTN_CLOSE);
    lastBtnStopState  = digitalRead(PIN_BTN_STOP);
    
    // Load last persistent gate position & control mode from ESP32 NVS flash
    preferences.begin("sdas_fsm", false);
    int savedGate = loadGateStateFromNVS();
    currentStatus.targetGatePercent = savedGate;
    currentStatus.actualGatePercent = savedGate;

    int savedMode = preferences.getInt("ctrl_mode", (int)MODE_AUTO);
    if (savedMode == (int)MODE_MANUAL) {
        currentStatus.controlMode = MODE_MANUAL;
        currentStatus.manualModeExpiryMs = 0; // 0 = Indefinite Manual Lock (Operator holds full control)
        Serial.printf("[FSM] Restored persistent MANUAL mode from NVS (Gate: %d%%)\n", savedGate);
    } else {
        currentStatus.controlMode = MODE_AUTO;
        currentStatus.manualModeExpiryMs = 0;
        Serial.printf("[FSM] Operating in autonomous AUTO mode (Gate: %d%%)\n", savedGate);
    }
}

int SDASStateMachine::loadGateStateFromNVS() {
    int saved = preferences.getInt("gate_pct", 0);
    if (saved < 0 || saved > GATE_PCT_MAX_LIMIT) saved = 0;
    return saved;
}

void SDASStateMachine::saveGateStateToNVS(int percent) {
    preferences.putInt("gate_pct", percent);
}

void SDASStateMachine::printButtonStatus() const {
    int readOpen  = digitalRead(PIN_BTN_OPEN);
    int readClose = digitalRead(PIN_BTN_CLOSE);
    int readStop  = digitalRead(PIN_BTN_STOP);
    
    Serial.println("\n=======================================================");
    Serial.println("         PHYSICAL PUSH BUTTON DIAGNOSTIC CHECK");
    Serial.println("=======================================================");
    Serial.printf("1. OPEN Button  (GPIO14):  %s [%s]\n",
        readOpen == LOW ? "LOW (PRESSED / CLOSED TO GND)" : "HIGH (RELEASED / OPEN)",
        readOpen == LOW ? "ACTIVE" : "IDLE");
    Serial.printf("2. CLOSE Button (GPIO26):  %s [%s]\n",
        readClose == LOW ? "LOW (PRESSED / CLOSED TO GND)" : "HIGH (RELEASED / OPEN)",
        readClose == LOW ? "ACTIVE" : "IDLE");
    Serial.printf("3. STOP Button  (GPIO22):  %s [%s]\n",
        readStop == LOW ? "LOW (PRESSED / E-STOP TRIGGERED)" : "HIGH (RELEASED / SAFE)",
        readStop == LOW ? "EMERGENCY" : "NORMAL");
    Serial.printf("Current Control Mode:      %s\n",
        currentStatus.controlMode == MODE_AUTO ? "AUTO (Autonomous Sluice Regulation)" :
        currentStatus.controlMode == MODE_MANUAL ? "MANUAL (Operator Push-Button Control)" : "EMERGENCY (E-STOP Lockout Active)");
    Serial.println("Tip: If a button shows LOW without touching it, rotate the tactile switch 90 deg!");
    Serial.println("=======================================================\n");
}

void SDASStateMachine::checkPhysicalButtons(ActuatorManager* actuators) {
    unsigned long now = millis();
    int readStop  = digitalRead(PIN_BTN_STOP);
    int readOpen  = digitalRead(PIN_BTN_OPEN);
    int readClose = digitalRead(PIN_BTN_CLOSE);
    
    // 1. Emergency STOP Button (GPIO22) - Highest priority edge transition
    if (lastBtnStopState == HIGH && readStop == LOW) {
        if (now - lastBtnStopMs >= 80) { // 80ms debounce
            lastBtnStopMs = now;
            if (currentStatus.controlMode == MODE_EMERGENCY) {
                releaseEmergencyStop();
                if (actuators != nullptr) {
                    actuators->setBuzzerPattern(BUZZER_SHORT_BEEP);
                }
                Serial.println("[BUTTON] 🟢 Physical STOP Button pressed: Released E-STOP! Resumed AUTO mode.");
            } else {
                triggerEmergencyStop(actuators);
                Serial.println("[BUTTON] 🔴 Physical STOP Button pressed: Triggered E-STOP! Sluice gate locked in position.");
            }
        }
    }
    lastBtnStopState = readStop;
    
    // If currently in hardware E-STOP, ignore other manual buttons
    if (currentStatus.controlMode == MODE_EMERGENCY) return;
    
    // 2. Manual CLOSE Button (GPIO26) - Direct Immediate Gate Closure to 0%
    if (lastBtnCloseState == HIGH && readClose == LOW) {
        if (now - lastBtnCloseMs >= 80) {
            lastBtnCloseMs = now;
            int targetPct = GATE_PCT_CLOSED; // Directly close gate to 0%!
            requestManualGatePercent(targetPct, MANUAL_WATCHDOG_TIMEOUT_SEC);
            if (actuators != nullptr) {
                actuators->setTargetGatePercent(GATE_PCT_CLOSED);
                actuators->setBuzzerPattern(BUZZER_SHORT_BEEP);
            }
            Serial.printf("[BUTTON] 🔽 Physical CLOSE Button pressed (GPIO26) -> Sluice Gate CLOSING to 0%% (Watchdog: %d s)\n", MANUAL_WATCHDOG_TIMEOUT_SEC);
        }
    }
    lastBtnCloseState = readClose;
    
    // 3. Manual OPEN Button (GPIO14) - Stepped Gate Opening (0% -> 20% -> 50% Max)
    if (lastBtnOpenState == HIGH && readOpen == LOW) {
        if (now - lastBtnOpenMs >= 80) {
            lastBtnOpenMs = now;
            int targetPct = (currentStatus.targetGatePercent < GATE_PCT_CLEAR_AREA) ? GATE_PCT_CLEAR_AREA : GATE_PCT_DANGER;
            requestManualGatePercent(targetPct, MANUAL_WATCHDOG_TIMEOUT_SEC);
            if (actuators != nullptr) {
                actuators->setTargetGatePercent(targetPct);
                actuators->setBuzzerPattern(BUZZER_SHORT_BEEP);
            }
            Serial.printf("[BUTTON] 🔼 Physical OPEN Button pressed (GPIO14) -> Sluice Gate OPENING to %d%% (Watchdog: %d s)\n", targetPct, MANUAL_WATCHDOG_TIMEOUT_SEC);
        }
    }
    lastBtnOpenState = readOpen;
}

void SDASStateMachine::triggerEmergencyStop(ActuatorManager* actuators) {
    currentStatus.controlMode = MODE_EMERGENCY;
    currentStatus.lastAlertMessage = "EMERGENCY: Hardware E-STOP triggered! Gate immobilized.";
    if (actuators != nullptr) {
        actuators->emergencyStop();
    }
}

void SDASStateMachine::releaseEmergencyStop() {
    currentStatus.controlMode = MODE_AUTO;
    currentStatus.manualModeExpiryMs = 0;
    preferences.putInt("ctrl_mode", (int)MODE_AUTO);
    currentStatus.lastAlertMessage = "NORMAL: Emergency cleared. Resumed autonomous regulation.";
}

void SDASStateMachine::requestManualGatePercent(int targetPercent, uint32_t durationSec) {
    if (currentStatus.controlMode == MODE_EMERGENCY) return; // Emergency takes precedence
    
    currentStatus.controlMode = MODE_MANUAL;
    // Hard clamp to safety limit (never exceed 50% max limit)
    currentStatus.targetGatePercent = constrain(targetPercent, 0, GATE_PCT_MAX_LIMIT);
    
    // If durationSec == 0, manual mode is held indefinitely until operator explicitly commands AUTO!
    if (durationSec == 0) {
        currentStatus.manualModeExpiryMs = 0; // Indefinite manual hold
    } else {
        currentStatus.manualModeExpiryMs = millis() + (durationSec * 1000UL);
    }
    
    saveGateStateToNVS(currentStatus.targetGatePercent);
    preferences.putInt("ctrl_mode", (int)MODE_MANUAL);
}

void SDASStateMachine::revertToAuto() {
    currentStatus.controlMode = MODE_AUTO;
    currentStatus.manualModeExpiryMs = 0;
    preferences.putInt("ctrl_mode", (int)MODE_AUTO);
    Serial.println("[FSM] 🟢 Control mode set to AUTO (Autonomous flood regulation active).");
}

bool SDASStateMachine::checkAndClearSmsTrigger(bool* isPriorityOut) {
    if (currentStatus.smsDispatchRequired) {
        currentStatus.smsDispatchRequired = false;
        if (isPriorityOut != nullptr) {
            *isPriorityOut = currentStatus.smsIsPriority;
        }
        return true;
    }
    return false;
}

void SDASStateMachine::evaluate(const SensorData& sensorData, ActuatorManager& actuators) {
    unsigned long now = millis();
    
    // Check hardware push buttons first with direct actuator reference
    checkPhysicalButtons(&actuators);
    
    // --- Step 1: Watchdog Auto-Revert for Manual Mode ---
    // Only auto-revert if an explicit timed duration was set (> 0).
    // If manualModeExpiryMs == 0, manual mode holds indefinitely as commanded by the operator!
    if (currentStatus.controlMode == MODE_MANUAL && currentStatus.manualModeExpiryMs > 0) {
        if (now >= currentStatus.manualModeExpiryMs) {
            Serial.println("[WATCHDOG] Manual timed override elapsed. Reverting to AUTO mode.");
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
        
        // Single advisory alert on fault transition (never scream continuous siren for sensor fault)
        if (!previousFaultState) {
            previousFaultState = true;
            actuators.setBuzzerPattern(BUZZER_SHORT_BEEP);
            currentStatus.smsDispatchRequired = true;
            currentStatus.smsIsPriority = true;
            currentStatus.lastAlertMessage = "[SDAS CRITICAL FAULT] Water level sensors offline. Automated gate holds position. Urgent inspection required.";
        }
        return;
    } else {
        previousFaultState = false;
    }
    
    // --- Step 4: Evaluate 4-Tier State Machine with 3% Hysteresis ---
    float level = sensorData.water_level_pct;
    AlertState previousAlert = currentStatus.alertState;
    AlertState nextAlert = previousAlert;
    
    // SAFETY OVERRIDE: If water reaches Danger (>= 85%), override Manual mode unless operator recently commanded it
    if (currentStatus.controlMode == MODE_MANUAL && level >= THRESH_DANGER_PCT) {
        unsigned long manualElapsedMs = (currentStatus.manualModeExpiryMs > now) ? 
            ((MANUAL_WATCHDOG_TIMEOUT_SEC * 1000UL) - (currentStatus.manualModeExpiryMs - now)) : 999999UL;
        
        // Allow operator manual control for at least 15 seconds before autonomous flood protection kicks in
        if (manualElapsedMs > 15000UL) {
            revertToAuto();
            Serial.println("[SAFETY] DANGER threshold (85%) reached! Overriding MANUAL mode to AUTO for flood protection.");
        }
    }
    
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
    
    // Check if alert state stepped UP (escalation only) to trigger automatic SMS
    if (nextAlert != previousAlert) {
        if (nextAlert > previousAlert) {
            // Escalation: Send SMS broadcast
            if (nextAlert == STATE_PRE_WARNING) {
                currentStatus.smsDispatchRequired = true;
                currentStatus.smsIsPriority = false;
                currentStatus.lastAlertMessage = "PRE-WARNING ALERT: Reservoir reached 60% capacity. Sluice gates on standby.";
            } else if (nextAlert == STATE_CLEAR_AREA) {
                currentStatus.smsDispatchRequired = true;
                currentStatus.smsIsPriority = false;
                currentStatus.lastAlertMessage = "CLEAR AREA ALERT: Reservoir at 80%+. Sluice gate opening 20%. Evacuate spillway zones.";
            } else if (nextAlert == STATE_DANGER) {
                currentStatus.smsDispatchRequired = true;
                currentStatus.smsIsPriority = true;
                currentStatus.lastAlertMessage = "CRITICAL DANGER: Reservoir at 85%+. Sluice gate opening 50%. High flood risk imminent!";
            }
        }
        currentStatus.alertState = nextAlert;
    }
    
    // --- Step 5: Update Visual and Audible Actuators ---
    // In AUTO: reflects true reservoir flood stage. In MANUAL: reflects active discharge stage!
    AlertState displayAlert = currentStatus.alertState;
    if (currentStatus.controlMode == MODE_MANUAL) {
        if (currentStatus.targetGatePercent >= GATE_PCT_DANGER) {
            displayAlert = STATE_DANGER;      // 50% Emergency flood release: RED
        } else if (currentStatus.targetGatePercent >= GATE_PCT_CLEAR_AREA) {
            displayAlert = STATE_CLEAR_AREA;  // 20% Advisory relief: ORANGE
        } else if (currentStatus.targetGatePercent > 0) {
            displayAlert = STATE_PRE_WARNING; // Partial gate: YELLOW
        } else {
            // Sluice gate is 0% closed: reflect real water level alert (NORMAL = Green)
            displayAlert = currentStatus.alertState;
        }
    } else if (currentStatus.controlMode == MODE_EMERGENCY) {
        displayAlert = STATE_DANGER; // Red for emergency stop
    }
    
    actuators.setRGBAlert(displayAlert);
    
    if (displayAlert == STATE_DANGER) {
        actuators.setBuzzerPattern(BUZZER_PULSE_DANGER);
    } else if (!actuators.isBeeping()) {
        // Preserve short confirmation beeps from being prematurely silenced
        actuators.setBuzzerPattern(BUZZER_OFF);
    }
    
    // --- Step 6: Determine Gate Position (If in AUTO Mode) ---
    if (currentStatus.controlMode == MODE_AUTO) {
        switch (currentStatus.alertState) {
            case STATE_NORMAL:
            case STATE_PRE_WARNING:
                // Preserve water: Gate remains 0% closed
                currentStatus.targetGatePercent = GATE_PCT_CLOSED;
                break;
                
            case STATE_CLEAR_AREA:
                // Pre-emptive discharge: Gate 20% open (Advisory)
                currentStatus.targetGatePercent = GATE_PCT_CLEAR_AREA;
                break;
                
            case STATE_DANGER:
                // Major emergency discharge: Gate 50% open (Danger limit)
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
