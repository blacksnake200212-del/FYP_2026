#include "gsm_modem.h"

GSMManager::GSMManager()
    : simSerial(2), modemReady(false), isNetworkRegistered(false),
      signalQuality(0), lastHeartbeatMs(0), lastRegistrationCheckMs(0),
      queueHead(0), queueTail(0), queueCount(0), txState(TX_IDLE),
      txStepTimeoutMs(0), txRetryUntilMs(0), currentJobIndex(-1), rxBuffer("") {
    for (int i = 0; i < SMS_QUEUE_SIZE; i++) {
        queue[i].inUse = false;
        queue[i].isPriority = false;
        queue[i].retryCount = 0;
    }
}

void GSMManager::begin() {
    // 1. Configure Hardware Reset Pin (GPIO23)
    pinMode(PIN_SIM_RST, OUTPUT);
    digitalWrite(PIN_SIM_RST, HIGH); // Normal operation (Active LOW)
    
    // 2. Initialize Hardware UART2: GPIO16 (RX2), GPIO17 (TX2)
    simSerial.begin(SIM_BAUD_RATE, SERIAL_8N1, PIN_SIM_RX2, PIN_SIM_TX2);
    
    // Pulse reset line to ensure fresh boot
    hardResetModem();
    
    // 3. Auto-Baud Detection & Negotiation (9600 & 115200)
    delay(500);
    bool atOk = false;
    for (int retry = 0; retry < 3; retry++) {
        if (sendATCommand("AT", "OK", 800)) {
            atOk = true;
            break;
        }
        delay(200);
    }
    
    if (!atOk) {
        // Try 115200 baud in case factory modem is set to 115200
        simSerial.updateBaudRate(115200);
        delay(300);
        for (int retry = 0; retry < 3; retry++) {
            if (sendATCommand("AT", "OK", 800)) {
                atOk = true;
                // Switch modem to 9600 for noise-immune field transmission
                sendATCommand("AT+IPR=9600", "OK", 800);
                simSerial.updateBaudRate(9600);
                break;
            }
            delay(200);
        }
    }

    if (!atOk) {
        Serial.println("[GSM] ⚠️ SIM800L not answering AT commands! Check:");
        Serial.println("      1) Power: 3.8V-4.1V from XL4015 buck converter (2A burst capable)");
        Serial.println("      2) Common Ground: ESP32 GND and SIM800L GND MUST be connected together");
        Serial.println("      3) UART Cross-Wiring: ESP32 GPIO16(RX2)->SIM800L TXD and GPIO17(TX2)->SIM800L RXD");
        modemReady = false;
        return;
    }
    
    modemReady = true;
    Serial.println("[GSM] ✓ SIM800L UART2 Communication Verified (AT OK)");

    // Configure modem environment
    sendATCommand("ATE0", "OK", 800);            // Echo OFF
    sendATCommand("AT+CMGF=1", "OK", 800);        // Text Mode
    sendATCommand("AT+CSCS=\"GSM\"", "OK", 800); // Standard 7-bit GSM charset
    
    // Query SIM Card Presence
    simSerial.println("AT+CPIN?");
    delay(200);
    String cpinResp = "";
    while (simSerial.available()) cpinResp += (char)simSerial.read();
    if (cpinResp.indexOf("READY") != -1) {
        Serial.println("[GSM] ✓ SIM Card Detected: READY");
    } else {
        Serial.printf("[GSM] ⚠️ SIM Card Warning: %s (Check SIM insertion)\n", cpinResp.c_str());
    }
    
    // Query Signal Quality
    simSerial.println("AT+CSQ");
    delay(200);
    String csqResp = "";
    while (simSerial.available()) csqResp += (char)simSerial.read();
    int csqIdx = csqResp.indexOf("+CSQ: ");
    if (csqIdx != -1) {
        signalQuality = csqResp.substring(csqIdx + 6, csqResp.indexOf(",", csqIdx)).toInt();
        int dbm = -113 + (signalQuality * 2);
        if (signalQuality >= 10 && signalQuality <= 31) {
            Serial.printf("[GSM] ✓ Cellular Signal Quality: CSQ %d/31 (~%d dBm) - Good Signal\n", signalQuality, dbm);
        } else if (signalQuality > 0 && signalQuality < 10) {
            Serial.printf("[GSM] ⚠️ Weak Cellular Signal: CSQ %d/31 (~%d dBm) - Attach external antenna!\n", signalQuality, dbm);
        } else {
            Serial.println("[GSM] ❌ No Cellular Signal Detected (CSQ: 0 or 99). Check 2G coverage.");
        }
    }
    
    // Initial Network Registration Check
    checkNetworkRegistration();
}

