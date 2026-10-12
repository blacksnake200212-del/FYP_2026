# SDAS Mobile Applications (React Native & Expo)

## 1. Architectural Role Segregation

To guarantee physical dam infrastructure security while delivering broad public awareness, SDAS maintains **two strictly separated client applications**:

```
                              [ Supabase Backend ]
                                  │           │
                Row Level Security│           │RLS Role Check & Auth
                 (Public View)    │           │(Device Key / JWT)
                                  ▼           ▼
                      +----------------+   +-------------------+
                      |   PUBLIC APP   |   |   OPERATOR APP    |
                      |  (Zero Login)  |   |  (Auth Guarded)   |
                      +----------------+   +-------------------+
                              │                      │
                              │                      ▼ (MQTT Broker)
                              │              [ ESP32 Gate Servo ]
                              │              (Sub-2s Override)
                              ▼
                      [ General Public ]
```

---

## 2. Operator Console (`mobile_apps/operator_app`)
- **Target Audience:** Irrigation department duty engineers, Disaster Management Centre (DMC) officers.
- **Security:** Requires Supabase Authentication and verified operator role.
- **Features:**
  - Real-time reservoir capacity gauge (%).
  - Gate position indicator (% and degrees).
  - High-speed remote commands via MQTT (<2s execution latency):
    - `OPEN_30`: Pre-emptive 30% release.
    - `OPEN_50`: Danger flood release.
    - `CLOSE`: Gate 0% closed.
    - `AUTO`: Returns control to ESP32 local state machine.
    - `ESTOP`: Emergency hardware immobilizer.
  - **Manual Watchdog Timer:** 300-second countdown; automatically restores autonomous mode if connection drops.
  - **Staged Pre-Warning SMS Trigger:** Dispatches pre-warning SMS via SIM800L module.
  - **Dual-Sensor Diagnostic Console:** Inspects individual distances for JSN-SR04T Sensor 1 and 2, delta difference, and mutual consensus.

---

## 3. Public Advisory Portal (`mobile_apps/public_app`)
- **Target Audience:** Local farmers, residents, and businesses in downstream Puttalam basin.
- **Security:** **Login-Free**. Connects to `public_dam_status_view` via Supabase REST. Zero PII, zero operator controls exposed.
- **Features:**
  - Dynamic 4-stage color banners:
    - **Green:** NORMAL (<60%)
    - **Yellow:** PRE-WARNING (60%–80%)
    - **Orange:** CLEAR AREA (80%–85%)
    - **Red:** DANGER ($\ge 85\%$)
  - Sluice gate release discharge indicator.
  - Plain-language community safety instructions.
  - One-tap emergency dial buttons (DMC 117, Police 119, Ambulance 1990).
