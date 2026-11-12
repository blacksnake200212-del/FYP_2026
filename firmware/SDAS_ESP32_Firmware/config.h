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

// --- RGB LED Module Polarity & Pins (HW-478 SMD Module) ---
// Set to false for Common Cathode (HW-478 has '-' pin connected to GND, Active HIGH)
// Set to true for Common Anode (Longest pin to 3.3V, Active LOW)
// Note: You can also toggle polarity dynamically at runtime by sending 'RGB', 'CATHODE', or 'ANODE'!
#define RGB_IS_COMMON_ANODE  false

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
// Set to true to enable tactile push buttons wired to GPIO 14 (OPEN), 26 (CLOSE), 22 (STOP)
#define ENABLE_PHYSICAL_BUTTONS true
#define PIN_BTN_OPEN         14    // Manual OPEN button (0% -> 20% -> 50%)
#define PIN_BTN_CLOSE        26    // Manual CLOSE button (Direct 0%)
#define PIN_BTN_STOP         22    // Emergency STOP button (Toggle E-STOP / Lock)

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

// FIX: fault handling tunables
#define SENSOR_FAULT_CONFIRM_CYCLES 3          // 3 failed 2-second cycles in a row = SENSOR FAULT
#define DHT_STALE_MS             30000UL       // DHT22 reading older than 30 s = invalid (sent as null)
#define FAULT_SMS_MIN_INTERVAL_MS (30UL * 60UL * 1000UL) // at most one fault SMS per 30 min

// FIX: SMS recipients are downloaded from the Supabase "contacts" table (opted-in numbers),
// so numbers added in the dashboard / operator app really receive SIM800L alerts.
// Needs SDAS_DEVICE_KEY in secrets.h and the same key registered in the database
// (see database/schema.sql section 21). Without it, the CONTACT_* numbers below are used.
#define MAX_SMS_CONTACTS         10           // max numbers per broadcast (SMS queue holds 16)
#define CONTACT_SYNC_INTERVAL_MS (10UL * 60UL * 1000UL) // refresh every 10 minutes

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
// FIX: this value existed but was never used, so a REMOTE manual command (app / dashboard)
// held the gate forever and AUTO flood control stayed off if the operator walked away.
// Remote MANUAL / OPEN / CLOSE commands and a MANUAL mode restored after a reboot now revert
// to AUTO after this time. Physical buttons and Serial commands (someone is on site) stay
// indefinite. Set to 0 to restore the old "hold forever" behaviour.
#define MANUAL_WATCHDOG_TIMEOUT_SEC 300

// ============================================================================
// NETWORK & CLOUD CREDENTIALS
// Real credentials are kept in "secrets.h" (ignored by git).
// ============================================================================
// FIX: the Wi-Fi name and password used to be written here as a fallback, which put them in
// the public GitHub repo. Copy secrets.example.h to secrets.h and fill it in instead.
#if __has_include("secrets.h")
  #include "secrets.h"
#else
  #error "secrets.h not found: copy secrets.example.h to secrets.h and enter your Wi-Fi and Supabase details."
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
// SECURITY: broker.emqx.io is a PUBLIC broker with no password. Anyone who knows the topic
// below (it is in the public repo) can publish "OPEN_50" or "ESTOP" and this node will obey.
// Set to 0 to accept commands only from Supabase (slower, ~5 s, but needs the database key).
// For a real deployment use a private broker with MQTT_USER / MQTT_PASS and TLS.
// FIX: default is now 0 (safe). Commands still arrive through Supabase within ~5 s.
#ifndef MQTT_ACCEPT_COMMANDS
  #define MQTT_ACCEPT_COMMANDS     0
#endif
// Ignore the Supabase copy of a command already received over MQTT within this window
// (the web dashboard sends every command both ways).
#define CMD_DEDUP_WINDOW_MS      15000UL

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
