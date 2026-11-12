#include "network_telemetry.h"
#include <time.h>

static CommandCallback g_commandHandler = nullptr;

// FIX: the web dashboard sends every command over MQTT AND inserts it into Supabase, and the
// node executed both copies: a broadcast sent every SMS twice and "RGB" toggled twice (no
// visible change). Remember the last MQTT command and skip the Supabase copy of it.
static char g_lastMqttCmd[40] = {0};
static int g_lastMqttParam = -1;
static unsigned long g_lastMqttCmdMs = 0;
static bool g_haveMqttCmd = false;
// FIX: if marking a command EXECUTED failed, the same row was executed again every 5 s
// (e.g. an SMS broadcast every 5 s). Never execute the same command id twice.
static char g_lastExecutedId[40] = {0};

// Runs a remote command. Returns false if it was skipped as a duplicate of an MQTT command.
static bool dispatchRemote(const char* cmd, int param, bool fromMqtt) {
    if (g_commandHandler == nullptr) return false;
    unsigned long now = millis();
    if (fromMqtt) {
        strncpy(g_lastMqttCmd, cmd, sizeof(g_lastMqttCmd) - 1);
        g_lastMqttCmd[sizeof(g_lastMqttCmd) - 1] = '\0';
        g_lastMqttParam = param;
        g_lastMqttCmdMs = now;
        g_haveMqttCmd = true;
    } else if (g_haveMqttCmd && (now - g_lastMqttCmdMs) < CMD_DEDUP_WINDOW_MS &&
               strcmp(g_lastMqttCmd, cmd) == 0 && g_lastMqttParam == param) {
        Serial.printf("[CLOUD SYNC] '%s' already received via MQTT. Marking done without re-running.\n", cmd);
        g_haveMqttCmd = false;
        return false;
    }
    g_commandHandler(cmd, param);
    return true;
}

// Copies the string value of "key":"value" from a JSON text into out. Returns true if found.
static bool jsonStringField(const String& json, const char* key, char* out, size_t outSize) {
    String pattern = String("\"") + key + "\":\"";
    int start = json.indexOf(pattern);
    if (start < 0) return false;
    start += pattern.length();
    int end = json.indexOf('"', start);
    if (end < 0) return false;
    String value = json.substring(start, end);
    strncpy(out, value.c_str(), outSize - 1);
    out[outSize - 1] = '\0';
    return true;
}

// Only '+' and digits, 8-16 characters: stops odd text being sent to the modem as a number.
static bool isSafePhoneNumber(const char* s) {
    size_t n = strlen(s);
    if (n < 8 || n > 16) return false;
    for (size_t i = 0; i < n; i++) {
        if (!(isdigit((unsigned char)s[i]) || (i == 0 && s[i] == '+'))) return false;
    }
    return true;
}

