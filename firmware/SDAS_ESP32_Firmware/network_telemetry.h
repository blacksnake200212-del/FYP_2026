#ifndef SDAS_NETWORK_TELEMETRY_H
#define SDAS_NETWORK_TELEMETRY_H

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>
#include "config.h"
#include "sensors.h"
#include "state_machine.h"

typedef void (*CommandCallback)(const char* command, int param);

class TelemetryManager {
public:
    TelemetryManager();
    void begin(CommandCallback cmdCb);
    
    // Core 1 thread-safe snapshot update
    void update(unsigned long millisNow, const SensorData& sensors, const SystemStatus& status);
    
    bool isWiFiConnected() const { return WiFi.status() == WL_CONNECTED; }
    bool isMqttConnected();
    
    // Immediate emergency publish
    void publishEmergencyAlert(const char* message);

private:
    WiFiClient espClient;
    PubSubClient mqttClient;
    CommandCallback commandHandler;
    
    // FreeRTOS Task and Mutex for Core 0 execution
    TaskHandle_t netTaskHandle;
    SemaphoreHandle_t dataMutex;
    
    // Thread-safe telemetry snapshot
    SensorData snapshotSensors;
    SystemStatus snapshotStatus;
    bool hasFreshData;
    
    unsigned long lastTelemetryPostMs;
    unsigned long lastMqttReconnectAttemptMs;
    
    static void networkTaskStatic(void* pvParameters);
    void runNetworkLoop();
    
    void maintainWiFi();
    void maintainMQTT();
    void sendSupabaseTelemetry(const SensorData& sensors, const SystemStatus& status);
    void publishMqttTelemetry(const SensorData& sensors, const SystemStatus& status);
    void pollSupabaseCommands();
    static void mqttCallback(char* topic, byte* payload, unsigned int length);
};

#endif // SDAS_NETWORK_TELEMETRY_H
