#include "network_telemetry.h"

static CommandCallback g_commandHandler = nullptr;

TelemetryManager::TelemetryManager()
    : mqttClient(espClient), commandHandler(nullptr),
      netTaskHandle(nullptr), dataMutex(nullptr), hasFreshData(false),
      lastTelemetryPostMs(0), lastMqttReconnectAttemptMs(0) {
    memset(&snapshotSensors, 0, sizeof(SensorData));
    memset(&snapshotStatus, 0, sizeof(SystemStatus));
    dataMutex = xSemaphoreCreateMutex();
}

void TelemetryManager::begin(CommandCallback cmdCb) {
    commandHandler = cmdCb;
    g_commandHandler = cmdCb;
    
    // Connect to Wi-Fi in Station mode
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    // Configure MQTT client
    mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
    mqttClient.setCallback(mqttCallback);
    
    // Spawn dedicated FreeRTOS networking task pinned to Core 0
    // This completely decouples HTTP and MQTT network latency from the Core 1 real-time control loop!
    xTaskCreatePinnedToCore(
        networkTaskStatic,
        "SDAS_NetTask",
        8192,
        this,
        1,
        &netTaskHandle,
        0 // Core 0
    );
}

void TelemetryManager::networkTaskStatic(void* pvParameters) {
    TelemetryManager* instance = reinterpret_cast<TelemetryManager*>(pvParameters);
    instance->runNetworkLoop();
}

void TelemetryManager::runNetworkLoop() {
    while (true) {
        unsigned long now = millis();
        maintainWiFi();
        maintainMQTT();
        
        // Transmit telemetry periodically (every 5 seconds)
        if (now - lastTelemetryPostMs >= 5000) {
            lastTelemetryPostMs = now;
            SensorData localSensors;
            SystemStatus localStatus;
            bool shouldSend = false;
            
            if (dataMutex != nullptr && xSemaphoreTake(dataMutex, pdMS_TO_TICKS(50)) == pdTRUE) {
                if (hasFreshData) {
                    localSensors = snapshotSensors;
                    localStatus = snapshotStatus;
                    shouldSend = true;
                }
                xSemaphoreGive(dataMutex);
            }
            
            if (shouldSend) {
                sendSupabaseTelemetry(localSensors, localStatus);
                publishMqttTelemetry(localSensors, localStatus);
                pollSupabaseCommands();
            }
        }
        
        // Yield 20ms to allow smooth network processing and sub-50ms MQTT command reaction
        vTaskDelay(pdMS_TO_TICKS(20));
    }
}

void TelemetryManager::maintainWiFi() {
    if (WiFi.status() != WL_CONNECTED) {
        static unsigned long lastWiFiCheck = 0;
        if (millis() - lastWiFiCheck > 10000) {
            lastWiFiCheck = millis();
            WiFi.reconnect();
        }
    }
}

void TelemetryManager::maintainMQTT() {
    if (WiFi.status() != WL_CONNECTED) return;
    
    if (!mqttClient.connected()) {
        unsigned long now = millis();
        if (now - lastMqttReconnectAttemptMs > 5000) {
            lastMqttReconnectAttemptMs = now;
            
            bool connected = false;
            if (strlen(MQTT_USER) > 0) {
                connected = mqttClient.connect(MQTT_CLIENT_ID, MQTT_USER, MQTT_PASS);
            } else {
                connected = mqttClient.connect(MQTT_CLIENT_ID);
            }
            
            if (connected) {
                mqttClient.subscribe(MQTT_TOPIC_COMMANDS);
                Serial.println("[MQTT] Connected and subscribed to commands topic.");
            }
        }
    } else {
        mqttClient.loop();
    }
}

bool TelemetryManager::isMqttConnected() {
    return mqttClient.connected();
}

void TelemetryManager::mqttCallback(char* topic, byte* payload, unsigned int length) {
    char message[256];
    if (length >= sizeof(message)) length = sizeof(message) - 1;
    memcpy(message, payload, length);
    message[length] = '\0';
    
    if (g_commandHandler != nullptr) {
        // Enforce strict 50% limit and parse commands
        if (strstr(message, "OPEN_20") || strstr(message, "OPEN_30")) {
            // Note: OPEN_30 is safely mapped to 20% (Clear Area standard)
            g_commandHandler("OPEN", GATE_PCT_CLEAR_AREA);
        } else if (strstr(message, "OPEN_50")) {
            g_commandHandler("OPEN", GATE_PCT_DANGER);
        } else if (strstr(message, "OPEN_100")) {
            // HARD LIMIT ENFORCEMENT: Never allow 100% opening via MQTT
            Serial.println("[SECURITY] OPEN_100 commanded. HARD CLAMPED to 50% max limit!");
            g_commandHandler("OPEN", GATE_PCT_MAX_LIMIT);
        } else if (strstr(message, "OPEN")) {
            g_commandHandler("OPEN", GATE_PCT_CLEAR_AREA);
        } else if (strstr(message, "CLOSE")) {
            g_commandHandler("CLOSE", 0);
        } else if (strstr(message, "STOP") || strstr(message, "ESTOP")) {
            g_commandHandler("ESTOP", 0);
        } else if (strstr(message, "MANUAL")) {
            g_commandHandler("MANUAL", 0);
        } else if (strstr(message, "AUTO")) {
            g_commandHandler("AUTO", 0);
        } else if (strstr(message, "PREWARN_SMS")) {
            g_commandHandler("PREWARN_SMS", 0);
        } else if (strstr(message, "SENSOR_2") || strstr(message, "DUAL")) {
            g_commandHandler("SENSOR_2", 2);
        } else if (strstr(message, "SENSOR_1") || strstr(message, "SINGLE")) {
            g_commandHandler("SENSOR_1", 1);
        } else if (strstr(message, "RGB") || strstr(message, "TOGGLE_RGB")) {
            g_commandHandler("RGB", 0);
        } else if (strstr(message, "BTN_ON")) {
            g_commandHandler("BTN_ON", 0);
        } else if (strstr(message, "BTN_OFF")) {
            g_commandHandler("BTN_OFF", 0);
        }
    }
}