void GSMManager::hardResetModem() {
    // 150 ms active-LOW reset pulse
    digitalWrite(PIN_SIM_RST, LOW);
    delay(150);
    digitalWrite(PIN_SIM_RST, HIGH);
    Serial.println("[GSM] Hardware reset pulse sent to SIM800L. Awaiting power-on boot (3.5s)...");
    delay(3500); // Wait for SIM800L power-on initialization and SIM card read
}

bool GSMManager::sendATCommand(const char* cmd, const char* expectedReply, uint32_t timeoutMs) {
    // Clear residual buffer
    while (simSerial.available()) simSerial.read();
    
    simSerial.println(cmd);
    unsigned long deadline = millis() + timeoutMs;
    String response = "";
    
    while (millis() < deadline) {
        while (simSerial.available()) {
            char c = simSerial.read();
            response += c;
            if (response.indexOf(expectedReply) != -1) {
                return true;
            }
        }
        delay(10);
    }
    return false;
}

bool GSMManager::checkNetworkRegistration() {
    if (!modemReady) return false;
    
    // Clear RX buffer
    while (simSerial.available()) simSerial.read();
    
    simSerial.println("AT+CREG?");
    unsigned long deadline = millis() + 800;
    String resp = "";
    while (millis() < deadline) {
        while (simSerial.available()) {
            resp += (char)simSerial.read();
        }
        delay(10);
    }
    
    // Expected: +CREG: 0,1 (Home) or +CREG: 0,5 (Roaming)
    if (resp.indexOf("+CREG: 0,1") != -1 || resp.indexOf("+CREG: 1,1") != -1) {
        isNetworkRegistered = true;
        return true;
    } else if (resp.indexOf("+CREG: 0,5") != -1 || resp.indexOf("+CREG: 1,5") != -1) {
        isNetworkRegistered = true;
        return true;
    } else if (resp.indexOf("+CREG: 0,2") != -1 || resp.indexOf("+CREG: 1,2") != -1) {
        isNetworkRegistered = false; // Searching for cell tower
        return false;
    } else {
        isNetworkRegistered = false;
        return false;
    }
}

bool GSMManager::queueSMS(const char* recipient, const char* message, bool isPriority) {
    if (recipient == nullptr || strlen(recipient) < 7) {
        return false;
    }
    
    // Check if duplicate already in queue
    for (int i = 0; i < queueCount; i++) {
        int idx = (queueHead + i) % SMS_QUEUE_SIZE;
        if (queue[idx].inUse && strcmp(queue[idx].recipient, recipient) == 0 &&
            strcmp(queue[idx].message, message) == 0) {
            return false; // Prevent redundant queuing
        }
    }
    
    if (queueCount >= SMS_QUEUE_SIZE) {
        // Queue full: if priority message, replace an existing non-priority message
        if (isPriority) {
            for (int i = 0; i < SMS_QUEUE_SIZE; i++) {
                int idx = (queueHead + i) % SMS_QUEUE_SIZE;
                if (!queue[idx].isPriority && idx != currentJobIndex) {
                    strncpy(queue[idx].recipient, recipient, 19);
                    queue[idx].recipient[19] = '\0';
                    strncpy(queue[idx].message, message, 139);
                    queue[idx].message[139] = '\0';
                    queue[idx].isPriority = true;
                    queue[idx].inUse = true;
                    queue[idx].retryCount = 0;
                    return true;
                }
            }
        }
        return false; // Queue full
    }
    
    strncpy(queue[queueTail].recipient, recipient, 19);
    queue[queueTail].recipient[19] = '\0';
    strncpy(queue[queueTail].message, message, 139);
    queue[queueTail].message[139] = '\0';
    queue[queueTail].inUse = true;
    queue[queueTail].isPriority = isPriority;
    queue[queueTail].retryCount = 0;
    
    queueTail = (queueTail + 1) % SMS_QUEUE_SIZE;
    queueCount++;
    Serial.printf("[GSM] Queued SMS (%d/%d) for %s: %s\n", queueCount, SMS_QUEUE_SIZE, recipient, message);
    return true;
}

