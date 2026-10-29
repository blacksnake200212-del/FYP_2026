#ifndef SDAS_CONFIG_H
#define SDAS_CONFIG_H

#include <Arduino.h>

// ============================================================================
// SDAS FIRMWARE HARDWARE CONFIGURATION & PIN MAPPING (AUDITED BLUEPRINT V2.0)
// ============================================================================

// --- Ultrasonic Sensors (HC-SR04 Dual Ultrasonic Modules) ---
// Note: Level converter HV=5V, LV=3.3V protects ESP32 GPIOs from 5V Echo
#define PIN_TRIG_1           5     // HC-SR04 #1 Trigger (via Level Shifter Ch1)
#define PIN_ECHO_1           19    // HC-SR04 #1 Echo    (via Level Shifter Ch2)
#define PIN_TRIG_2           18    // HC-SR04 #2 Trigger (via Level Shifter Ch3)
#define PIN_ECHO_2           21    // HC-SR04 #2 Echo    (via Level Shifter Ch4)

// Active Ultrasonic Sensor Count:
// Set to 2: Dual HC-SR04 sensors active with cross-sensor voting & plausibility check.
// Sensor 1: Trig GPIO5, Echo GPIO19. Sensor 2: Trig GPIO18, Echo GPIO21.
#define ACTIVE_ULTRASONIC_COUNT 2

// --- Environmental Sensing ---
#define PIN_DHT              4     // DHT22 Data line (with 10k pull-up to 3.3V)
#define DHT_TYPE             DHT22

// --- RGB LED Module Polarity & Pins ---
// Set to true for Common Anode (Longest pin to 3.3V - Standard SDAS Blueprint design)
// Set to false for Common Cathode (Longest pin to GND)
// Note: You can also toggle polarity dynamically at runtime by sending 'RGB' in the Serial Monitor!
#define RGB_IS_COMMON_ANODE  true

// Resistors: Red=220 Ohm, Green=100 Ohm, Blue=100 Ohm (Current Balanced)
#define PIN_LED_RED          32
#define PIN_LED_GREEN        33
#define PIN_LED_BLUE         13

// --- Gate Actuator (MG90S Metal Gear Micro Servo) ---
#define PIN_SERVO            25    // Servo PWM signal (with 330 Ohm series resistor)
#define SERVO_LEDC_CHANNEL   0
#define SERVO_LEDC_FREQ      50    // 50 Hz standard analog/digital servo PWM
#define SERVO_LEDC_RES       16    // 16-bit resolution

// Servo pulse widths (in microseconds)
#define SERVO_MIN_US         500   // 0 degrees
#define SERVO_MAX_US         2500  // 180 degrees

// Servo travel step size (degrees per 15ms loop update)
// 1.0f = Realistic heavy sluice gate speed (~1.35s to 50%)
// 3.0f = Brisk, responsive prototype speed (~450ms to 50% - Standard Recommended)
// 5.0f = High-speed rapid response (~270ms to 50%)
#define SERVO_STEP_DEG       3.0f

// --- Buzzer Driver ---
// Driven via BC547/2N2222 NPN transistor with 1k base resistor & 1N4007 clamp diode
#define PIN_BUZZER           27

// --- SIM800L Cellular Modem ---
// Hardware UART2: GPIO16 is RX2, GPIO17 is TX2
#define PIN_SIM_RX2          16    // Connects to SIM800L TXD (Direct 2.8V->3.3V)
#define PIN_SIM_TX2          17    // Connects to SIM800L RXD (via 1k/2.2k divider)
#define PIN_SIM_RST          23    // Active-LOW Hardware Reset line to SIM800L RST
#define SIM_BAUD_RATE        9600

// --- Physical Manual Override Push Buttons ---
// Wired to GND with internal INPUT_PULLUP and 20ms software debounce
#define PIN_BTN_OPEN         14    // Manual OPEN button
#define PIN_BTN_CLOSE        26    // Manual CLOSE button
#define PIN_BTN_STOP         22    // Emergency STOP button

// --- Optional Rain Gauge (Tipping Bucket) ---
// Input-only pin GPIO34 (requires external 10k pull-up)
#define PIN_RAIN_GAUGE       34

// ============================================================================
// RESERVOIR / PROTOTYPE TANK GEOMETRY SPECIFICATIONS
// ============================================================================
// HC-SR04 has a 2.0 cm acoustic blind zone (effective range: 2.0 cm to 400.0 cm).
// Prototype tank mounting: 50.0 cm above tank floor (providing 10.0 cm clearance
// over 40.0 cm full crest line, safely outside the 2.0 cm blind zone).
#define SENSOR_MOUNT_HEIGHT_CM   50.0f // Distance from tank floor to sensor face (configurable)
#define TANK_MAX_DEPTH_CM        40.0f // Maximum usable water depth (100% capacity)
#define SENSOR_BLIND_MARGIN_CM   10.0f // Clearance margin at 100% capacity (50cm - 40cm = 10cm)

