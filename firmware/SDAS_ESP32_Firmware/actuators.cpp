#include "actuators.h"

ActuatorManager::ActuatorManager()
    : currentAngle(0.0f), targetAngle(0.0f), currentPercent(0),
      lastServoStepMs(0), currentBuzzerPattern(BUZZER_OFF),
      lastBuzzerToggleMs(0), buzzerState(false) {}

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
    
    // 3. Configure ESP32 LEDC PWM for MG996R Servo (GPIO25)
    ledcSetup(SERVO_LEDC_CHANNEL, SERVO_LEDC_FREQ, SERVO_LEDC_RES);
    ledcAttachPin(PIN_SERVO, SERVO_LEDC_CHANNEL);
    
    // Initialize to closed (0 degrees)
    setTargetGatePercent(GATE_PCT_CLOSED);
    currentAngle = 0.0f;
    writeServoMicroseconds(SERVO_MIN_US);
}

void ActuatorManager::writeServoMicroseconds(uint16_t us) {
    // 50 Hz period = 20,000 microseconds = 20 ms
    // 16-bit resolution: 2^16 - 1 = 65,535
    // Duty cycle = (us / 20000.0) * 65535
    uint32_t duty = (uint32_t)(((float)us / 20000.0f) * 65535.0f);
    ledcWrite(SERVO_LEDC_CHANNEL, duty);
}

void ActuatorManager::setTargetGatePercent(int percent) {
    if (percent < 0) percent = 0;
    if (percent > 100) percent = 100;
    
    currentPercent = percent;
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
    switch (state) {
        case STATE_NORMAL:
            // Pure Green
            writeRGB(false, true, false);
            break;
        case STATE_PRE_WARNING:
            // Yellow (Red + Green)
            writeRGB(true, true, false);
            break;
        case STATE_CLEAR_AREA:
            // Orange (Red dominant with partial Green)
            // On digital lines: pulse Red + Green
            writeRGB(true, true, false);
            break;
        case STATE_DANGER:
            // Pure Red
            writeRGB(true, false, false);
            break;
        case STATE_SENSOR_FAULT:
            // Magenta / Purple (Red + Blue)
            writeRGB(true, false, true);
            break;
        default:
            writeRGB(false, false, false);
            break;
    }
}

void ActuatorManager::setBuzzerPattern(BuzzerPattern pattern) {
    currentBuzzerPattern = pattern;
    if (pattern == BUZZER_OFF) {
        digitalWrite(PIN_BUZZER, LOW);
        buzzerState = false;
    } else if (pattern == BUZZER_CONTINUOUS_ESTOP) {
        digitalWrite(PIN_BUZZER, HIGH);
        buzzerState = true;
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
            currentBuzzerPattern = BUZZER_OFF;
        }
    }
}

void ActuatorManager::emergencyStop() {
    targetAngle = currentAngle; // Lock current physical angle
    setBuzzerPattern(BUZZER_CONTINUOUS_ESTOP);
    writeRGB(true, false, true); // Visual hazard warning
}
