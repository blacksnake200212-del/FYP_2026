#include "actuators.h"
#include <Preferences.h>

ActuatorManager::ActuatorManager()
    : isCommonAnode(RGB_IS_COMMON_ANODE),
      currentAngle(0.0f), targetAngle(0.0f), currentPercent(0), targetPercent(0),
      lastServoStepMs(0), currentBuzzerPattern(BUZZER_OFF),
      lastBuzzerToggleMs(0), buzzerState(false),
      currentAlertState(STATE_NORMAL), orangePwmCounter(0) {}

void ActuatorManager::begin() {
    // 1. Configure RGB Pins (Common Cathode / Common Anode)
    pinMode(PIN_LED_RED, OUTPUT);
    pinMode(PIN_LED_GREEN, OUTPUT);
    pinMode(PIN_LED_BLUE, OUTPUT);
    
    // Load saved polarity preference from Flash
    Preferences prefs;
    prefs.begin("sdas_act", false);
    isCommonAnode = prefs.getBool("rgb_ca", RGB_IS_COMMON_ANODE);
    prefs.end();
    
    Serial.printf("[RGB] LED Polarity configured as: %s\n",
        isCommonAnode ? "COMMON ANODE (Active LOW, 3.3V to Anode)" : "COMMON CATHODE (Active HIGH, GND to Cathode)");
    
    // Hardware Startup Self-Test: Red -> Green -> Blue -> Off
    Serial.println("[RGB] Running LED Hardware Self-Test: RED -> GREEN -> BLUE -> OFF");
    writeRGB(true, false, false); // Red
    delay(450);
    writeRGB(false, true, false); // Green
    delay(450);
    writeRGB(false, false, true); // Blue
    delay(450);
    writeRGB(false, false, false); // All OFF
    Serial.println("[RGB] Self-test complete. (Tip: Type 'RGB' in Serial Monitor if colors were inverted!)");
    
    // 2. Configure Buzzer Transistor Driver
    pinMode(PIN_BUZZER, OUTPUT);
    digitalWrite(PIN_BUZZER, LOW); // Transistor OFF
    
    // Buzzer startup chirp (tests audio line on boot)
    Serial.println("[BUZZER] Audio driver online (GPIO27). Emitting startup chirp...");
    testBuzzerTone(2400, 120);
    
    // 3. Configure ESP32 LEDC PWM for MG90S Servo (GPIO25)
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
    ledcAttach(PIN_SERVO, SERVO_LEDC_FREQ, SERVO_LEDC_RES);
#else
    ledcSetup(SERVO_LEDC_CHANNEL, SERVO_LEDC_FREQ, SERVO_LEDC_RES);
    ledcAttachPin(PIN_SERVO, SERVO_LEDC_CHANNEL);
#endif
    
    // Initialize to closed (0 degrees) without slamming
    targetPercent = GATE_PCT_CLOSED;
    currentPercent = GATE_PCT_CLOSED;
    currentAngle = 0.0f;
    targetAngle = 0.0f;
    writeServoMicroseconds(SERVO_MIN_US);
}

void ActuatorManager::writeServoMicroseconds(uint16_t us) {
    // 50 Hz period = 20,000 microseconds = 20 ms
    // 16-bit resolution: 2^16 - 1 = 65,535
    // Duty cycle = (us / 20000.0) * 65535
    uint32_t duty = (uint32_t)(((float)us / 20000.0f) * 65535.0f);
#if defined(ESP_ARDUINO_VERSION_MAJOR) && ESP_ARDUINO_VERSION_MAJOR >= 3
    ledcWrite(PIN_SERVO, duty);
#else
    ledcWrite(SERVO_LEDC_CHANNEL, duty);
#endif
}

void ActuatorManager::setTargetGatePercent(int percent) {
    // Hard clamp to safety limit (never exceed 50% max limit)
    percent = constrain(percent, 0, GATE_PCT_MAX_LIMIT);
    targetPercent = percent;
    
    // Map 0 - 100% to 0 - 180 degrees
    targetAngle = ((float)percent / 100.0f) * 180.0f;
}