void GSMManager::broadcastAlert(const char* message, bool isPriority) {
    // Staged delivery targeting all 4 registered user testing numbers
    queueSMS(CONTACT_OPERATOR_1, message, isPriority);
    queueSMS(CONTACT_OPERATOR_2, message, isPriority);
    queueSMS(CONTACT_OPERATOR_3, message, isPriority);
    queueSMS(CONTACT_OPERATOR_4, message, isPriority);
}

void GSMManager::handleFailureOrRetry(unsigned long now) {
    rxBuffer = "";
    if (currentJobIndex >= 0 && queue[currentJobIndex].inUse) {
        if (queue[currentJobIndex].retryCount < 2) {
            queue[currentJobIndex].retryCount++;
            Serial.printf("[GSM] 🔄 SMS to %s scheduled for Retry in 4s (Attempt %d of 3)...\n",
                queue[currentJobIndex].recipient, queue[currentJobIndex].retryCount + 1);
            txRetryUntilMs = now + 4000;
            txState = TX_RETRY_DELAY;
            return;
        } else {
            Serial.printf("[GSM] ❌ SMS to %s failed after 3 attempts. Dropping from queue.\n",
                queue[currentJobIndex].recipient);
            queue[currentJobIndex].inUse = false;
        }
    }
    
    queueHead = (queueHead + 1) % SMS_QUEUE_SIZE;
    queueCount--;
    currentJobIndex = -1;
    txState = TX_IDLE;
}

