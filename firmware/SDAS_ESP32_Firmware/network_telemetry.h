#ifndef SDAS_NETWORK_TELEMETRY_H
#define SDAS_NETWORK_TELEMETRY_H

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <PubSubClient.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>
#include "config.h"
#include "sensors.h"
#include "state_machine.h"
#include "gsm_modem.h"

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
    
    // Where downloaded SMS recipients are stored (set once in setup())
    void setContactSink(GSMManager* gsm) { contactSink = gsm; }

private:
    WiFiClient espClient;
    PubSubClient mqttClient;
    WebServer webServer;
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
    unsigned long lastWiFiCheckMs;
    uint8_t wifiFailCount;
    bool wasWifiConnected;
    bool webServerStarted;
    int lastSupabaseHttpCode;
    unsigned long lastSupabaseSuccessMs;
    
    static void networkTaskStatic(void* pvParameters);
    void runNetworkLoop();
    
    void maintainWiFi();
    void maintainMQTT();
    void startLocalWebServer();
    void handleWebRoot();
    void handleWebStatusJson();
    void buildRestEndpoint(const char* tablePath, char* outBuf, size_t outSize) const;
    bool patchCommandStatus(const char* id, const char* newStatus);
    void syncSmsRecipients();
    GSMManager* contactSink = nullptr;
    unsigned long lastContactSyncMs = 0;
    bool contactSyncDone = false;
    void sendSupabaseTelemetry(const SensorData& sensors, const SystemStatus& status);
    void publishMqttTelemetry(const SensorData& sensors, const SystemStatus& status);
    void pollSupabaseCommands();
    static void mqttCallback(char* topic, byte* payload, unsigned int length);
};

#endif // SDAS_NETWORK_TELEMETRY_H