void ActuatorManager::updateServoMotion() {
    unsigned long now = millis();
    // Move servo by 1 degree every 15 ms for smooth, surge-free travel
    if (now - lastServoStepMs >= 15) {
        lastServoStepMs = now;
        
        if (fabsf(currentAngle - targetAngle) > 0.5f) {
            if (currentAngle < targetAngle) {
                currentAngle += 1.0f;
                if (currentAngle > targetAngle) currentAngle = targetAngle;
            } else {
                currentAngle -= 1.0f;
                if (currentAngle < targetAngle) currentAngle = targetAngle;
            }
            
            // Map angle (0-180) to microseconds (500us - 2500us)
            uint16_t pulseUs = SERVO_MIN_US + (uint16_t)((currentAngle / 180.0f) * (SERVO_MAX_US - SERVO_MIN_US));
            writeServoMicroseconds(pulseUs);
            
            // Calculate actual physical gate percentage dynamically from real angle
            currentPercent = (int)roundf((currentAngle / 180.0f) * 100.0f);
        } else {
            currentAngle = targetAngle;
            currentPercent = targetPercent;
        }
    }
}

// Dual Polarity RGB Control (Supports Common Cathode and Common Anode dynamically)
void ActuatorManager::writeRGB(bool r_on, bool g_on, bool b_on) {
    if (isCommonAnode) {
        // Active LOW (3.3V to Anode): LOW turns LED ON
        digitalWrite(PIN_LED_RED,   r_on ? LOW : HIGH);
        digitalWrite(PIN_LED_GREEN, g_on ? LOW : HIGH);
        digitalWrite(PIN_LED_BLUE,  b_on ? LOW : HIGH);
    } else {
        // Active HIGH (GND to Cathode): HIGH turns LED ON
        digitalWrite(PIN_LED_RED,   r_on ? HIGH : LOW);
        digitalWrite(PIN_LED_GREEN, g_on ? HIGH : LOW);
        digitalWrite(PIN_LED_BLUE,  b_on ? HIGH : LOW);
    }
}

bool ActuatorManager::togglePolarity() {
    isCommonAnode = !isCommonAnode;
    Preferences prefs;
    prefs.begin("sdas_act", false);
    prefs.putBool("rgb_ca", isCommonAnode);
    prefs.end();
    
    Serial.printf("[RGB] LED polarity switched to: %s (Saved to Flash!)\n",
        isCommonAnode ? "COMMON ANODE (Active LOW)" : "COMMON CATHODE (Active HIGH)");
    
    // Quick confirmation flash: RED -> GREEN -> BLUE
    writeRGB(true, false, false);
    delay(250);
    writeRGB(false, true, false);
    delay(250);
    writeRGB(false, false, true);
    delay(250);
    
    // Restore current alert state
    setRGBAlert(currentAlertState);
    return isCommonAnode;
}

void ActuatorManager::setCommonAnode(bool enabled) {
    if (isCommonAnode != enabled) {
        togglePolarity();
    }
}

void ActuatorManager::runHardwareCycleTest() {
    Serial.println("\n=======================================================");
    Serial.println("  ACTUATOR HARDWARE CYCLE TEST (VISUAL & AUDIO)");
    Serial.println("=======================================================");
    
    Serial.println("[TEST] Stage 1/4: NORMAL State (Green LED, Gate 0%, Siren OFF)");
    writeRGB(false, true, false);
    setTargetGatePercent(0);
    delay(1200);
    
    Serial.println("[TEST] Stage 2/4: PRE-WARNING State (Yellow LED, Gate 0%, Siren OFF)");
    writeRGB(true, true, false);
    delay(1200);
    
    Serial.println("[TEST] Stage 3/4: CLEAR AREA State (Orange LED, Gate Opening to 20%)");
    setTargetGatePercent(20);
    for (int i = 0; i < 24; i++) {
        writeRGB(true, (i % 4 == 0), false);
        updateServoMotion();
        delay(50);
    }
    
    Serial.println("[TEST] Stage 4/4: CRITICAL DANGER (Red LED, Gate Opening to 50%, Siren Pulse)");
    setTargetGatePercent(50);
    writeRGB(true, false, false);
    digitalWrite(PIN_BUZZER, HIGH);
    delay(250);
    digitalWrite(PIN_BUZZER, LOW);
    for (int i = 0; i < 20; i++) {
        updateServoMotion();
        delay(50);
    }
    
    Serial.println("[TEST] Actuator cycle completed successfully. Restoring system state...\n");
    setTargetGatePercent(targetPercent);
    setRGBAlert(currentAlertState);
}