void GSMManager::update() {
    unsigned long now = millis();
    
    switch (txState) {
        case TX_IDLE:
            // Safely clear background incoming messages while idle
            while (simSerial.available()) {
                simSerial.read();
            }
            
            // Periodic network registration & signal check every 15 seconds
            if (now - lastRegistrationCheckMs >= 15000) {
                lastRegistrationCheckMs = now;
                checkNetworkRegistration();
            }
            
            if (queueCount > 0) {
                // Boot Guard: Do not attempt cellular transmission until >= 10 seconds post-boot
                // (SIM800L requires 10-15s to complete SIM card read and register with cell tower)
                if (now < 10000) {
                    static unsigned long lastWaitLog = 0;
                    if (now - lastWaitLog >= 2500) {
                        lastWaitLog = now;
                        Serial.printf("[GSM] ⏳ Storing SMS in queue. Awaiting 2G tower registration (Uptime: %lu s / 10 s)...\n", now / 1000);
                    }
                    return;
                }
                
                // If not yet registered on cell tower, verify registration now
                if (!isNetworkRegistered) {
                    checkNetworkRegistration();
                    if (!isNetworkRegistered) {
                        static unsigned long lastSearchLog = 0;
                        if (now - lastSearchLog >= 4000) {
                            lastSearchLog = now;
                            Serial.println("[GSM] ⏳ Searching for cellular network (+CREG: 0,2). Holding SMS queue until registered...");
                        }
                        return; // Keep holding SMS in queue until tower is found!
                    }
                    Serial.println("[GSM] ✓ Cellular network registered! Dispatching SMS queue...");
                }
                
                // Pop next job
                currentJobIndex = queueHead;
                rxBuffer = "";
                
                Serial.printf("[GSM] 📤 Sending SMS (%d/%d) to %s (Attempt %d/3)...\n",
                    queueCount, SMS_QUEUE_SIZE, queue[currentJobIndex].recipient, queue[currentJobIndex].retryCount + 1);
                
                // Clear any UART noise
                while (simSerial.available()) simSerial.read();
                
                // Ensure Text Mode
                simSerial.println("AT+CMGF=1");
                delay(60);
                while (simSerial.available()) simSerial.read();
                
                // Send AT+CMGS command
                simSerial.print("AT+CMGS=\"");
                simSerial.print(queue[currentJobIndex].recipient);
                simSerial.println("\"");
                
                txStepTimeoutMs = now + 7000; // 7s timeout waiting for '>' prompt
                txState = TX_WAIT_PROMPT;
            }
            break;
            
        case TX_WAIT_PROMPT:
            while (simSerial.available()) {
                char c = simSerial.read();
                rxBuffer += c;
                
                if (c == '>') {
                    // Prompt received: Send message payload + Ctrl+Z (ASCII 26)
                    Serial.println("[GSM] '>' Prompt received! Uploading SMS payload to 2G network...");
                    simSerial.print(queue[currentJobIndex].message);
                    simSerial.write(26); // Ctrl+Z
                    rxBuffer = "";
                    txStepTimeoutMs = now + 20000; // 20s timeout waiting for network delivery confirmation
                    txState = TX_WAIT_OK;
                    return;
                }
                
                if (rxBuffer.indexOf("ERROR") != -1 || rxBuffer.indexOf("+CMS ERROR") != -1) {
                    Serial.printf("[GSM] ❌ Modem rejected AT+CMGS: %s\n", rxBuffer.c_str());
                    handleFailureOrRetry(now);
                    return;
                }
            }
            
            if (now > txStepTimeoutMs) {
                Serial.printf("[GSM] ⚠️ Timeout (7s) waiting for '>' prompt from SIM800L for %s! Response: [%s]\n",
                    queue[currentJobIndex].recipient, rxBuffer.c_str());
                simSerial.write(27); // Send ESC to cancel command
                handleFailureOrRetry(now);
            }
            break;
            
        case TX_WAIT_OK:
            while (simSerial.available()) {
                char c = simSerial.read();
                rxBuffer += c;
                
                if (rxBuffer.indexOf("OK") != -1 || rxBuffer.indexOf("+CMGS:") != -1) {
                    Serial.printf("[GSM] ✓✓✓ SMS SUCCESSFULLY DELIVERED to %s!\n", queue[currentJobIndex].recipient);
                    queue[currentJobIndex].inUse = false;
                    queueHead = (queueHead + 1) % SMS_QUEUE_SIZE;
                    queueCount--;
                    currentJobIndex = -1;
                    rxBuffer = "";
                    txState = TX_IDLE;
                    return;
                }
                
                if (rxBuffer.indexOf("ERROR") != -1 || rxBuffer.indexOf("+CMS ERROR") != -1) {
                    Serial.printf("[GSM] ❌ Cellular Network Rejected SMS: %s (Recipient: %s)\n",
                        rxBuffer.c_str(), queue[currentJobIndex].recipient);
                    handleFailureOrRetry(now);
                    return;
                }
            }
            
            if (now > txStepTimeoutMs) {
                Serial.printf("[GSM] ⚠️ Network delivery confirmation timeout (20s) for %s. Response: [%s]\n",
                    queue[currentJobIndex].recipient, rxBuffer.c_str());
                simSerial.write(27); // Send ESC to cancel
                handleFailureOrRetry(now);
            }
            break;
            
        case TX_RETRY_DELAY:
            if (now >= txRetryUntilMs) {
                txState = TX_IDLE; // Ready to re-attempt
            }
            break;
    }
}