void TelemetryManager::sendSupabaseTelemetry(const SensorData& sensors, const SystemStatus& status) {
    if (WiFi.status() != WL_CONNECTED) return;
    
    WiFiClientSecure secClient;
    secClient.setInsecure(); // Explicitly bypass cert verification for field IoT reliability
    
    HTTPClient http;
    String base = String(SUPABASE_URL);
    if (!base.endsWith("/rest/v1")) {
        if (base.endsWith("/")) {
            base += "rest/v1";
        } else {
            base += "/rest/v1";
        }
    }
    String endpoint = base + "/sensor_telemetry";
    http.begin(secClient, endpoint);
    http.setTimeout(4000); // 4-second timeout
    
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
    
    http.POST(jsonBuffer);
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

// Thread-safe snapshot copy called from Core 1
void TelemetryManager::update(unsigned long millisNow, const SensorData& sensors, const SystemStatus& status) {
    if (dataMutex != nullptr && xSemaphoreTake(dataMutex, pdMS_TO_TICKS(10)) == pdTRUE) {
        snapshotSensors = sensors;
        snapshotStatus = status;
        hasFreshData = true;
        xSemaphoreGive(dataMutex);
    }
}

// Poll Supabase commands table for pending operator commands (Cloud Sync Redundancy)
void TelemetryManager::pollSupabaseCommands() {
    if (WiFi.status() != WL_CONNECTED || g_commandHandler == nullptr) return;
    
    WiFiClientSecure secClient;
    secClient.setInsecure();
    
    HTTPClient http;
    String base = String(SUPABASE_URL);
    if (!base.endsWith("/rest/v1")) {
        base += base.endsWith("/") ? "rest/v1" : "/rest/v1";
    }
    String endpoint = base + "/commands?status=eq.PENDING&order=created_at.desc&limit=1";
    http.begin(secClient, endpoint);
    http.setTimeout(3000);
    
    http.addHeader("apikey", SUPABASE_ANON_KEY);
    http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
    
    int httpCode = http.GET();
    if (httpCode == 200) {
        String payload = http.getString();
        if (payload.length() > 15) {
            char cmdType[32] = {0};
            int targetPct = 0;
            
            if (payload.indexOf("\"OPEN_20\"") >= 0 || payload.indexOf("\"OPEN_30\"") >= 0) {
                strcpy(cmdType, "OPEN"); targetPct = GATE_PCT_CLEAR_AREA;
            } else if (payload.indexOf("\"OPEN_50\"") >= 0 || payload.indexOf("\"OPEN_100\"") >= 0) {
                strcpy(cmdType, "OPEN"); targetPct = GATE_PCT_DANGER;
            } else if (payload.indexOf("\"CLOSE\"") >= 0) {
                strcpy(cmdType, "CLOSE"); targetPct = 0;
            } else if (payload.indexOf("\"STOP\"") >= 0 || payload.indexOf("\"ESTOP\"") >= 0) {
                strcpy(cmdType, "ESTOP"); targetPct = 0;
            } else if (payload.indexOf("\"MANUAL\"") >= 0) {
                strcpy(cmdType, "MANUAL"); targetPct = 0;
            } else if (payload.indexOf("\"AUTO\"") >= 0) {
                strcpy(cmdType, "AUTO"); targetPct = 0;
            } else if (payload.indexOf("\"PREWARN_SMS\"") >= 0) {
                strcpy(cmdType, "PREWARN_SMS"); targetPct = 0;
            } else if (payload.indexOf("\"SENSOR_2\"") >= 0 || payload.indexOf("\"DUAL\"") >= 0) {
                strcpy(cmdType, "SENSOR_2"); targetPct = 2;
            } else if (payload.indexOf("\"SENSOR_1\"") >= 0 || payload.indexOf("\"SINGLE\"") >= 0) {
                strcpy(cmdType, "SENSOR_1"); targetPct = 1;
            } else if (payload.indexOf("\"RGB\"") >= 0 || payload.indexOf("\"TOGGLE_RGB\"") >= 0) {
                strcpy(cmdType, "RGB"); targetPct = 0;
            } else if (payload.indexOf("\"BTN_ON\"") >= 0) {
                strcpy(cmdType, "BTN_ON"); targetPct = 0;
            } else if (payload.indexOf("\"BTN_OFF\"") >= 0) {
                strcpy(cmdType, "BTN_OFF"); targetPct = 0;
            }
            
            if (strlen(cmdType) > 0) {
                Serial.printf("[CLOUD SYNC] Executing Supabase command: %s (%d%%)\n", cmdType, targetPct);
                g_commandHandler(cmdType, targetPct);
                
                // Extract command UUID to mark EXECUTED
                int idIdx = payload.indexOf("\"id\":\"");
                if (idIdx >= 0) {
                    String cmdId = payload.substring(idIdx + 6, idIdx + 42);
                    http.end();
                    String patchEndpoint = base + "/commands?id=eq." + cmdId;
                    http.begin(secClient, patchEndpoint);
                    http.addHeader("Content-Type", "application/json");
                    http.addHeader("apikey", SUPABASE_ANON_KEY);
                    http.addHeader("Authorization", String("Bearer ") + SUPABASE_ANON_KEY);
                    http.PATCH("{\"status\":\"EXECUTED\"}");
                }
            }
        }
    }
    http.end();
}
