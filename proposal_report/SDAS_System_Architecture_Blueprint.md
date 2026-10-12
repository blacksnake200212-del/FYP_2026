# SDAS System Architecture Blueprint & Dataflow Specification

## 1. Architectural Overview & Separation of Concerns

A failure in cloud infrastructure, Wi-Fi connectivity, or external machine learning services must **never** jeopardize physical dam safety. The SDAS system architecture explicitly decouples operations into three distinct pathways:

```
+───────────────────────────────────────────────────────────────────────────────────────────+
|                                  SDAS COMPLETE DATAFLOW MAP                               |
+───────────────────────────────────────────────────────────────────────────────────────────+

  ================================ [ PATH 1: LOCAL CLOSED-LOOP ] ===========================
  +------------------+
  |  Dual JSN-SR04T  | ──(Echo μs)──> [ ESP32 Plausibility & Voting ]
  +------------------+                      │   (Delta <= 5cm, Rate check)
  +------------------+                      │
  |   DHT22 Temp     | ──(Temp °C)──> [ Speed-of-Sound Correction ]
  +------------------+                      │
                                            ▼
                                [ 4-Stage State Machine ]
                                (3% Hysteresis Logic)
                                   │         │          │
                 ┌─────────────────┘         │          └────────────────┐
                 ▼                           ▼                           ▼
        [ MG996R Sluice Gate ]       [ RGB LED Indicator ]      [ SIM800L GSM Modem ]
        (0%, 30%, 50%, 100%)         (Green, Ylw, Org, Red)     (Staged SMS Dispatch)
        (NVS Flash Memory)           (Active-LOW Current-Bal)   (Hardware Reset Pin)

  ================================ [ PATH 2: TELEMETRY & ML ] ==============================
  [ ESP32 Wi-Fi Task ]
           │
           ├──(JSON Payload / 5s)──> [ Supabase REST / Edge Functions ]
           │                         (Insert-Only Anon Key)
           │                                 │
           │                                 ▼
           │                         [ PostgreSQL Database ]
           │                         (RLS Protected Tables)
           │                                 │
           │                                 ▼
           │                         [ Read-Only Public View ] ──> [ Public Mobile App ]
           │
           └──(HTTP / Webhook)─────> [ FastAPI ML Inference Service ]
                                             │
                                             ├──> [ LSTM 1-Hr Level Forecaster ]
                                             ├──> [ Autoencoder Anomaly Detector ]
                                             └──> [ Open-Meteo Weather API ]

  ================================ [ PATH 3: OPERATOR OVERRIDE ] ===========================
  [ Operator Mobile App ]
  (Supabase Auth + MFA)
           │
           └──(MQTT TLS Publish)───> [ HiveMQ / EMQX Cloud Broker ]
                                             │
                                             ▼ (Sub-2s Latency)
                                     [ ESP32 MQTT Client ]
                                             │
                                             ▼
                                     [ Safety Rules Validation ]
                                     (Emergency > Manual > Auto)
                                     (300s Auto-Revert Watchdog)
                                             │
                                             ▼
                                     [ Physical Gate Servo Actuation ]
```

---

## 2. Finite State Machine Specification

### 2.1 State Transition Conditions

Let $L_t$ be the temperature-compensated water level percentage, and $S_t$ be the current operational alert state.

$$\text{Next State } S_{t+1} = \begin{cases}
\text{DANGER} & \text{if } L_t \ge 85\% \lor (S_t = \text{DANGER} \land L_t \ge 82\%) \\
\text{CLEAR AREA} & \text{if } (L_t \ge 80\% \land L_t < 85\%) \lor (S_t = \text{CLEAR AREA} \land L_t \ge 77\%) \\
\text{PRE-WARNING} & \text{if } (L_t \ge 60\% \land L_t < 80\%) \lor (S_t = \text{PRE-WARNING} \land L_t \ge 57\%) \\
\text{NORMAL} & \text{otherwise}
\end{cases}$$

### 2.2 Control Modes & Precedence Hierarchy

Physical control over the MG996R sluice gate follows strict deterministic precedence:
1. **EMERGENCY Mode (Priority 1 - Highest):**
   - Triggered by: Physical E-STOP push button (GPIO22) or dual-sensor failure.
   - Behavior: Halts all motion immediately, latches failsafe alarm, sounds siren.
2. **MANUAL Mode (Priority 2):**
   - Triggered by: Physical push buttons (OPEN on GPIO14, CLOSE on GPIO26) or authenticated Operator App command via MQTT.
   - Constraints: Maximum open limit checked against dam safety rules. A **300-second watchdog timer** continuously counts down. If no operator keep-alive or new command is received, the node automatically reverts to AUTO mode.
3. **AUTO Mode (Priority 3 - Default):**
   - Governed entirely by the 4-stage alert state machine using dual-sensor plausibility.

---

## 3. Plausibility Engine & Dual-Sensor Fault Mitigation

The ESP32 firmware executes a 3-tier plausibility check on every sampling cycle ($T_s = 2.0\text{ s}$):

```
  [ Trigger JSN-SR04T #1 ] ──> Wait 60 ms ──> [ Trigger JSN-SR04T #2 ]
             │                                        │
             ▼                                        ▼
        Raw Echo 1                               Raw Echo 2
             │                                        │
             └───────────────────┬────────────────────┘
                                 ▼
              [ Temperature Speed-of-Sound Correction ]
                                 ▼
                     Distance d1 and Distance d2
                                 │
     +---------------------------+---------------------------+
     |                                                       |
     ▼                                                       ▼
[ Check 1: Physical Limits ]                   [ Check 2: Delta Difference ]
Is 25 cm <= d <= 450 cm?                       Is |d1 - d2| <= 5.0 cm?
     │                                                       │
     ├─ PASS: Continue                                       ├─ PASS: Average = (d1 + d2) / 2
     └─ FAIL: Mark sensor invalid                            └─ FAIL: Flag Divergence Warning
                                                             │        Fallback to valid sensor
                                                             ▼
                                               [ Check 3: Rate of Change ]
                                               Is |Average - Prev| <= 15 cm/s?
                                                             │
                                                             ├─ PASS: Valid Tank Level
                                                             └─ FAIL: Reject transient spike
```

- **Degraded Fallback Mode:** If Sensor 1 fails the physical limit check while Sensor 2 passes, the system uses Sensor 2, sets a warning flag in telemetry, and issues a maintenance SMS alert.
- **Fail-Safe Alarm Mode:** If both sensors fail, the system transitions to failsafe mode, alerts operators, and holds the last verified gate position from NVS flash memory.
