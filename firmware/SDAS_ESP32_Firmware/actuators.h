#ifndef SDAS_ACTUATORS_H
#define SDAS_ACTUATORS_H

#include <Arduino.h>
#include "config.h"

enum AlertState {
    STATE_NORMAL = 0,
    STATE_PRE_WARNING = 1,
    STATE_CLEAR_AREA = 2,
    STATE_DANGER = 3,
    STATE_SENSOR_FAULT = 4
};

enum BuzzerPattern {
    BUZZER_OFF = 0,
    BUZZER_PULSE_DANGER = 1,
    BUZZER_CONTINUOUS_ESTOP = 2,
    BUZZER_SHORT_BEEP = 3
};

class ActuatorManager {
public:
    ActuatorManager();
    void begin();
    
    // Servo Gate Control
    void setTargetGatePercent(int percent);
    void updateServoMotion();
    int  getCurrentGatePercent() const { return currentPercent; }
    int  getTargetGatePercent() const { return targetPercent; }
    int  getCurrentAngleDeg() const { return (int)currentAngle; }
    bool isMoving() const { return (fabsf(currentAngle - targetAngle) > 0.5f); }
    void setServoStepDeg(float step) { servoStepDeg = constrain(step, 0.5f, 15.0f); }
    float getServoStepDeg() const { return servoStepDeg; }
    
    // Indicators & Alarms
    void setRGBAlert(AlertState state);
    void setBuzzerPattern(BuzzerPattern pattern);
    void updateBuzzer(unsigned long millisNow);
    void updateIndicators(unsigned long millisNow);
    bool isBeeping() const { return currentBuzzerPattern == BUZZER_SHORT_BEEP; }
    
    // RGB Polarity Control & Diagnostic Testing
    bool togglePolarity();
    void setCommonAnode(bool enabled);
    bool isPolarityCommonAnode() const { return isCommonAnode; }
    void runHardwareCycleTest();
    void writeRGB(bool r_on, bool g_on, bool b_on);
    
    // Buzzer Diagnostics & Hardware Testing
    void testBuzzerDirect(bool state);
    void testBuzzerChirp(uint16_t durationMs = 500);
    void testBuzzerTone(uint16_t freqHz = 2400, uint16_t durationMs = 500);
    void setMuted(bool muted);
    bool toggleMute();
    bool isBuzzerMuted() const { return isMuted; }
    
    // Direct actuator override for failsafe
    void emergencyStop();

private:
    bool  isCommonAnode;
    bool  isMuted;
    float currentAngle;
    float targetAngle;
    float servoStepDeg;
    int   currentPercent;
    int   targetPercent;
    unsigned long lastServoStepMs;
    
    BuzzerPattern currentBuzzerPattern;
    unsigned long lastBuzzerToggleMs;
    bool buzzerState;
    
    AlertState currentAlertState;
    uint8_t orangePwmCounter;
    
    void writeServoMicroseconds(uint16_t us);
};

#endif // SDAS_ACTUATORS_H
