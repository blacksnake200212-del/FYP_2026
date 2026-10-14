#include "sensors.h"

SensorManager::SensorManager() 
    : previousWaterLevelCm(0.0f), previousSampleTimeMs(0) {
    memset(&currentData, 0, sizeof(SensorData));
}

void SensorManager::begin() {
    pinMode(PIN_TRIG_1, OUTPUT);
    pinMode(PIN_ECHO_1, INPUT);
    pinMode(PIN_TRIG_2, OUTPUT);
    pinMode(PIN_ECHO_2, INPUT);
    
    digitalWrite(PIN_TRIG_1, LOW);
    digitalWrite(PIN_TRIG_2, LOW);
    
    pinMode(PIN_DHT, INPUT_PULLUP);
    
    // Default initial readings
    currentData.temperature_c = 28.0f; // Typical Puttalam ambient baseline
    currentData.humidity_pct = 75.0f;
    currentData.speed_of_sound_mps = calculateSpeedOfSound(28.0f);
}

float SensorManager::calculateSpeedOfSound(float tempC) {
    // Standard acoustic relationship: v = 331.4 + 0.606 * T (m/s)
    return 331.4f + (0.606f * tempC);
}

// Low-overhead DHT22 bit-banging driver for field resilience
void SensorManager::readDHTSensors() {
    uint8_t data[5] = {0, 0, 0, 0, 0};
    
    // Wakeup sequence: Pull line LOW for >= 1 ms, then HIGH for 30 us
    pinMode(PIN_DHT, OUTPUT);
    digitalWrite(PIN_DHT, LOW);
    delay(2);
    digitalWrite(PIN_DHT, HIGH);
    delayMicroseconds(30);
    pinMode(PIN_DHT, INPUT_PULLUP);
    
    // Await sensor response (80us LOW + 80us HIGH)
    unsigned long timeout = micros() + 200;
    while (digitalRead(PIN_DHT) == HIGH) {
        if (micros() > timeout) return; // Retain previous valid reading
    }
    timeout = micros() + 200;
    while (digitalRead(PIN_DHT) == LOW) {
        if (micros() > timeout) return;
    }
    timeout = micros() + 200;
    while (digitalRead(PIN_DHT) == HIGH) {
        if (micros() > timeout) return;
    }
    
    // Read 40 bits (5 bytes) with interrupt protection
    noInterrupts();
    for (int i = 0; i < 40; i++) {
        timeout = micros() + 100;
        while (digitalRead(PIN_DHT) == LOW) {
            if (micros() > timeout) {
                interrupts();
                return;
            }
        }
        unsigned long tStart = micros();
        timeout = micros() + 150;
        while (digitalRead(PIN_DHT) == HIGH) {
            if (micros() > timeout) {
                interrupts();
                return;
            }
        }
        // If pulse width > 40 us, bit is 1, else 0
        if ((micros() - tStart) > 40) {
            data[i / 8] |= (1 << (7 - (i % 8)));
        }
    }
    interrupts();
    
    // Checksum verification
    if (data[4] == ((data[0] + data[1] + data[2] + data[3]) & 0xFF)) {
        float rawHumidity = ((data[0] << 8) | data[1]) * 0.1f;
        int16_t rawTemp = ((data[2] & 0x7F) << 8) | data[3];
        if (data[2] & 0x80) rawTemp = -rawTemp;
        float finalTemp = rawTemp * 0.1f;
        
        if (finalTemp >= -10.0f && finalTemp <= 65.0f && rawHumidity >= 5.0f && rawHumidity <= 100.0f) {
            currentData.temperature_c = finalTemp;
            currentData.humidity_pct = rawHumidity;
            currentData.speed_of_sound_mps = calculateSpeedOfSound(finalTemp);
        }
    }
}

float SensorManager::measureSingleUltrasonic(uint8_t trigPin, uint8_t echoPin, float speedOfSound) {
    // Clear trigger
    digitalWrite(trigPin, LOW);
    delayMicroseconds(4);
    
    // 20 microsecond HIGH pulse to activate JSN-SR04T transducer burst reliably (industrial standard)
    digitalWrite(trigPin, HIGH);
    delayMicroseconds(20);
    digitalWrite(trigPin, LOW);
    
    // Measure echo pulse width (timeout 30,000 us ~= 5 meters)
    unsigned long durationUs = pulseIn(echoPin, HIGH, 30000UL);
    
    if (durationUs == 0) {
        return -1.0f; // Timeout / No echo returned
    }
    
    // Distance in cm = (Time in s * Speed in cm/s) / 2
    // durationUs * 1e-6 * (speedOfSound * 100.0) / 2.0
    float distanceCm = (durationUs * 1e-6f * (speedOfSound * 100.0f)) / 2.0f;
    return distanceCm;
}