// Plausibility Verification Limits
#define SENSOR_MAX_DELTA_CM      5.0f  // Max tolerable difference between dual sensors
#define SENSOR_MAX_RATE_CM_PER_S 15.0f // Physically impossible surge threshold (splashing)
#define SENSOR_MIN_VALID_DIST_CM 2.0f  // HC-SR04 blind zone limit (closer than 2cm clamped to 100% / DANGER)
#define SENSOR_MAX_VALID_DIST_CM 400.0f// Greater than 400cm indicates echo loss / out-of-range

// SMS Queue Capacity
#define SMS_QUEUE_SIZE           16    // Expanded buffer for staged multi-recipient alert broadcasts

// ============================================================================
// AUTOMATED GATE & ALERT THRESHOLDS (3% HYSTERESIS LOGIC)
// ============================================================================
// Entry thresholds (Percentages)
#define THRESH_NORMAL_PCT        60.0f // Below 60% = NORMAL
#define THRESH_PREWARN_PCT       60.0f // 60% to 79.9% = PRE-WARNING
#define THRESH_CLEARAREA_PCT     80.0f // 80% to 84.9% = CLEAR AREA
#define THRESH_DANGER_PCT        85.0f // >= 85% = DANGER

// Hysteresis Band (Exit thresholds are 3% below entry)
#define HYSTERESIS_PCT           3.0f
#define EXIT_PREWARN_PCT         (THRESH_PREWARN_PCT - HYSTERESIS_PCT)    // 57.0%
#define EXIT_CLEARAREA_PCT       (THRESH_CLEARAREA_PCT - HYSTERESIS_PCT)  // 77.0%
#define EXIT_DANGER_PCT          (THRESH_DANGER_PCT - HYSTERESIS_PCT)     // 82.0%

// Sluice Gate Positions (% Open & Corresponding Servo Degrees - 20% & 50% only)
#define GATE_PCT_CLOSED          0
#define GATE_PCT_CLEAR_AREA      20    // 20% open (Advisory release)
#define GATE_PCT_DANGER          50    // 50% open (Emergency flood release)
#define GATE_PCT_MAX_LIMIT       50    // 50% maximum allowed gate opening (HARD LIMIT)

#define GATE_DEG_CLOSED          0
#define GATE_DEG_CLEAR_AREA      36    // 20% of 180 degrees
#define GATE_DEG_DANGER          90    // 50% of 180 degrees
#define GATE_DEG_MAX_LIMIT       90    // 50% of 180 degrees

// Manual Mode Safety Watchdog Timeout (Seconds)
// Automatically reverts to AUTO if operator does not send commands
#define MANUAL_WATCHDOG_TIMEOUT_SEC 300

// ============================================================================
// NETWORK & CLOUD CREDENTIALS
// Real credentials are kept in "secrets.h" (ignored by git).
// ============================================================================
#if __has_include("secrets.h")
  #include "secrets.h"
#else
  #define WIFI_SSID                "ADRIAN iPhone"
  #define WIFI_PASSWORD            "1122335566"
  #define SUPABASE_URL             "https://gpxakbveqnzqqpxvtkgf.supabase.co"
  #define SUPABASE_ANON_KEY        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdweGFrYnZlcW56cXFweHZ0a2dmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MzAwNjcsImV4cCI6MjEwNzQwNjA2N30.dv_53Z7HzHIl8e-5BhVBx1OYYbE2L5GhyZZkbzTvEgU"
#endif

// MQTT Broker Configuration (EMQX / HiveMQ TLS & Auth capable)
#ifndef MQTT_BROKER
  #define MQTT_BROKER              "broker.emqx.io" // High-availability public MQTT cluster
#endif
#ifndef MQTT_PORT
  #define MQTT_PORT                1883
#endif
#ifndef MQTT_USER
  #define MQTT_USER                ""    // Optional authenticated user
#endif
#ifndef MQTT_PASS
  #define MQTT_PASS                ""    // Optional authenticated password
#endif
#define MQTT_TOPIC_TELEMETRY     "dam/puttalam/telemetry"
#define MQTT_TOPIC_COMMANDS      "dam/puttalam/commands"
#define MQTT_TOPIC_ALERTS        "dam/puttalam/alerts"
#define MQTT_CLIENT_ID           "SDAS_ESP32_NODE_01"

// Staged SMS Emergency Contacts (E.164 format) - 4 Registered User Numbers
#define CONTACT_OPERATOR_1       "+94740099235" // Testing Contact 1 (Adrian)
#define CONTACT_OPERATOR_2       "+94778364925" // Testing Contact 2 (Newly Added User Contact)
#define CONTACT_OPERATOR_3       "+94712833936" // Testing Contact 3 (Aadhil)
#define CONTACT_OPERATOR_4       "+94781099235" // Testing Contact 4 (Dilshan)
#define CONTACT_DMC_CONTROL      "+94781099235" // Testing Contact 4 (Dilshan)
#define CONTACT_COMMUNITY_LEADER "+94778364925" // Testing Contact 2

#endif // SDAS_CONFIG_H
