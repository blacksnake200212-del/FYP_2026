#include "actuators.h"

ActuatorManager::ActuatorManager()
    : currentAngle(0.0f), targetAngle(0.0f), currentPercent(0), targetPercent(0),
      lastServoStepMs(0), currentBuzzerPattern(BUZZER_OFF),
      lastBuzzerToggleMs(0), buzzerState(false),
      currentAlertState(STATE_NORMAL), orangePwmCounter(0) {}

void ActuatorManager::begin() {
    // 1. Configure RGB Pins (Common Anode, Active LOW)
    pinMode(PIN_LED_RED, OUTPUT);
    pinMode(PIN_LED_GREEN, OUTPUT);
    pinMode(PIN_LED_BLUE, OUTPUT);
    // Turn all OFF at boot (HIGH = OFF)
    writeRGB(false, false, false);
    
    // 2. Configure Buzzer Transistor Driver
    pinMode(PIN_BUZZER, OUTPUT);
    digitalWrite(PIN_BUZZER, LOW); // Transistor OFF
    
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

// Active-LOW control for Common Anode LED
void ActuatorManager::writeRGB(bool r_on, bool g_on, bool b_on) {
    digitalWrite(PIN_LED_RED,   r_on ? LOW : HIGH);
    digitalWrite(PIN_LED_GREEN, g_on ? LOW : HIGH);
    digitalWrite(PIN_LED_BLUE,  b_on ? LOW : HIGH);
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
        // Red is continuously ON (LOW); Green is ON (LOW) 25% of the time (1 out of 4 cycles)
        digitalWrite(PIN_LED_RED, LOW);
        digitalWrite(PIN_LED_GREEN, (orangePwmCounter == 0) ? LOW : HIGH);
        digitalWrite(PIN_LED_BLUE, HIGH);
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
