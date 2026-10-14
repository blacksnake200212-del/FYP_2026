#ifndef SDAS_GSM_MODEM_H
#define SDAS_GSM_MODEM_H

#include <Arduino.h>
#include "config.h"

struct SMSJob {
    char recipient[20];
    char message[140];
    bool inUse;
    bool isPriority;
};

class GSMManager {
public:
    GSMManager();
    void begin();
    
    // Non-blocking processing routine
    void update();
    
    // Enqueue staged SMS broadcast
    bool queueSMS(const char* recipient, const char* message, bool isPriority = false);
    void broadcastAlert(const char* message, bool isPriority = false);
    
    // Modem Health & Diagnostics
    bool isRegistered() const { return modemReady; }
    int  getSignalQuality() const { return signalQuality; }
    int  getPendingCount() const { return queueCount; }
    void hardResetModem();

private:
    HardwareSerial simSerial;
    bool modemReady;
    int  signalQuality;
    unsigned long lastHeartbeatMs;
    
    // SMS Queue (expanded buffer up to SMS_QUEUE_SIZE = 16)
    SMSJob queue[SMS_QUEUE_SIZE];
    int queueHead;
    int queueTail;
    int queueCount;
    
    // State machine for asynchronous AT SMS transmission
    enum TxState {
        TX_IDLE,
        TX_SEND_CMGS,
        TX_WAIT_PROMPT,
        TX_SEND_BODY,
        TX_WAIT_OK
    } txState;
    
    unsigned long txStepTimeoutMs;
    int currentJobIndex;
    String rxBuffer;
    
    bool sendATCommand(const char* cmd, const char* expectedReply, uint32_t timeoutMs);
    void readIncomingSerial();
    void processNextQueueItem();
};

#endif // SDAS_GSM_MODEM_H
