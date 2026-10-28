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
    
    // Direct actuator override for failsafe
    void emergencyStop();

private:
    bool  isCommonAnode;
    float currentAngle;
    float targetAngle;
    int   currentPercent;
    int   targetPercent;
    unsigned long lastServoStepMs;
    
    BuzzerPattern currentBuzzerPattern;
    unsigned long lastBuzzerToggleMs;
    bool buzzerState;
    
    AlertState currentAlertState;
    uint8_t orangePwmCounter;
    
    void writeServoMicroseconds(uint16_t us);
    void writeRGB(bool r_on, bool g_on, bool b_on);
};

#endif // SDAS_ACTUATORS_H
