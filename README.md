# Smart Dam Alert System with Automated Gate Control (SDAS)
## Final Engineering Prototype & Research Project Repository

**Faculty of Computing and IT, SLTC Research University, Sri Lanka**  
**Lead Authors:** Dias Adrian (Cyber Security), AAA Aadhil (Data Science), JMRA Dilshan (Software Engineering)  
**Supervisors:** Dr. Sanika Wijayasekara, Mr. Kavinda Tharindu  

---

## 1. Project Overview & Corrected Engineering Blueprint

The **Smart Dam Alert System (SDAS)** is an autonomous, fail-safe early warning and sluice gate control platform engineered for remote flood-prone catchment areas (such as the Tabbowa Dam and Deduru Oya river network in Sri Lanka's Puttalam District).

This repository contains the complete, audited, and corrected implementation resolving all electronic faults, firmware risks, and proposal-vs-hardware mismatches identified in the initial design reviews.

---

## 2. Directory Structure

```
FYP_2026/
├── firmware/                        # Embedded ESP32 C++ Production Firmware
│   ├── SDAS_ESP32_Firmware/
│   │   ├── SDAS_ESP32_Firmware.ino  # Main setup and multi-rate loop scheduler
│   │   ├── config.h                 # Audited pinout, thresholds, and geometry
│   │   ├── sensors.h / .cpp         # Dual JSN-SR04T alternating pings & DHT22 compensation
│   │   ├── actuators.h / .cpp       # MG996R servo LEDC driver, RGB LED, transistor buzzer
│   │   ├── state_machine.h / .cpp   # 4-stage FSM (3% hysteresis), manual watchdog, NVS
│   │   ├── gsm_modem.h / .cpp       # SIM800L non-blocking SMS queue & GPIO23 reset
│   │   └── network_telemetry.h / .cpp # Wi-Fi, Supabase REST poster & MQTT command client
│   └── README.md
├── hardware_docs/                   # Audited Electrical & Mechanical Specifications
│   ├── CORRECTED_CIRCUIT_AND_PINMAP.md # Detailed circuit audit (all 11 fault fixes)
│   ├── BILL_OF_MATERIALS.md        # Complete BOM with component ratings and footprints
│   ├── POWER_AND_BATTERY_DESIGN.md # 12V 5A power calculations & 3S Li-ion UPS design
│   └── CALIBRATION_AND_TESTING_GUIDE.md # 7-stage verification & 100-cycle stress test
├── proposal_report/                 # Academic Proposals & Blueprints
│   ├── SDAS_Corrected_Proposal_V2.md # Fully updated academic proposal (IEEE format)
│   └── SDAS_System_Architecture_Blueprint.md # 3 decoupled paths, state diagrams, dataflow
├── backend_ml/                      # Machine Learning Inference Server (FastAPI)
│   ├── app/
│   │   ├── main.py                  # FastAPI REST endpoints (/forecast, /anomaly-check)
│   │   ├── ml_service.py            # Neural forecaster, autoencoder & RF inference
│   │   ├── models.py                # Pydantic schemas
│   │   └── weather_service.py       # Open-Meteo live precipitation client
│   ├── train/
│   │   ├── generate_synthetic_data.py # 7-day hydrological tank simulation generator
│   │   ├── train_lstm.py            # 1-hour ahead neural sequence forecaster
│   │   ├── train_autoencoder.py     # Deep autoencoder sensor anomaly detector
│   │   └── train_random_forest.py   # Multi-class hazard tier classifier
│   ├── saved_models/                # Persisted joblib model artifacts
│   ├── tests/
│   │   └── test_api.py              # Full automated test suite (5 passing tests)
│   └── requirements.txt
├── database/                        # Supabase PostgreSQL Database Architecture
│   ├── schema.sql                   # Tables, RLS security policies, and public view
│   ├── seed_data.sql                # Calibrated baseline telemetry and contact seeds
│   └── README.md
└── mobile_apps/                     # Mobile Applications (React Native & Expo)
    ├── operator_app/                # Authenticated console (MQTT commands, manual override)
    ├── public_app/                  # Zero-login portal (4-tier color alerts, emergency dials)
    └── README.md
```

---

## 3. Key Electronic & Architectural Rectifications

1. **UART Swapped Pins:** Corrected ESP32 hardware UART2 mapping to **GPIO16 (RX2)** and **GPIO17 (TX2)**.
2. **Rail Segregation (5V vs 4V):** Strictly isolated Buck #1 (5.0V for Servo, Buzzer, Sensors) and Buck #2 (4.0V dedicated exclusively to SIM800L).
3. **Buzzer Transistor Driver:** Replaced direct GPIO drive with a **BC547 / 2N2222 NPN switching transistor** and 1N4007 clamp diode.
4. **SIM800L 2.8V Serial Protection:** Implemented 1 kΩ / 2.2 kΩ passive resistor divider on ESP32 TX line.
5. **Level Shifter Wiring:** Explicitly mapped 4-channel bidirectional converter with HV=5V, LV=3.3V, and common GND.
6. **Input Protection & Power Sizing:** Upgraded to **12V 5A adapter** with 5A fuse, reverse-polarity Schottky diode, and 3S2P Li-ion battery UPS (~10 hours offline runtime).
7. **Button Conflict Resolution:** Moved manual controls to **GPIO14 (OPEN)**, **GPIO26 (CLOSE)**, and **GPIO22 (E-STOP)**, freeing GPIO32/33 for balanced RGB LED.
8. **Modem Latch-Up Mitigation:** Assigned **GPIO23** to SIM800L hardware reset with automatic heartbeat recovery.
9. **Three Decoupled Paths:**
   - **Local Loop:** Sensors $\rightarrow$ ESP32 rules $\rightarrow$ Gate, Siren, SMS (zero cloud dependence).
   - **Telemetry Path:** ESP32 $\rightarrow$ Wi-Fi $\rightarrow$ Supabase & ML server.
   - **Command Path:** Operator App $\rightarrow$ MQTT $\rightarrow$ ESP32 with 300s watchdog timeout.
10. **4-Tier State Machine with 3% Hysteresis:**
    - NORMAL (<60%): Gate 0%, LED Green.
    - PRE-WARNING ($\ge 60\%$): Gate 0% (preserve water), LED Yellow, Operator can trigger manual SMS.
    - CLEAR AREA ($\ge 80\%$): Gate 30% open (automatic), LED Orange, Auto SMS.
    - DANGER ($\ge 85\%$): Gate 50% open (automatic), LED Red, Pulsing Siren + Danger SMS.
    - Hysteresis exit points: 57%, 77%, 82%.
11. **Academic Proposal Updated:** Corrected sensor names (JSN-SR04T, DHT22), actuator (MG996R servo for prototype), realistic metrics, Open-Meteo weather API, and IEEE reference citations.
