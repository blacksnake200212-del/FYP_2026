#include "gsm_modem.h"

GSMManager::GSMManager()
    : simSerial(2), modemReady(false), signalQuality(0), lastHeartbeatMs(0),
      queueHead(0), queueTail(0), queueCount(0), txState(TX_IDLE),
      txStepTimeoutMs(0), currentJobIndex(-1) {
    for (int i = 0; i < 6; i++) {
        queue[i].inUse = false;
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
    sendATCommand("AT", "OK", 1000);
    sendATCommand("ATE0", "OK", 1000);        // Echo OFF
    sendATCommand("AT+CMGF=1", "OK", 1000);    // Text Mode
    sendATCommand("AT+CSCS=\"GSM\"", "OK", 1000); // Standard 7-bit GSM charset
    
    // Read signal quality (AT+CSQ)
    sendATCommand("AT+CSQ", "OK", 1000);
    modemReady = true;
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

bool GSMManager::queueSMS(const char* recipient, const char* message) {
    if (queueCount >= 6) return false; // Queue full
    
    strncpy(queue[queueTail].recipient, recipient, 19);
    queue[queueTail].recipient[19] = '\0';
    strncpy(queue[queueTail].message, message, 139);
    queue[queueTail].message[139] = '\0';
    queue[queueTail].inUse = true;
    
    queueTail = (queueTail + 1) % 6;
    queueCount++;
    return true;
}

void GSMManager::broadcastAlert(const char* message) {
    // Staged delivery targeting primary emergency personnel within 30 seconds
    queueSMS(CONTACT_OPERATOR_1, message);
    queueSMS(CONTACT_OPERATOR_2, message);
    queueSMS(CONTACT_DMC_CONTROL, message);
}

void GSMManager::update() {
    unsigned long now = millis();
    
    // Drain background UART bytes
    while (simSerial.available()) {
        char c = simSerial.read();
        // Discard or log unsolicited result codes (URCs)
    }
    
    // Periodic modem heartbeat check every 60 seconds
    if (txState == TX_IDLE && (now - lastHeartbeatMs >= 60000)) {
        lastHeartbeatMs = now;
        simSerial.println("AT");
    }
    
    // Asynchronous non-blocking SMS Transmission State Machine
    switch (txState) {
        case TX_IDLE:
            if (queueCount > 0) {
                currentJobIndex = queueHead;
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
                    // Send message body + Ctrl+Z (ASCII 26)
                    simSerial.print(queue[currentJobIndex].message);
                    simSerial.write(26);
                    txStepTimeoutMs = now + 10000; // 10s timeout waiting for OK
                    txState = TX_WAIT_OK;
                    return;
                }
            }
            if (now > txStepTimeoutMs) {
                // Timeout on prompt - cancel and discard
                simSerial.write(27); // Escape
                queue[currentJobIndex].inUse = false;
                queueHead = (queueHead + 1) % 6;
                queueCount--;
                txState = TX_IDLE;
            }
            break;
            
        case TX_WAIT_OK:
            while (simSerial.available()) {
                String resp = simSerial.readStringUntil('\n');
                if (resp.indexOf("OK") != -1 || resp.indexOf("+CMGS:") != -1) {
                    // SMS successfully sent
                    queue[currentJobIndex].inUse = false;
                    queueHead = (queueHead + 1) % 6;
                    queueCount--;
                    txState = TX_IDLE;
                    return;
                } else if (resp.indexOf("ERROR") != -1) {
                    // Delivery failed
                    queue[currentJobIndex].inUse = false;
                    queueHead = (queueHead + 1) % 6;
                    queueCount--;
                    txState = TX_IDLE;
                    return;
                }
            }
            if (now > txStepTimeoutMs) {
                // Timeout waiting for OK
                queue[currentJobIndex].inUse = false;
                queueHead = (queueHead + 1) % 6;
                queueCount--;
                txState = TX_IDLE;
            }
            break;
    }
}
