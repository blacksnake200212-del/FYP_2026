#ifndef SDAS_SENSORS_H
#define SDAS_SENSORS_H

#include <Arduino.h>
#include "config.h"

struct SensorData {
    float raw_dist_1_cm;
    float raw_dist_2_cm;
    bool  sensor_1_valid;
    bool  sensor_2_valid;
    float sensor_delta_cm;
    bool  sensors_in_agreement;
    
    float temperature_c;
    float humidity_pct;
    float speed_of_sound_mps;
    
    float water_level_cm;
    float water_level_pct;
    float rate_of_change_cm_s;
    
    bool  degraded_mode;       // True if operating on single sensor fallback
    bool  critical_sensor_fault; // True if both sensors fail plausibility
    unsigned long timestamp_ms;
};

class SensorManager {
public:
    SensorManager();
    void begin();
    SensorData sampleAndVerify();
    float getLastWaterLevelPct() const { return currentData.water_level_pct; }
    const SensorData& getData() const { return currentData; }

private:
    SensorData currentData;
    float previousWaterLevelCm;
    unsigned long previousSampleTimeMs;

    float measureSingleUltrasonic(uint8_t trigPin, uint8_t echoPin, float speedOfSound);
    void readDHTSensors();
    float calculateSpeedOfSound(float tempC);
};

#endif // SDAS_SENSORS_H