void GSMManager::printDiagnostics() {
    Serial.println("\n=======================================================");
    Serial.println("  SIM800L CELLULAR SUBSYSTEM DIAGNOSTIC PROBE");
    Serial.println("=======================================================");
    
    // Clear buffer
    while (simSerial.available()) simSerial.read();
    
    // 1. Basic AT Ping
    bool at = sendATCommand("AT", "OK", 1000);
    Serial.printf("1. UART AT Communication:    %s\n", at ? "✓ OK" : "❌ FAILED (Check GPIO16/17 and Power)");
    
    // 2. SIM Card (CPIN)
    simSerial.println("AT+CPIN?");
    delay(200);
    String cpin = "";
    while (simSerial.available()) cpin += (char)simSerial.read();
    cpin.trim();
    Serial.printf("2. SIM Card Detection:       %s\n", cpin.indexOf("READY") != -1 ? "✓ READY (SIM Inserted)" : "❌ NOT DETECTED");
    
    // 3. Signal Quality (CSQ)
    simSerial.println("AT+CSQ");
    delay(200);
    String csq = "";
    while (simSerial.available()) csq += (char)simSerial.read();
    int csqIdx = csq.indexOf("+CSQ: ");
    if (csqIdx != -1) {
        int csqVal = csq.substring(csqIdx + 6, csq.indexOf(",", csqIdx)).toInt();
        int dbm = -113 + (csqVal * 2);
        Serial.printf("3. Signal Quality (CSQ):     %d/31 (~%d dBm) %s\n",
            csqVal, dbm, (csqVal >= 10) ? "✓ Strong" : "⚠️ Weak / Marginal");
    } else {
        Serial.println("3. Signal Quality (CSQ):     ❌ Unknown");
    }
    
    // 4. Network Registration (CREG)
    simSerial.println("AT+CREG?");
    delay(200);
    String creg = "";
    while (simSerial.available()) creg += (char)simSerial.read();
    bool reg = (creg.indexOf("+CREG: 0,1") != -1 || creg.indexOf("+CREG: 1,1") != -1 ||
                creg.indexOf("+CREG: 0,5") != -1 || creg.indexOf("+CREG: 1,5") != -1);
    Serial.printf("4. 2G Tower Registration:    %s\n",
        reg ? "✓ REGISTERED (Dialog/Mobitel/Airtel/Hutch)" : "❌ NOT REGISTERED (Searching...)");
    
    // 5. SMS Center (CSCA)
    simSerial.println("AT+CSCA?");
    delay(200);
    String csca = "";
    while (simSerial.available()) csca += (char)simSerial.read();
    csca.trim();
    int cscaIdx = csca.indexOf("+CSCA: ");
    if (cscaIdx != -1) {
        String scNum = csca.substring(cscaIdx + 7, csca.indexOf("\"", cscaIdx + 8) + 1);
        Serial.printf("5. SMS Service Center:       %s\n", scNum.c_str());
    } else {
        Serial.println("5. SMS Service Center:       Default SIM Profile");
    }
    
    // 6. Power Supply Voltage (CBC)
    simSerial.println("AT+CBC");
    delay(200);
    String cbc = "";
    while (simSerial.available()) cbc += (char)simSerial.read();
    int cbcIdx = cbc.indexOf("+CBC: ");
    if (cbcIdx != -1) {
        int lastComma = cbc.lastIndexOf(",");
        String millivolts = cbc.substring(lastComma + 1, cbc.indexOf("\r", lastComma));
        millivolts.trim();
        float volts = millivolts.toFloat() / 1000.0f;
        Serial.printf("6. SIM800L Operating Volts:  %.2f V (Recommended: 3.8V - 4.1V)\n", volts);
    }
    
    // 7. SMS Queue
    Serial.printf("7. SMS Queue Backlog:        %d pending messages (Buffer capacity: %d)\n", queueCount, SMS_QUEUE_SIZE);
    Serial.println("=======================================================\n");
}
