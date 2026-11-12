#ifndef SDAS_GSM_MODEM_H
#define SDAS_GSM_MODEM_H

#include <Arduino.h>
#include "config.h"

struct SMSJob {
    char recipient[20];
    char message[140];
    bool inUse;
    bool isPriority;
    uint8_t retryCount;
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
    
    // Recipient list downloaded from Supabase (called from the network task on Core 0).
    // An empty list means "use the CONTACT_* numbers from config.h".
    void setRecipients(const char recipients[][20], int count);
    int  getRecipientCount();
    
    // Modem Health & Diagnostics
    bool isModemReady() const { return modemReady; }
    bool isRegistered() const { return isNetworkRegistered; }
    int  getSignalQuality() const { return signalQuality; }
    int  getPendingCount() const { return queueCount; }
    void hardResetModem();
    bool checkNetworkRegistration();
    void printDiagnostics();

private:
    HardwareSerial simSerial;
    bool modemReady;
    bool isNetworkRegistered;
    int  signalQuality;
    unsigned long lastHeartbeatMs;
    unsigned long lastRegistrationCheckMs;
    
    // SMS Queue (expanded buffer up to SMS_QUEUE_SIZE = 16)
    SMSJob queue[SMS_QUEUE_SIZE];
    int queueHead;
    int queueTail;
    int queueCount;
    
    // State machine for asynchronous AT SMS transmission
    enum TxState {
        TX_IDLE,
        TX_WAIT_PROMPT,
        TX_WAIT_OK,
        TX_RETRY_DELAY
    } txState;
    
    unsigned long txStepTimeoutMs;
    unsigned long txRetryUntilMs;
    int currentJobIndex;
    String rxBuffer;
    
    // Synced recipients, protected by a spinlock (written on Core 0, read on Core 1)
    char syncedRecipients[MAX_SMS_CONTACTS][20];
    int  syncedCount;   // guarded by a file-level spinlock in gsm_modem.cpp
    
    bool sendATCommand(const char* cmd, const char* expectedReply, uint32_t timeoutMs);
    void handleFailureOrRetry(unsigned long now);
};

#endif // SDAS_GSM_MODEM_H