void ActuatorManager::setRGBAlert(AlertState state) {
    currentAlertState = state;
    switch (state) {
        case STATE_NORMAL:
            // Pure Green
            writeRGB(false, true, false);
            break;
        case STATE_PRE_WARNING:
            // Yellow: 100% Red + 100% Green
            writeRGB(true, true, false);
            break;
        case STATE_CLEAR_AREA:
            // Orange: 100% Red + 25% Green duty cycle (handled in updateIndicators)
            writeRGB(true, false, false);
            break;
        case STATE_DANGER:
            // Pure Red
            writeRGB(true, false, false);
            break;
        case STATE_SENSOR_FAULT:
            // Magenta / Purple: Red + Blue
            writeRGB(true, false, true);
            break;
        default:
            writeRGB(false, false, false);
            break;
    }
}

void ActuatorManager::updateIndicators(unsigned long millisNow) {
    // Update Orange color modulation for CLEAR_AREA stage
    if (currentAlertState == STATE_CLEAR_AREA) {
        orangePwmCounter = (orangePwmCounter + 1) % 4;
        // Red 100%, Green 25% (creates Orange)
        writeRGB(true, (orangePwmCounter == 0), false);
    }
    
    updateBuzzer(millisNow);
}

void ActuatorManager::setBuzzerPattern(BuzzerPattern pattern) {
    currentBuzzerPattern = pattern;
    if (pattern == BUZZER_OFF) {
        digitalWrite(PIN_BUZZER, LOW);
        buzzerState = false;
    } else if (pattern == BUZZER_CONTINUOUS_ESTOP) {
        digitalWrite(PIN_BUZZER, HIGH);
        buzzerState = true;
    } else if (pattern == BUZZER_SHORT_BEEP) {
        digitalWrite(PIN_BUZZER, HIGH);
        buzzerState = true;
        lastBuzzerToggleMs = millis();
    }
}

void ActuatorManager::updateBuzzer(unsigned long millisNow) {
    if (currentBuzzerPattern == BUZZER_OFF || currentBuzzerPattern == BUZZER_CONTINUOUS_ESTOP) {
        return;
    }
    
    if (currentBuzzerPattern == BUZZER_PULSE_DANGER) {
        // Danger siren: 250ms ON, 250ms OFF
        if (millisNow - lastBuzzerToggleMs >= 250) {
            lastBuzzerToggleMs = millisNow;
            buzzerState = !buzzerState;
            digitalWrite(PIN_BUZZER, buzzerState ? HIGH : LOW);
        }
    } else if (currentBuzzerPattern == BUZZER_SHORT_BEEP) {
        // Confirmation beep: 100ms then auto-off
        if (millisNow - lastBuzzerToggleMs >= 100) {
            digitalWrite(PIN_BUZZER, LOW);
            buzzerState = false;
            currentBuzzerPattern = BUZZER_OFF;
        }
    }
}

void ActuatorManager::emergencyStop() {
    targetAngle = currentAngle; // Lock current physical angle immediately
    targetPercent = currentPercent;
    setBuzzerPattern(BUZZER_CONTINUOUS_ESTOP);
    writeRGB(true, false, true); // Visual hazard warning (Purple/Magenta)
}

void ActuatorManager::testBuzzerDirect(bool state) {
    digitalWrite(PIN_BUZZER, state ? HIGH : LOW);
    Serial.printf("[BUZZER] GPIO27 state set to: %s (%s)\n",
        state ? "HIGH (3.3V)" : "LOW (0V)",
        state ? "Transistor ON, Buzzer powered" : "Transistor OFF");
}

void ActuatorManager::testBuzzerChirp(uint16_t durationMs) {
    Serial.printf("[BUZZER] Emitting active buzzer DC pulse for %d ms...\n", durationMs);
    digitalWrite(PIN_BUZZER, HIGH);
    delay(durationMs);
    digitalWrite(PIN_BUZZER, LOW);
}

void ActuatorManager::testBuzzerTone(uint16_t freqHz, uint16_t durationMs) {
    if (freqHz == 0) return;
    uint32_t periodUs = 1000000UL / freqHz;
    uint32_t halfPeriodUs = periodUs / 2;
    uint32_t cycles = ((uint32_t)durationMs * 1000UL) / periodUs;
    
    for (uint32_t i = 0; i < cycles; i++) {
        digitalWrite(PIN_BUZZER, HIGH);
        delayMicroseconds(halfPeriodUs);
        digitalWrite(PIN_BUZZER, LOW);
        delayMicroseconds(halfPeriodUs);
    }
}
