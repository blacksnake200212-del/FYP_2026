#ifndef SDAS_CONFIG_H
#define SDAS_CONFIG_H

#include <Arduino.h>

// ============================================================================
// SDAS FIRMWARE HARDWARE CONFIGURATION & PIN MAPPING (AUDITED BLUEPRINT V2.0)
// ============================================================================

// --- Ultrasonic Sensors (JSN-SR04T Waterproof Transducers) ---
// Note: Level converter HV=5V, LV=3.3V
#define PIN_TRIG_1           5     // JSN-SR04T #1 Trigger (via Level Shifter Ch1)
#define PIN_ECHO_1           19    // JSN-SR04T #1 Echo    (via Level Shifter Ch2)
#define PIN_TRIG_2           18    // JSN-SR04T #2 Trigger (via Level Shifter Ch3)
#define PIN_ECHO_2           21    // JSN-SR04T #2 Echo    (via Level Shifter Ch4)

// --- Environmental Sensing ---
#define PIN_DHT              4     // DHT22 Data line (with 10k pull-up to 3.3V)
#define DHT_TYPE             DHT22

// --- RGB LED Module (Common Anode, Active LOW) ---
// Resistors: Red=220 Ohm, Green=100 Ohm, Blue=100 Ohm (Current Balanced)
#define PIN_LED_RED          32
#define PIN_LED_GREEN        33
#define PIN_LED_BLUE         13

// --- Gate Actuator (MG996R High-Torque Metal Gear Servo) ---
#define PIN_SERVO            25    // Servo PWM signal (with 330 Ohm series resistor)
#define SERVO_LEDC_CHANNEL   0
#define SERVO_LEDC_FREQ      50    // 50 Hz standard analog/digital servo PWM
#define SERVO_LEDC_RES       16    // 16-bit resolution

// Servo pulse widths (in microseconds)
#define SERVO_MIN_US         500   // 0 degrees
#define SERVO_MAX_US         2500  // 180 degrees

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
// JSN-SR04T has a 20-25 cm acoustic blind zone.
// Mounting height must be at least 30-35 cm above maximum waterline.
#define SENSOR_MOUNT_HEIGHT_CM   65.0f // Distance from tank floor to sensor face
#define TANK_MAX_DEPTH_CM        40.0f // Maximum usable water depth (100% capacity)
#define SENSOR_BLIND_MARGIN_CM   25.0f // Deadband margin (65cm - 40cm = 25cm clearance)

// Plausibility Verification Limits
#define SENSOR_MAX_DELTA_CM      5.0f  // Max tolerable difference between dual sensors
#define SENSOR_MAX_RATE_CM_PER_S 15.0f // Physically impossible surge threshold (splashing)
#define SENSOR_MIN_VALID_DIST_CM 20.0f // Less than this indicates blind zone fault
#define SENSOR_MAX_VALID_DIST_CM 450.0f// Greater than this indicates echo loss

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
#define GATE_PCT_MAX_LIMIT       50    // 50% maximum allowed gate opening

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
  #define WIFI_SSID                "YOUR_WIFI_SSID"
  #define WIFI_PASSWORD            "YOUR_WIFI_PASSWORD"
  #define SUPABASE_URL             "https://your-project.supabase.co/rest/v1"
  #define SUPABASE_ANON_KEY        "YOUR_SUPABASE_ANON_KEY"
#endif

// MQTT Broker Configuration (HiveMQ / EMQX Cloud for sub-2s operator commands)
#define MQTT_BROKER              "broker.hivemq.com"
#define MQTT_PORT                1883
#define MQTT_TOPIC_TELEMETRY     "dam/puttalam/telemetry"
#define MQTT_TOPIC_COMMANDS      "dam/puttalam/commands"
#define MQTT_TOPIC_ALERTS        "dam/puttalam/alerts"
#define MQTT_CLIENT_ID           "SDAS_ESP32_NODE_01"

// Staged SMS Emergency Contacts (E.164 format)
#define CONTACT_OPERATOR_1       "+94771234567"
#define CONTACT_OPERATOR_2       "+94719876543"
#define CONTACT_DMC_CONTROL      "+94112670002"

#endif // SDAS_CONFIG_H
