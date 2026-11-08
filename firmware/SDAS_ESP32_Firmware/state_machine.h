#ifndef SDAS_STATE_MACHINE_H
#define SDAS_STATE_MACHINE_H

#include <Arduino.h>
#include <Preferences.h>
#include "config.h"
#include "actuators.h"
#include "sensors.h"

enum ControlMode {
    MODE_AUTO = 0,
    MODE_MANUAL = 1,
    MODE_EMERGENCY = 2
};

struct SystemStatus {
    AlertState  alertState;
    ControlMode controlMode;
    int         targetGatePercent;
    int         actualGatePercent;
    bool        smsDispatchRequired;
    bool        smsIsPriority;
    const char* lastAlertMessage;
    unsigned long manualModeExpiryMs;
};

class SDASStateMachine {
public:
    SDASStateMachine();
    void begin();
    
    // Core state evaluation called on each sensor update
    void evaluate(const SensorData& sensorData, ActuatorManager& actuators);
    
    // Manual & Emergency overrides
    void requestManualGatePercent(int targetPercent, uint32_t durationSec);
    void triggerEmergencyStop(ActuatorManager* actuators = nullptr);
    void releaseEmergencyStop();
    void revertToAuto();
    
    // Hardware button polling (with 250ms sustained-hold debounce and optional direct actuator trigger)
    void checkPhysicalButtons(ActuatorManager* actuators = nullptr);
    void printButtonStatus() const;
    void setButtonsEnabled(bool enabled);
    bool areButtonsEnabled() const { return physicalButtonsEnabled; }
    
    const SystemStatus& getStatus() const { return currentStatus; }
    bool checkAndClearSmsTrigger(bool* isPriorityOut = nullptr);

private:
    SystemStatus currentStatus;
    Preferences  preferences;
    bool         previousFaultState;
    bool         physicalButtonsEnabled;
    
    // Button sustained-hold debouncing state (250ms continuous hold required)
    unsigned long btnStopHoldStartMs;
    unsigned long btnCloseHoldStartMs;
    unsigned long btnOpenHoldStartMs;
    bool btnStopHandled;
    bool btnCloseHandled;
    bool btnOpenHandled;
    
    void saveGateStateToNVS(int percent);
    int  loadGateStateFromNVS();
};

#endif // SDAS_STATE_MACHINE_H