SensorData SensorManager::sampleAndVerify() {
    unsigned long now = millis();
    readDHTSensors();
    
    // --- Step 1: Alternating Ultrasonic Ping Sequence ---
    // Trigger Sensor 1 (Primary)
    float d1 = measureSingleUltrasonic(PIN_TRIG_1, PIN_ECHO_1, currentData.speed_of_sound_mps);
    
    // 60 ms acoustic blanking interval: allows reverberations to completely attenuate
    delay(60);
    
    // Trigger Sensor 2 (Redundant)
    float d2 = measureSingleUltrasonic(PIN_TRIG_2, PIN_ECHO_2, currentData.speed_of_sound_mps);
    
    currentData.raw_dist_1_cm = d1;
    currentData.raw_dist_2_cm = d2;
    currentData.timestamp_ms = now;
    
    // --- Step 2: Physical Limit & Range Verification ---
    // CRITICAL FIX: If distance is closer than the 20 cm blind zone (d > 0 and d < 20cm),
    // water is at or exceeding 100% capacity (extreme flood danger). This is NOT a sensor fault!
    float minBlindZoneDist = SENSOR_MOUNT_HEIGHT_CM - TANK_MAX_DEPTH_CM; // Distance at 100% full
    
    bool d1_blindzone = (d1 >= 0.0f && d1 < SENSOR_MIN_VALID_DIST_CM);
    bool d2_blindzone = (d2 >= 0.0f && d2 < SENSOR_MIN_VALID_DIST_CM);
    
    if (d1_blindzone) {
        d1 = minBlindZoneDist; // Clamp to 100% capacity
        currentData.sensor_1_valid = true;
    } else {
        currentData.sensor_1_valid = (d1 >= SENSOR_MIN_VALID_DIST_CM && d1 <= SENSOR_MAX_VALID_DIST_CM);
    }
    
    if (d2_blindzone) {
        d2 = minBlindZoneDist; // Clamp to 100% capacity
        currentData.sensor_2_valid = true;
    } else {
        currentData.sensor_2_valid = (d2 >= SENSOR_MIN_VALID_DIST_CM && d2 <= SENSOR_MAX_VALID_DIST_CM);
    }
    
    float fusedDistanceCm = 0.0f;
    
    if (currentData.sensor_1_valid && currentData.sensor_2_valid) {
        currentData.sensor_delta_cm = fabsf(d1 - d2);
        
        // --- Step 3: Sensor Voting & Agreement Check ---
        if (currentData.sensor_delta_cm <= SENSOR_MAX_DELTA_CM) {
            // Both agree within 5.0 cm: High-confidence fused average
            fusedDistanceCm = (d1 + d2) * 0.5f;
            currentData.sensors_in_agreement = true;
            currentData.degraded_mode = false;
            currentData.critical_sensor_fault = false;
        } else {
            // Divergence > 5.0 cm: Degraded mode, prefer reading closest to previous depth
            currentData.sensors_in_agreement = false;
            currentData.degraded_mode = true;
            currentData.critical_sensor_fault = false;
            
            float targetPrevDist = SENSOR_MOUNT_HEIGHT_CM - previousWaterLevelCm;
            if (fabsf(d1 - targetPrevDist) < fabsf(d2 - targetPrevDist)) {
                fusedDistanceCm = d1;
            } else {
                fusedDistanceCm = d2;
            }
        }
    } else if (currentData.sensor_1_valid) {
        // Sensor 2 failed: Fallback to Sensor 1
        fusedDistanceCm = d1;
        currentData.sensor_delta_cm = 999.0f;
        currentData.sensors_in_agreement = false;
        currentData.degraded_mode = true;
        currentData.critical_sensor_fault = false;
    } else if (currentData.sensor_2_valid) {
        // Sensor 1 failed: Fallback to Sensor 2
        fusedDistanceCm = d2;
        currentData.sensor_delta_cm = 999.0f;
        currentData.sensors_in_agreement = false;
        currentData.degraded_mode = true;
        currentData.critical_sensor_fault = false;
    } else {
        // Genuine Critical Failure: Both sensors offline/disconnected (e.g. echo timeout)
        currentData.critical_sensor_fault = true;
        currentData.degraded_mode = true;
        currentData.sensors_in_agreement = false;
        // Retain last known safe water level
        return currentData;
    }
    
    // --- Step 4: Water Level Calculation ---
    // Water Depth = Total Height from Tank Floor to Sensor - Measured Distance
    float calculatedDepthCm = SENSOR_MOUNT_HEIGHT_CM - fusedDistanceCm;
    if (calculatedDepthCm < 0.0f) calculatedDepthCm = 0.0f;
    if (calculatedDepthCm > TANK_MAX_DEPTH_CM) calculatedDepthCm = TANK_MAX_DEPTH_CM;
    
    // --- Step 5: Rate of Change Plausibility Filter ---
    if (previousSampleTimeMs > 0) {
        float dtSeconds = (now - previousSampleTimeMs) / 1000.0f;
        if (dtSeconds > 0.1f) {
            float deltaLevel = calculatedDepthCm - previousWaterLevelCm;
            float rateCmPerSec = fabsf(deltaLevel) / dtSeconds;
            currentData.rate_of_change_cm_s = rateCmPerSec;
            
            // If rate of change exceeds physical maximum (water slosh / foreign object), dampen spike
            if (rateCmPerSec > SENSOR_MAX_RATE_CM_PER_S) {
                // Apply exponential low-pass filter (90% previous, 10% new)
                calculatedDepthCm = (previousWaterLevelCm * 0.90f) + (calculatedDepthCm * 0.10f);
            }
        }
    }
    
    currentData.water_level_cm = calculatedDepthCm;
    currentData.water_level_pct = (calculatedDepthCm / TANK_MAX_DEPTH_CM) * 100.0f;
    if (currentData.water_level_pct > 100.0f) currentData.water_level_pct = 100.0f;
    
    previousWaterLevelCm = calculatedDepthCm;
    previousSampleTimeMs = now;
    
    return currentData;
}
