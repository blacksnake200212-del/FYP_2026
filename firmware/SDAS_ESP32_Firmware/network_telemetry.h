#ifndef SDAS_NETWORK_TELEMETRY_H
#define SDAS_NETWORK_TELEMETRY_H

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include "config.h"
#include "sensors.h"
#include "state_machine.h"

typedef void (*CommandCallback)(const char* command, int param);

class TelemetryManager {
public:
    TelemetryManager();
    void begin(CommandCallback cmdCb);
    void update(unsigned long millisNow, const SensorData& sensors, const SystemStatus& status);
    
    bool isWiFiConnected() const { return WiFi.status() == WL_CONNECTED; }
    bool isMqttConnected() { return mqttClient.connected(); }
    
    // Immediate emergency publish
    void publishEmergencyAlert(const char* message);

private:
    WiFiClient espClient;
    PubSubClient mqttClient;
    CommandCallback commandHandler;
    
    unsigned long lastTelemetryPostMs;
    unsigned long lastMqttReconnectAttemptMs;
    
    void maintainWiFi();
    void maintainMQTT();
    void sendSupabaseTelemetry(const SensorData& sensors, const SystemStatus& status);
    void publishMqttTelemetry(const SensorData& sensors, const SystemStatus& status);
    static void mqttCallback(char* topic, byte* payload, unsigned int length);
};

#endif // SDAS_NETWORK_TELEMETRY_H