// Embedded lightweight status web page served directly by the ESP32 at http://<ESP32-IP>/
// Stored in Flash (PROGMEM) so it consumes zero static heap and preserves TLS memory.
static const char SDAS_LOCAL_HTML[] PROGMEM = R"rawliteral(<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>SDAS Node Live Monitor</title>
<style>
  :root{color-scheme:dark;--bg:#0b1220;--card:#131c31;--border:#24324d;--text:#f1f5f9;--muted:#94a3b8;--ok:#22c55e;--warn:#f59e0b;--bad:#ef4444;--cyan:#38bdf8}
  *{box-sizing:border-box;margin:0;padding:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
  body{background:var(--bg);color:var(--text);padding:16px;max-width:860px;margin:0 auto}
  header{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:16px;padding:14px 16px;background:var(--card);border:1px solid var(--border);border-radius:12px}
  h1{font-size:18px;font-weight:800}
  .sub{font-size:12px;color:var(--muted);margin-top:2px}
  .pill{padding:6px 12px;border-radius:999px;font-size:12px;font-weight:700;background:#1e293b;border:1px solid var(--border)}
  .pill.ok{color:var(--ok);border-color:rgba(34,197,94,.4)}
  .pill.warn{color:var(--warn);border-color:rgba(245,158,11,.4)}
  .pill.bad{color:var(--bad);border-color:rgba(239,68,68,.4)}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
  .card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px}
  .lbl{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:6px}
  .val{font-size:26px;font-weight:800;color:var(--cyan)}
  .meta{font-size:12px;color:var(--muted);margin-top:6px;line-height:1.45}
  .bar{height:10px;background:#0f172a;border-radius:999px;overflow:hidden;margin-top:10px;border:1px solid var(--border)}
  .fill{height:100%;background:linear-gradient(90deg,#0284c7,#38bdf8);width:0%;transition:width .3s}
  footer{margin-top:14px;font-size:11px;color:var(--muted);text-align:center}
</style>
</head>
<body>
<header>
  <div>
    <h1>Smart Dam Alerting System (SDAS-NODE-01)</h1>
    <div class="sub" id="netLine">Direct ESP32 Wi-Fi Monitor &bull; Connecting...</div>
  </div>
  <div class="pill ok" id="stagePill">WAITING</div>
</header>
<div class="grid">
  <div class="card">
    <div class="lbl">Reservoir Water Level</div>
    <div class="val" id="levelVal">--%</div>
    <div class="bar"><div class="fill" id="levelBar"></div></div>
    <div class="meta" id="depthMeta">Depth: -- cm</div>
  </div>
  <div class="card">
    <div class="lbl">Sluice Gate &amp; Mode</div>
    <div class="val" id="gateVal">--%</div>
    <div class="meta" id="modeMeta">Mode: -- &bull; Servo: -- deg</div>
  </div>
  <div class="card">
    <div class="lbl">Ultrasonic #1 (Trig 5 / Echo 19)</div>
    <div class="val" id="s1Val">--</div>
    <div class="meta" id="s1Meta">Status: --</div>
  </div>
  <div class="card">
    <div class="lbl">Ultrasonic #2 (Trig 18 / Echo 21)</div>
    <div class="val" id="s2Val">--</div>
    <div class="meta" id="s2Meta">Agreement: --</div>
  </div>
  <div class="card">
    <div class="lbl">DHT22 Environment</div>
    <div class="val" id="dhtVal">--</div>
    <div class="meta" id="dhtMeta">Humidity: -- &bull; Sound: -- m/s</div>
  </div>
  <div class="card">
    <div class="lbl">Cloud &amp; Hardware Health</div>
    <div class="val" id="cloudVal" style="font-size:18px">--</div>
    <div class="meta" id="healthMeta">Uptime: -- &bull; Heap: --</div>
  </div>
</div>
<footer>Auto-refreshing every 2 seconds directly from ESP32 (<a href="/api/status" style="color:#38bdf8">/api/status</a>)</footer>
<script>
const STAGES=['NORMAL','PRE-WARNING','CLEAR AREA','DANGER','SENSOR FAULT'];
const MODES=['AUTO','MANUAL','EMERGENCY STOP'];
function fmtDist(v){return (v!==null&&v>0)?v.toFixed(1)+' cm':'TIMEOUT (-1)';}
async function poll(){
  try{
    const r=await fetch('/api/status',{cache:'no-store'});
    const d=await r.json();
    document.getElementById('netLine').textContent='Wi-Fi: '+d.ssid+' | IP: '+d.ip+' | Signal: '+d.rssi+' dBm';
    const pill=document.getElementById('stagePill');
    const st=STAGES[d.alert_state]||'NORMAL';
    pill.textContent=st;
    pill.className='pill '+(d.alert_state===3?'bad':(d.alert_state===0?'ok':'warn'));
    if(!d.ready){return;}
    document.getElementById('levelVal').textContent=d.water_level_pct.toFixed(1)+'%';
    document.getElementById('levelBar').style.width=Math.max(0,Math.min(100,d.water_level_pct))+'%';
    document.getElementById('depthMeta').textContent='Depth: '+d.water_level_cm.toFixed(1)+' cm / 40.0 cm'+(d.critical_fault?' (SENSOR FAULT)':'');
    document.getElementById('gateVal').textContent=d.gate_percent+'%';
    document.getElementById('modeMeta').textContent='Mode: '+(MODES[d.control_mode]||'AUTO')+' | Servo: '+Math.round(d.gate_percent*1.8)+' deg';
    document.getElementById('s1Val').textContent=fmtDist(d.distance_1);
    document.getElementById('s1Meta').textContent='Status: '+(d.s1_valid?'ECHO OK':'NO ECHO');
    document.getElementById('s2Val').textContent=fmtDist(d.distance_2);
    document.getElementById('s2Meta').textContent='Status: '+(d.s2_valid?'ECHO OK':'NO ECHO')+' | Agreed: '+(d.sensors_agreed?'YES':'NO');
    document.getElementById('dhtVal').textContent=d.dht_valid?(d.temperature_c.toFixed(1)+' C'):'NO READING';
    document.getElementById('dhtMeta').textContent='Humidity: '+(d.dht_valid?(d.humidity_pct.toFixed(1)+'%'):'--')+' | Sound: '+d.sound_mps.toFixed(1)+' m/s';
    document.getElementById('cloudVal').textContent='MQTT: '+(d.mqtt?'ONLINE':'OFFLINE')+' | DB HTTP: '+d.supabase_http;
    document.getElementById('healthMeta').textContent='Uptime: '+d.uptime_sec+'s | Free Heap: '+Math.round(d.free_heap/1024)+' KB';
  }catch(e){
    document.getElementById('netLine').textContent='Waiting for ESP32 response...';
  }
}
poll();setInterval(poll,2000);
</script>
</body>
</html>)rawliteral";

TelemetryManager::TelemetryManager()
    : mqttClient(espClient), webServer(80), commandHandler(nullptr),
      netTaskHandle(nullptr), dataMutex(nullptr), hasFreshData(false),
      lastTelemetryPostMs(0), lastMqttReconnectAttemptMs(0),
      lastWiFiCheckMs(0), wifiFailCount(0), wasWifiConnected(false),
      webServerStarted(false), lastSupabaseHttpCode(0), lastSupabaseSuccessMs(0) {
    memset(&snapshotSensors, 0, sizeof(SensorData));
    memset(&snapshotStatus, 0, sizeof(SystemStatus));
    dataMutex = xSemaphoreCreateMutex();
}

void TelemetryManager::begin(CommandCallback cmdCb) {
    commandHandler = cmdCb;
    g_commandHandler = cmdCb;
    
    // Connect to Wi-Fi in Station mode with modem-sleep disabled so mobile hotspots do not drop the node
    WiFi.mode(WIFI_STA);
    WiFi.persistent(false);
    WiFi.setAutoReconnect(true);
    WiFi.setSleep(false);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    Serial.printf("[WiFi] Connecting to SSID '%s'...\n", WIFI_SSID);
    
    // FIX: get real time over NTP so expired Supabase commands can be ignored
    configTime(0, 0, "pool.ntp.org", "time.google.com");
    
    // Configure MQTT client
    mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
    mqttClient.setCallback(mqttCallback);
    
    // Spawn dedicated FreeRTOS networking task pinned to Core 0 (16 KB stack for safe mbedTLS handshakes)
    xTaskCreatePinnedToCore(
        networkTaskStatic,
        "SDAS_NetTask",
        16384,
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
        if (webServerStarted && WiFi.status() == WL_CONNECTED) {
            webServer.handleClient();
        }
        
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
                // Publish low-latency MQTT first so broker stays live even if HTTPS times out
                publishMqttTelemetry(localSensors, localStatus);
                sendSupabaseTelemetry(localSensors, localStatus);
                pollSupabaseCommands();
            }
            
            // Refresh SMS recipients from Supabase: at first connection, then every 10 minutes
            if (!contactSyncDone || (now - lastContactSyncMs >= CONTACT_SYNC_INTERVAL_MS)) {
                syncSmsRecipients();
            }
        }
        
        // Yield 20ms to allow smooth network processing and sub-50ms MQTT command reaction
        vTaskDelay(pdMS_TO_TICKS(20));
    }
}

void TelemetryManager::maintainWiFi() {
    wl_status_t status = WiFi.status();
    if (status == WL_CONNECTED) {
        if (!wasWifiConnected) {
            wasWifiConnected = true;
            wifiFailCount = 0;
            Serial.printf("[WiFi] Connected to '%s' | IP: %s | RSSI: %d dBm | Heap: %u B\n",
                WIFI_SSID, WiFi.localIP().toString().c_str(), WiFi.RSSI(), (unsigned)ESP.getFreeHeap());
            startLocalWebServer();
        }
        return;
    }

    if (wasWifiConnected) {
        wasWifiConnected = false;
        Serial.printf("[WiFi] Connection lost (status=%d). Recovering...\n", (int)status);
    }

    unsigned long now = millis();
    if (now - lastWiFiCheckMs >= 10000) {
        lastWiFiCheckMs = now;
        wifiFailCount++;
        if (wifiFailCount <= 2) {
            Serial.printf("[WiFi] Reconnecting to '%s' (attempt %u, status=%d)...\n",
                WIFI_SSID, wifiFailCount, (int)status);
            WiFi.reconnect();
        } else {
            // Full STA re-association clears stale iPhone hotspot / DHCP sessions
            Serial.printf("[WiFi] Resetting Wi-Fi STA for '%s'...\n", WIFI_SSID);
            WiFi.disconnect(false);
            vTaskDelay(pdMS_TO_TICKS(200));
            WiFi.setSleep(false);
            WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
            wifiFailCount = 0;
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
            } else {
                Serial.printf("[MQTT] Connect failed (rc=%d). Retrying in 5s...\n", mqttClient.state());
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
    
#if !MQTT_ACCEPT_COMMANDS
    Serial.printf("[MQTT] Command '%s' ignored (MQTT_ACCEPT_COMMANDS = 0, use Supabase).\n", message);
    return;
#endif
    if (g_commandHandler != nullptr) {
        // FIX: test SMS from the dashboard. "TEST_SMS" = test text to all contacts,
        // "TEST_SMS:+94..." = test text to one number. Checked first so it is never
        // mistaken for a real flood alert.
        if (strncmp(message, "TEST_SMS", 8) == 0) {
            if (message[8] == ':' && !isSafePhoneNumber(message + 9)) {
                Serial.println("[MQTT] TEST_SMS rejected: invalid phone number.");
                return;
            }
            char cmd[40];
            strncpy(cmd, message, sizeof(cmd) - 1);
            cmd[sizeof(cmd) - 1] = '\0';
            dispatchRemote(cmd, 0, true);
            return;
        }
        // Enforce strict 50% limit and parse commands
        if (strstr(message, "OPEN_20") || strstr(message, "OPEN_30")) {
            // Note: OPEN_30 is safely mapped to 20% (Clear Area standard)
            dispatchRemote("OPEN", GATE_PCT_CLEAR_AREA, true);
        } else if (strstr(message, "OPEN_50")) {
            dispatchRemote("OPEN", GATE_PCT_DANGER, true);
        } else if (strstr(message, "OPEN_100")) {
            // HARD LIMIT ENFORCEMENT: Never allow 100% opening via MQTT
            Serial.println("[SECURITY] OPEN_100 commanded. HARD CLAMPED to 50% max limit!");
            dispatchRemote("OPEN", GATE_PCT_MAX_LIMIT, true);
        } else if (strstr(message, "OPEN")) {
            dispatchRemote("OPEN", GATE_PCT_CLEAR_AREA, true);
        } else if (strstr(message, "CLOSE")) {
            dispatchRemote("CLOSE", 0, true);
        } else if (strstr(message, "STOP") || strstr(message, "ESTOP")) {
            dispatchRemote("ESTOP", 0, true);
        } else if (strstr(message, "MANUAL")) {
            dispatchRemote("MANUAL", 0, true);
        } else if (strstr(message, "AUTO")) {
            dispatchRemote("AUTO", 0, true);
        } else if (strstr(message, "PREWARN_SMS")) {
            dispatchRemote("PREWARN_SMS", 0, true);
        } else if (strstr(message, "SENSOR_2") || strstr(message, "DUAL")) {
            dispatchRemote("SENSOR_2", 2, true);
        } else if (strstr(message, "SENSOR_1") || strstr(message, "SINGLE")) {
            dispatchRemote("SENSOR_1", 1, true);
        } else if (strstr(message, "RGB") || strstr(message, "TOGGLE_RGB")) {
            dispatchRemote("RGB", 0, true);
        } else if (strstr(message, "BTN_ON")) {
            dispatchRemote("BTN_ON", 0, true);
        } else if (strstr(message, "BTN_OFF")) {
            dispatchRemote("BTN_OFF", 0, true);
        }
    }
}

void TelemetryManager::buildRestEndpoint(const char* tablePath, char* outBuf, size_t outSize) const {
    const char* base = SUPABASE_URL;
    size_t len = strlen(base);
    while (len > 0 && base[len - 1] == '/') {
        len--;
    }

    const char* restSuffix = "/rest/v1";
    size_t suffixLen = strlen(restSuffix);
    bool hasRestSuffix = (len >= suffixLen && strncmp(base + (len - suffixLen), restSuffix, suffixLen) == 0);

    if (hasRestSuffix) {
        snprintf(outBuf, outSize, "%.*s/%s", (int)len, base, tablePath);
    } else {
        snprintf(outBuf, outSize, "%.*s/rest/v1/%s", (int)len, base, tablePath);
    }
}

void TelemetryManager::sendSupabaseTelemetry(const SensorData& sensors, const SystemStatus& status) {
    if (WiFi.status() != WL_CONNECTED) return;
    if (ESP.getFreeHeap() < 38000) {
        Serial.printf("[SUPABASE] Low heap (%u B), skipping telemetry POST to preserve stability.\n",
            (unsigned)ESP.getFreeHeap());
        return;
    }

    WiFiClientSecure secClient;
    secClient.setInsecure(); // Explicitly bypass cert verification for field IoT reliability
    
    HTTPClient http;
    char endpoint[256];
    buildRestEndpoint("sensor_telemetry", endpoint, sizeof(endpoint));

    http.setReuse(false);
    if (!http.begin(secClient, endpoint)) {
        Serial.println("[SUPABASE] http.begin() failed for telemetry POST.");
        secClient.stop();
        return;
    }
    http.setTimeout(4000); // 4-second timeout
    
    char authHeader[384];
    snprintf(authHeader, sizeof(authHeader), "Bearer %s", SUPABASE_ANON_KEY);

    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", SUPABASE_ANON_KEY);
    http.addHeader("Authorization", authHeader);
    http.addHeader("Prefer", "return=minimal");
    
    // FIX: when the DHT22 has no valid reading, send null instead of the 28 C / 75 % defaults
    // (the database stores 0, which the dashboard shows as "--" and a DHT fault).
    char tempStr[16], humStr[16];
    if (sensors.dht_valid) {
        snprintf(tempStr, sizeof(tempStr), "%.2f", sensors.temperature_c);
        snprintf(humStr, sizeof(humStr), "%.2f", sensors.humidity_pct);
    } else {
        strcpy(tempStr, "null");
        strcpy(humStr, "null");
    }
    
    // Construct JSON payload
    char jsonBuffer[512];
    snprintf(jsonBuffer, sizeof(jsonBuffer),
        "{\"sensor_1_dist\":%.2f,\"sensor_2_dist\":%.2f,\"water_level_pct\":%.2f,"
        "\"temperature_c\":%s,\"humidity_pct\":%s,\"alert_state\":%d,"
        "\"control_mode\":%d,\"gate_percent\":%d,\"sensors_agreed\":%s,\"degraded_mode\":%s}",
        sensors.raw_dist_1_cm,
        sensors.raw_dist_2_cm,
        sensors.water_level_pct,
        tempStr,
        humStr,
        (int)status.alertState,
        (int)status.controlMode,
        status.actualGatePercent,
        sensors.sensors_in_agreement ? "true" : "false",
        sensors.degraded_mode ? "true" : "false"
    );
    
    int httpCode = http.POST((uint8_t*)jsonBuffer, strlen(jsonBuffer));
    lastSupabaseHttpCode = httpCode;
    if (httpCode > 0 && httpCode < 400) {
        lastSupabaseSuccessMs = millis();
    } else {
        Serial.printf("[SUPABASE] Telemetry POST error: %d (Heap: %u B)\n",
            httpCode, (unsigned)ESP.getFreeHeap());
    }
    http.end();
    secClient.stop();
}

void TelemetryManager::startLocalWebServer() {
    if (MDNS.begin("sdas")) {
        MDNS.addService("http", "tcp", 80);
    }
    if (!webServerStarted) {
        webServer.on("/", HTTP_GET, [this]() { this->handleWebRoot(); });
        webServer.on("/api/status", HTTP_GET, [this]() { this->handleWebStatusJson(); });
        webServer.onNotFound([this]() { this->handleWebRoot(); });
        webServer.begin();
        webServerStarted = true;
    }
    Serial.printf("[WEB] Direct ESP32 dashboard live at: http://%s/  (or http://sdas.local/)\n",
        WiFi.localIP().toString().c_str());
}

void TelemetryManager::handleWebRoot() {
    webServer.sendHeader("Cache-Control", "no-store");
    webServer.send_P(200, "text/html; charset=utf-8", SDAS_LOCAL_HTML);
}

void TelemetryManager::handleWebStatusJson() {
    SensorData localSensors;
    SystemStatus localStatus;
    bool ready = false;
    memset(&localSensors, 0, sizeof(SensorData));
    memset(&localStatus, 0, sizeof(SystemStatus));

    if (dataMutex != nullptr && xSemaphoreTake(dataMutex, pdMS_TO_TICKS(20)) == pdTRUE) {
        if (hasFreshData) {
            localSensors = snapshotSensors;
            localStatus = snapshotStatus;
            ready = true;
        }
        xSemaphoreGive(dataMutex);
    }

    char ipBuf[24];
    strncpy(ipBuf, WiFi.localIP().toString().c_str(), sizeof(ipBuf) - 1);
    ipBuf[sizeof(ipBuf) - 1] = '\0';

    char json[640];
    snprintf(json, sizeof(json),
        "{\"ready\":%s,\"ssid\":\"%s\",\"ip\":\"%s\",\"rssi\":%d,\"uptime_sec\":%lu,"
        "\"free_heap\":%u,\"mqtt\":%s,\"supabase_http\":%d,"
        "\"water_level_pct\":%.2f,\"water_level_cm\":%.2f,"
        "\"distance_1\":%.2f,\"distance_2\":%.2f,\"s1_valid\":%s,\"s2_valid\":%s,"
        "\"sensors_agreed\":%s,\"critical_fault\":%s,"
        "\"dht_valid\":%s,\"temperature_c\":%.2f,\"humidity_pct\":%.2f,\"sound_mps\":%.1f,"
        "\"alert_state\":%d,\"control_mode\":%d,\"gate_percent\":%d}",
        ready ? "true" : "false",
        WIFI_SSID,
        ipBuf,
        WiFi.RSSI(),
        millis() / 1000UL,
        (unsigned)ESP.getFreeHeap(),
        mqttClient.connected() ? "true" : "false",
        lastSupabaseHttpCode,
        localSensors.water_level_pct,
        localSensors.water_level_cm,
        localSensors.raw_dist_1_cm,
        localSensors.raw_dist_2_cm,
        localSensors.sensor_1_valid ? "true" : "false",
        localSensors.sensor_2_valid ? "true" : "false",
        localSensors.sensors_in_agreement ? "true" : "false",
        localSensors.critical_sensor_fault ? "true" : "false",
        localSensors.dht_valid ? "true" : "false",
        localSensors.temperature_c,
        localSensors.humidity_pct,
        localSensors.speed_of_sound_mps,
        (int)localStatus.alertState,
        (int)localStatus.controlMode,
        localStatus.actualGatePercent
    );

    webServer.sendHeader("Access-Control-Allow-Origin", "*");
    webServer.sendHeader("Cache-Control", "no-store");
    webServer.send(200, "application/json", json);
}

void TelemetryManager::publishMqttTelemetry(const SensorData& sensors, const SystemStatus& status) {
    if (!mqttClient.connected()) return;
    
    // FIX: send null (not the 28.0 default) when the DHT22 has no valid reading
    char tempStr[16];
    if (sensors.dht_valid) snprintf(tempStr, sizeof(tempStr), "%.1f", sensors.temperature_c);
    else strcpy(tempStr, "null");

    char jsonBuffer[384];
    snprintf(jsonBuffer, sizeof(jsonBuffer),
        "{\"level_pct\":%.2f,\"gate_pct\":%d,\"state\":%d,\"mode\":%d,\"temp\":%s,\"fault\":%s,"
        "\"distance_1\":%.2f,\"distance_2\":%.2f}",
        sensors.water_level_pct,
        status.actualGatePercent,
        (int)status.alertState,
        (int)status.controlMode,
        tempStr,
        sensors.degraded_mode ? "true" : "false",
        sensors.raw_dist_1_cm,
        sensors.raw_dist_2_cm
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

// Marks a command row with a new status. Uses its own short-lived TLS client (as the rest of
// this file does) so heap is released between requests.
bool TelemetryManager::patchCommandStatus(const char* id, const char* newStatus) {
    char patchPath[96];
    snprintf(patchPath, sizeof(patchPath), "commands?id=eq.%s", id);
    char patchEndpoint[256];
    buildRestEndpoint(patchPath, patchEndpoint, sizeof(patchEndpoint));

    char authHeader[384];
    snprintf(authHeader, sizeof(authHeader), "Bearer %s", SUPABASE_ANON_KEY);
    char body[48];
    snprintf(body, sizeof(body), "{\"status\":\"%s\"}", newStatus);

    WiFiClientSecure patchSecClient;
    patchSecClient.setInsecure();
    HTTPClient patchHttp;
    patchHttp.setReuse(false);
    int code = -1;
    if (patchHttp.begin(patchSecClient, patchEndpoint)) {
        patchHttp.setTimeout(3000);
        patchHttp.addHeader("Content-Type", "application/json");
        patchHttp.addHeader("apikey", SUPABASE_ANON_KEY);
        patchHttp.addHeader("Authorization", authHeader);
        patchHttp.addHeader("Prefer", "return=minimal");
        code = patchHttp.PATCH((uint8_t*)body, strlen(body));
        patchHttp.end();
    }
    patchSecClient.stop();
    if (code < 200 || code >= 300) {
        Serial.printf("[CLOUD SYNC] Could not mark command %s as %s (HTTP %d)\n", id, newStatus, code);
        return false;
    }
    return true;
}

void TelemetryManager::pollSupabaseCommands() {
    if (WiFi.status() != WL_CONNECTED || g_commandHandler == nullptr) return;
    if (ESP.getFreeHeap() < 38000) return;

    // FIX 1: oldest first. With newest-first, "OPEN_50" then "CLOSE" sent quickly ran CLOSE
    //        first and OPEN_50 five seconds later, leaving the gate OPEN.
    // FIX 2: skip expired commands once the clock is synced (NTP). Before, a command queued
    //        while the node was offline ran whenever it came back, even hours later.
    char query[160];
    time_t nowUtc = time(nullptr);
    if (nowUtc > 1700000000) { // clock is set (after Nov 2023)
        struct tm t;
        gmtime_r(&nowUtc, &t);
        char iso[32];
        strftime(iso, sizeof(iso), "%Y-%m-%dT%H:%M:%SZ", &t);
        snprintf(query, sizeof(query),
            "commands?select=id,type,params&status=eq.PENDING&order=created_at.asc&limit=1&expires_at=gt.%s", iso);
    } else {
        snprintf(query, sizeof(query),
            "commands?select=id,type,params&status=eq.PENDING&order=created_at.asc&limit=1");
    }
    char endpoint[256];
    buildRestEndpoint(query, endpoint, sizeof(endpoint));

    WiFiClientSecure secClient;
    secClient.setInsecure();
    HTTPClient http;
    http.setReuse(false);
    if (!http.begin(secClient, endpoint)) {
        secClient.stop();
        return;
    }
    http.setTimeout(3000);

    char authHeader[384];
    snprintf(authHeader, sizeof(authHeader), "Bearer %s", SUPABASE_ANON_KEY);
    http.addHeader("apikey", SUPABASE_ANON_KEY);
    http.addHeader("Authorization", authHeader);

    int httpCode = http.GET();
    if (httpCode != 200) {
        if (httpCode <= 0 || httpCode >= 400) {
            Serial.printf("[SUPABASE] Command poll error: %d\n", httpCode);
        }
        http.end();
        secClient.stop();
        return;
    }
    String payload = http.getString();
    http.end();
    secClient.stop(); // free the TLS session before the PATCH request

    char cmdId[40] = {0};
    char type[32] = {0};
    if (!jsonStringField(payload, "id", cmdId, sizeof(cmdId)) ||
        !jsonStringField(payload, "type", type, sizeof(type))) {
        return; // no pending command
    }

    // Already executed but the status update failed last time: only retry the update.
    if (strcmp(cmdId, g_lastExecutedId) == 0) {
        patchCommandStatus(cmdId, "EXECUTED");
        return;
    }

    // FIX 3: read the "type" field. The old code searched the WHOLE row text (including the
    //        params written by the dashboard) for words like "AUTO" or "CLOSE".
    char cmdType[40] = {0};
    int targetPct = 0;
    if (!strcmp(type, "OPEN_20") || !strcmp(type, "OPEN_30")) { strcpy(cmdType, "OPEN"); targetPct = GATE_PCT_CLEAR_AREA; }
    else if (!strcmp(type, "OPEN_50") || !strcmp(type, "OPEN_100")) { strcpy(cmdType, "OPEN"); targetPct = GATE_PCT_DANGER; }
    else if (!strcmp(type, "CLOSE")) { strcpy(cmdType, "CLOSE"); }
    else if (!strcmp(type, "ESTOP") || !strcmp(type, "STOP")) { strcpy(cmdType, "ESTOP"); }
    else if (!strcmp(type, "MANUAL")) { strcpy(cmdType, "MANUAL"); }
    else if (!strcmp(type, "AUTO")) { strcpy(cmdType, "AUTO"); }
    else if (!strcmp(type, "PREWARN_SMS")) {
        // FIX 4: the dashboard's "Ping" / "Test SMS" buttons set params.test_only (and
        //        params.target_phone). They used to send a real flood pre-warning to everyone.
        if (payload.indexOf("\"test_only\":true") >= 0 || payload.indexOf("\"test_only\": true") >= 0) {
            char phone[24] = {0};
            if (jsonStringField(payload, "target_phone", phone, sizeof(phone)) && isSafePhoneNumber(phone)) {
                snprintf(cmdType, sizeof(cmdType), "TEST_SMS:%s", phone);
            } else {
                strcpy(cmdType, "TEST_SMS");
            }
        } else {
            strcpy(cmdType, "PREWARN_SMS");
        }
    }
    else if (!strcmp(type, "SENSOR_2") || !strcmp(type, "DUAL")) { strcpy(cmdType, "SENSOR_2"); targetPct = 2; }
    else if (!strcmp(type, "SENSOR_1") || !strcmp(type, "SINGLE")) { strcpy(cmdType, "SENSOR_1"); targetPct = 1; }
    else if (!strcmp(type, "RGB") || !strcmp(type, "TOGGLE_RGB")) { strcpy(cmdType, "RGB"); }
    else if (!strcmp(type, "BTN_ON")) { strcpy(cmdType, "BTN_ON"); }
    else if (!strcmp(type, "BTN_OFF")) { strcpy(cmdType, "BTN_OFF"); }
    else {
        Serial.printf("[CLOUD SYNC] Unknown command type '%s' -> REJECTED\n", type);
        patchCommandStatus(cmdId, "REJECTED");
        return;
    }

    Serial.printf("[CLOUD SYNC] Supabase command %s: %s (%d)\n", cmdId, cmdType, targetPct);
    dispatchRemote(cmdType, targetPct, false);
    strncpy(g_lastExecutedId, cmdId, sizeof(g_lastExecutedId) - 1);
    patchCommandStatus(cmdId, "EXECUTED");
}

// FIX: download the opted-in phone numbers from Supabase so contacts added in the dashboard /
// operator app actually receive SIM800L alerts. The database function only answers when the
// correct SDAS_DEVICE_KEY is sent, so the public anon key alone cannot read phone numbers.
void TelemetryManager::syncSmsRecipients() {
    lastContactSyncMs = millis();
#ifndef SDAS_DEVICE_KEY
    if (!contactSyncDone) {
        Serial.println("[CONTACTS] SDAS_DEVICE_KEY not set in secrets.h -> using the 4 config.h numbers.");
    }
    contactSyncDone = true;
    return;
#else
    if (contactSink == nullptr || WiFi.status() != WL_CONNECTED) return;
    if (ESP.getFreeHeap() < 38000) return;

    char endpoint[256];
    buildRestEndpoint("rpc/get_sms_recipients", endpoint, sizeof(endpoint));
    char authHeader[384];
    snprintf(authHeader, sizeof(authHeader), "Bearer %s", SUPABASE_ANON_KEY);
    char body[160];
    snprintf(body, sizeof(body), "{\"p_key\":\"%s\"}", SDAS_DEVICE_KEY);

    WiFiClientSecure secClient;
    secClient.setInsecure();
    HTTPClient http;
    http.setReuse(false);
    if (!http.begin(secClient, endpoint)) {
        secClient.stop();
        return;
    }
    http.setTimeout(4000);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("apikey", SUPABASE_ANON_KEY);
    http.addHeader("Authorization", authHeader);
    int code = http.POST((uint8_t*)body, strlen(body));
    String payload = (code == 200) ? http.getString() : String();
    http.end();
    secClient.stop();
    contactSyncDone = true;

    if (code != 200) {
        Serial.printf("[CONTACTS] Sync failed (HTTP %d). Keeping current list (%d numbers, 0 = config.h).\n",
            code, contactSink->getRecipientCount());
        return;
    }

    char found[MAX_SMS_CONTACTS][20];
    int n = 0;
    int pos = 0;
    while (n < MAX_SMS_CONTACTS) {
        int k = payload.indexOf("\"phone\":\"", pos);
        if (k < 0) break;
        k += 9;
        int e = payload.indexOf('"', k);
        if (e < 0) break;
        String num = payload.substring(k, e);
        pos = e + 1;
        if (isSafePhoneNumber(num.c_str())) {
            strncpy(found[n], num.c_str(), 19);
            found[n][19] = '\0';
            n++;
        }
    }
    if (n == 0) {
        Serial.println("[CONTACTS] Supabase returned no valid numbers. Keeping current list.");
        return;
    }
    contactSink->setRecipients(found, n);
    Serial.printf("[CONTACTS] %d SMS recipients loaded from Supabase.\n", n);
#endif
}
