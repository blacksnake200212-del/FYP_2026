#include "gsm_modem.h"

GSMManager::GSMManager()
    : simSerial(2), modemReady(false), signalQuality(0), lastHeartbeatMs(0),
      queueHead(0), queueTail(0), queueCount(0), txState(TX_IDLE),
      txStepTimeoutMs(0), currentJobIndex(-1), rxBuffer("") {
    for (int i = 0; i < SMS_QUEUE_SIZE; i++) {
        queue[i].inUse = false;
        queue[i].isPriority = false;
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
    
    // 3. Initialize AT Commands
    delay(1000);
    bool atOk = sendATCommand("AT", "OK", 1000);
    if (!atOk) {
        Serial.println("[GSM] ⚠️ SIM800L did not answer AT! Check: 1) 3.8-4.1V power to VCC, 2) Common GND, 3) GPIO16(RX2)-TXD and GPIO17(TX2)-RXD.");
    } else {
        Serial.println("[GSM] ✓ SIM800L UART2 Communication Verified (AT OK)");
    }
    sendATCommand("ATE0", "OK", 1000);            // Echo OFF
    sendATCommand("AT+CMGF=1", "OK", 1000);        // Text Mode
    sendATCommand("AT+CSCS=\"GSM\"", "OK", 1000); // Standard 7-bit GSM charset
    
    // Read signal quality (AT+CSQ)
    sendATCommand("AT+CSQ", "OK", 1000);
    modemReady = atOk;
}

void GSMManager::hardResetModem() {
    // 100 ms active-LOW reset pulse
    digitalWrite(PIN_SIM_RST, LOW);
    delay(150);
    digitalWrite(PIN_SIM_RST, HIGH);
    delay(3000); // Wait for SIM800L power-on initialization and SIM card read
}

bool GSMManager::sendATCommand(const char* cmd, const char* expectedReply, uint32_t timeoutMs) {
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

bool GSMManager::queueSMS(const char* recipient, const char* message, bool isPriority) {
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

void GSMManager::update() {
    unsigned long now = millis();
    
    // Note: Do NOT drain simSerial unconditionally here, as that would discard
    // the '>' prompt and 'OK' responses from the modem before the state machine reads them!
    
    // Periodic modem heartbeat check every 60 seconds (only when IDLE)
    if (txState == TX_IDLE && (now - lastHeartbeatMs >= 60000)) {
        lastHeartbeatMs = now;
        simSerial.println("AT");
    }
    
    // Asynchronous non-blocking SMS Transmission State Machine
    switch (txState) {
        case TX_IDLE:
            // Safely drain background unsolicited result codes (e.g. +CMTI, RING) strictly while idle
            while (simSerial.available()) {
                simSerial.read();
            }
            
            if (queueCount > 0) {
                currentJobIndex = queueHead;
                rxBuffer = "";
                Serial.printf("[GSM] Transmitting to %s via AT+CMGS...\n", queue[currentJobIndex].recipient);
                simSerial.print("AT+CMGS=\"");
                simSerial.print(queue[currentJobIndex].recipient);
                simSerial.println("\"");
                txStepTimeoutMs = now + 5000; // 5s timeout waiting for '>' prompt
                txState = TX_WAIT_PROMPT;
            }
            break;
            
        case TX_WAIT_PROMPT:
            while (simSerial.available()) {
                char c = simSerial.read();
                if (c == '>') {
                    // Prompt received: Send message body + Ctrl+Z (ASCII 26)
                    Serial.println("[GSM] '>' Prompt received! Uploading message payload...");
                    simSerial.print(queue[currentJobIndex].message);
                    simSerial.write(26);
                    rxBuffer = "";
                    txStepTimeoutMs = now + 15000; // 15s timeout waiting for network delivery OK
                    txState = TX_WAIT_OK;
                    return;
                } else if (c == 'E') {
                    // Check if modem sent ERROR
                    rxBuffer += c;
                    if (rxBuffer.indexOf("ERROR") != -1) {
                        Serial.println("[GSM] ❌ Modem returned ERROR on AT+CMGS prompt!");
                        queue[currentJobIndex].inUse = false;
                        queueHead = (queueHead + 1) % SMS_QUEUE_SIZE;
                        queueCount--;
                        rxBuffer = "";
                        txState = TX_IDLE;
                        return;
                    }
                } else {
                    rxBuffer += c;
                }
            }
            if (now > txStepTimeoutMs) {
                Serial.printf("[GSM] ⚠️ Timeout waiting for '>' prompt from SIM800L for %s! (Check 4V power / UART TX2-RX2)\n", queue[currentJobIndex].recipient);
                simSerial.write(27); // Send ESC to cancel
                queue[currentJobIndex].inUse = false;
                queueHead = (queueHead + 1) % SMS_QUEUE_SIZE;
                queueCount--;
                rxBuffer = "";
                txState = TX_IDLE;
            }
            break;
            
        case TX_WAIT_OK:
            while (simSerial.available()) {
                char c = simSerial.read();
                rxBuffer += c;
                if (rxBuffer.indexOf("OK") != -1 || rxBuffer.indexOf("+CMGS:") != -1) {
                    Serial.printf("[GSM] ✓ SMS Successfully Delivered to %s!\n", queue[currentJobIndex].recipient);
                    queue[currentJobIndex].inUse = false;
                    queueHead = (queueHead + 1) % SMS_QUEUE_SIZE;
                    queueCount--;
                    rxBuffer = "";
                    txState = TX_IDLE;
                    return;
                } else if (rxBuffer.indexOf("ERROR") != -1 || rxBuffer.indexOf("+CMS ERROR") != -1) {
                    Serial.printf("[GSM] ❌ Cellular Network Rejected SMS (+CMS ERROR) for %s! Check SIM credit and 2G coverage.\n", queue[currentJobIndex].recipient);
                    queue[currentJobIndex].inUse = false;
                    queueHead = (queueHead + 1) % SMS_QUEUE_SIZE;
                    queueCount--;
                    rxBuffer = "";
                    txState = TX_IDLE;
                    return;
                }
            }
            if (now > txStepTimeoutMs) {
                Serial.printf("[GSM] ⚠️ Network delivery timeout (15s) for %s.\n", queue[currentJobIndex].recipient);
                simSerial.write(27);
                queue[currentJobIndex].inUse = false;
                queueHead = (queueHead + 1) % SMS_QUEUE_SIZE;
                queueCount--;
                rxBuffer = "";
                txState = TX_IDLE;
            }
            break;
    }
}
