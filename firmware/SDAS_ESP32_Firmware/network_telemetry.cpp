#include "network_telemetry.h"

static CommandCallback g_commandHandler = nullptr;

TelemetryManager::TelemetryManager()
    : mqttClient(espClient), commandHandler(nullptr),
      lastTelemetryPostMs(0), lastMqttReconnectAttemptMs(0) {}

void TelemetryManager::begin(CommandCallback cmdCb) {
    commandHandler = cmdCb;
    g_commandHandler = cmdCb;
    
    // Connect to Wi-Fi
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    // Configure MQTT client
    mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
    mqttClient.setCallback(mqttCallback);
}

void TelemetryManager::maintainWiFi() {
    if (WiFi.status() != WL_CONNECTED) {
        // Attempt quick non-blocking reconnect
        static unsigned long lastWiFiCheck = 0;
        if (millis() - lastWiFiCheck > 10000) {
            lastWiFiCheck = millis();
            WiFi.reconnect();
        }
    }
}

void TelemetryManager::maintainMQTT() {
    if (!mqttClient.connected()) {
        unsigned long now = millis();
        if (now - lastMqttReconnectAttemptMs > 5000) {
            lastMqttReconnectAttemptMs = now;
            if (mqttClient.connect(MQTT_CLIENT_ID)) {
                // Subscribe to remote command topic
                mqttClient.subscribe(MQTT_TOPIC_COMMANDS);
            }
        }
    } else {
        mqttClient.loop();
    }
}

void TelemetryManager::mqttCallback(char* topic, byte* payload, unsigned int length) {
    char message[256];
    if (length >= sizeof(message)) length = sizeof(message) - 1;
    memcpy(message, payload, length);
    message[length] = '\0';
    
    if (g_commandHandler != nullptr) {
        // Parse simple command string e.g. "OPEN_30", "OPEN_50", "CLOSE", "ESTOP", "AUTO"
        if (strstr(message, "OPEN_30")) {
            g_commandHandler("OPEN", 30);
        } else if (strstr(message, "OPEN_50")) {
            g_commandHandler("OPEN", 50);
        } else if (strstr(message, "OPEN_100")) {
            g_commandHandler("OPEN", 100);
        } else if (strstr(message, "CLOSE")) {
            g_commandHandler("CLOSE", 0);
        } else if (strstr(message, "STOP") || strstr(message, "ESTOP")) {
            g_commandHandler("ESTOP", 0);
        } else if (strstr(message, "AUTO")) {
            g_commandHandler("AUTO", 0);
        } else if (strstr(message, "PREWARN_SMS")) {
            g_commandHandler("PREWARN_SMS", 0);
        }
    }
}

void TelemetryManager::sendSupabaseTelemetry(const SensorData& sensors, const SystemStatus& status) {
    if (WiFi.status() != WL_CONNECTED) return;
    
    HTTPClient http;
    String endpoint = String(SUPABASE_URL) + "/sensor_telemetry";
    http.begin(endpoint);
    
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", SUPABASE_ANON_KEY);
    http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
    http.addHeader("Prefer", "return=minimal");
    
    // Construct JSON payload
    char jsonBuffer[512];
    snprintf(jsonBuffer, sizeof(jsonBuffer),
        "{\"sensor_1_dist\":%.2f,\"sensor_2_dist\":%.2f,\"water_level_pct\":%.2f,"
        "\"temperature_c\":%.2f,\"humidity_pct\":%.2f,\"alert_state\":%d,"
        "\"control_mode\":%d,\"gate_percent\":%d,\"sensors_agreed\":%s,\"degraded_mode\":%s}",
        sensors.raw_dist_1_cm,
        sensors.raw_dist_2_cm,
        sensors.water_level_pct,
        sensors.temperature_c,
        sensors.humidity_pct,
        (int)status.alertState,
        (int)status.controlMode,
        status.actualGatePercent,
        sensors.sensors_in_agreement ? "true" : "false",
        sensors.degraded_mode ? "true" : "false"
    );
    
    int httpResponseCode = http.POST(jsonBuffer);
    http.end();
}

void TelemetryManager::publishMqttTelemetry(const SensorData& sensors, const SystemStatus& status) {
    if (!mqttClient.connected()) return;
    
    char jsonBuffer[384];
    snprintf(jsonBuffer, sizeof(jsonBuffer),
        "{\"level_pct\":%.2f,\"gate_pct\":%d,\"state\":%d,\"mode\":%d,\"temp\":%.1f,\"fault\":%s}",
        sensors.water_level_pct,
        status.actualGatePercent,
        (int)status.alertState,
        (int)status.controlMode,
        sensors.temperature_c,
        sensors.degraded_mode ? "true" : "false"
    );
    
    mqttClient.publish(MQTT_TOPIC_TELEMETRY, jsonBuffer);
}

void TelemetryManager::publishEmergencyAlert(const char* message) {
    if (mqttClient.connected()) {
        mqttClient.publish(MQTT_TOPIC_ALERTS, message);
    }
}

void TelemetryManager::update(unsigned long millisNow, const SensorData& sensors, const SystemStatus& status) {
    maintainWiFi();
    maintainMQTT();
    
    // Telemetry publish interval (every 5 seconds)
    if (millisNow - lastTelemetryPostMs >= 5000) {
        lastTelemetryPostMs = millisNow;
        sendSupabaseTelemetry(sensors, status);
        publishMqttTelemetry(sensors, status);
    }
}
