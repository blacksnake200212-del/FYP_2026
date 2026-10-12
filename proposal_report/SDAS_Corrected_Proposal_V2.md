# Smart Dam Alert System with Automated Gate Control (SDAS)
## Revised Engineering Proposal & Final Architectural Specification (Version 2.0)

**Project Team:**  
- **Dias Adrian** (Cyber Security)  
- **AAA Aadhil** (Data Science)  
- **JMRA Dilshan** (Software Engineering)  

**Supervisory Board:**  
- **Dr. Sanika Wijayasekara** (Lead Supervisor – Data Science and Cyber Security)  
- **Mr. Kavinda Tharindu** (Co-Supervisor – Data Science)  

**Affiliation:** Faculty of Computing and IT, SLTC Research University, Ingiriya Road, Meepe, Sri Lanka  

---

## 1. Introduction & Contextual Background

Seasonal flooding in the low-lying catchment basins of the Puttalam District, particularly around the Deduru Oya and Tabbowa reservoir cascade networks, poses recurring humanitarian, agricultural, and socio-economic risks [1]. Field studies and post-disaster assessments conducted by the Disaster Management Centre (DMC) of Sri Lanka reveal that while dam structural integrity is maintained, emergency reservoir discharge management frequently encounters operational latencies [1], [2]. During extreme precipitation events (such as the Northeast Monsoon and inter-monsoonal cyclonic depressions), manual physical gate manipulations and telephonic verification protocols can require 30 minutes or more from threshold breach to effective sluice gate displacement [2]. In rapid-onset flash floods, such response delays compress downstream evacuation windows.

The Smart Dam Alert System with Automated Gate Control (SDAS) resolves these challenges through a resilient, layered IoT and data-driven infrastructure:
1. **Local Autonomous Safety Loop:** An on-site embedded controller executing closed-loop sensing, acoustic temperature compensation, sensor plausibility voting, and multi-tier gate regulation without cloud or external network dependencies.
2. **Cellular Emergency Dispatch:** Hardware-driven staged Short Message Service (SMS) broadcast via GSM/GPRS directly to registered disaster management operators and emergency services.
3. **Cloud Telemetry & Rapid Remote Command:** Real-time bi-directional telemetry and authenticated operator override via Supabase and low-latency MQTT message broker protocols.
4. **Predictive Hydrological Machine Learning Server:** An external ML microservice leveraging Long Short-Term Memory (LSTM) recurrent neural networks for 1-hour ahead water-level forecasting, Autoencoder reconstruction for sensor anomaly detection, and Random Forest risk classification.
5. **Role-Segregated Mobile Client Applications:** Two purpose-built mobile applications developed on React Native / Expo: a public read-only disaster portal (login-free) and an authenticated, audited operator command interface.

---

## 2. Literature Review & Research Gap

### 2.1 Summary of Literature
- **Weerasinghe et al. (2022) [1]:** Explored essential operational characteristics for early warning systems (EWS) to minimize dam break risks in Sri Lankan river basins. While they established design criteria and safety governance frameworks, their work did not produce a functional hardware automation prototype.
- **Sasikala et al. (2022) [2]:** Developed an IoT-based reservoir water level monitoring framework. Their implementation successfully acquired real-time ultrasonic telemetry but relied entirely on manual gate interventions and lacked automated multi-tier public warning protocols.
- **Nirmal and Shekapure (2025) [3]:** Proposed an AI-driven intelligent dam management model for flood prevention using machine learning heuristics. However, their system assumed constant cloud connectivity and did not design an autonomous local fail-safe or a decoupled public/operator alert distribution pipeline.

### 2.2 Research Gap
Existing literature and field deployments exhibit critical structural deficiencies:
- **Coupling of Gate Control to Cloud Infrastructure:** Many automated architectures depend on remote cloud servers or AI pipelines to issue physical actuation commands. A cloud outage or loss of cellular data instantly immobilizes the dam.
- **Absence of Staged Warnings:** Conventional systems switch binary alerts (Normal vs. Evacuate), lacking progressive operational phases (such as pre-warning and clear-area alerts) that allow downstream communities to secure property before water discharge begins.
- **Single-Sensor Single-Point-of-Failure (SPOF):** Deployments frequently rely on a single ultrasonic or pressure transducer vulnerable to surface turbulence, acoustic drift, and debris obstruction.
- **Unified / Insecure App Architectures:** Mixing public informational views and critical physical actuator controls within a shared codebase creates grave security vulnerabilities.

---

## 3. Problem Definition & Research Questions

### 3.1 Problem Definition
In remote irrigation and flood-control reservoirs across developing regions, sluice gate operations rely on manual telephone chains and mechanical winches. Sudden inflows lead to overflow hazards or unannounced spillway discharges that inundate downstream settlements. The lack of acoustic temperature compensation in ultrasonic sensors causes measurement errors up to $\pm 10\text{ cm}$. Furthermore, lack of role segregation in mobile software exposes critical infrastructure to unauthorized actuation.

### 3.2 Research Questions (RQs)
1. **RQ1 (Sensing Resilience):** How can double ultrasonic sensing coupled with dynamic temperature acoustic compensation and dual-sensor voting guarantee water-level accuracy within $\pm 2.0\text{ cm}$ in harsh outdoor environments?
2. **RQ2 (Autonomous vs. Manual Safety Logic):** What hierarchical finite-state control architecture ensures that physical gate automation operates autonomously offline while allowing authenticated, rate-limited operator overrides that auto-revert upon timeout?
3. **RQ3 (Alert Latency & Throughput):** Can staged cellular SMS dispatch notify key emergency personnel within 30 seconds while meeting sub-2-second command latencies via MQTT?
4. **RQ4 (Secure Mobile Segregation):** How can a dual React Native / Expo application model ensure login-free, zero-PII public disaster visibility while enforcing strict Row Level Security (RLS) and cryptographic authentication for dam operators?
5. **RQ5 (Predictive ML Advisory Utility):** How effectively can an external LSTM and Autoencoder ML microservice forecast water levels 1 hour ahead and flag sensor anomalies without compromising real-time local controller determinism?

---

## 4. Goals, Aims, and Audited Objectives

### 4.1 System Aims
To design, fabricate, and experimentally validate an end-to-end, multi-tier Smart Dam Alert System prototype with automated sluice gate control, robust local fail-safe firmware, encrypted cloud synchronization, and predictive machine learning capabilities.

### 4.2 Specific Audited Objectives
1. **Hardware & Power Infrastructure:** Construct a 12V 5A power rail with dual XL4015 step-down converters (Buck #1 at 5.0V for actuators/sensors, Buck #2 at 4.0V dedicated to SIM800L), backed by a 3S 18650 Li-ion battery pack with BMS and diode-OR uninterruptible failover.
2. **Dual-Sensing & Acoustic Compensation:** Implement dual industrial JSN-SR04T waterproof ultrasonic sensors triggered alternately ($\ge 60\text{ ms}$ spacing) and compensated dynamically with DHT22 temperature data:
   $$v(T) = 331.4 + 0.606 \times T_{\text{DHT22}} \,(\text{m/s})$$
3. **Deterministic Firmware State Machine:** Program ESP32 firmware running an autonomous 4-stage alert state machine (NORMAL, PRE-WARNING, CLEAR AREA, DANGER) incorporating a **3% hysteresis deadband** to eliminate boundary oscillation, with gate states persisted to non-volatile flash (NVS).
4. **Decoupled Three-Tier Architecture:** Formulate the system into three strictly isolated pathways:
   - **Local Loop:** Sensors $\rightarrow$ ESP32 voting $\rightarrow$ MG996R servo gate $\rightarrow$ Buzzer $\rightarrow$ SIM800L SMS.
   - **Telemetry Path:** ESP32 $\rightarrow$ Wi-Fi $\rightarrow$ Supabase Edge Function & PostgreSQL.
   - **Command Path:** Operator App $\rightarrow$ Secure MQTT Broker $\rightarrow$ ESP32 verified execution ($< 2.0\text{ s}$ response).
5. **Predictive Machine Learning Microservice:** Develop a Python FastAPI service hosting an LSTM sequence forecaster, Autoencoder anomaly detector, and Random Forest risk classifier, consuming prototype telemetry and Open-Meteo precipitation data.
6. **Mobile Applications:** Deploy two React Native / Expo applications: Public Portal (login-free, read-only view) and Operator Console (Supabase Auth, manual gate override, staged SMS dispatch).

---

## 5. System Architecture & Corrected Pinout

### 5.1 Three Decoupled Information Paths

```
  +-----------------------------------------------------------------------------------------+
  |                           SDAS THREE-TIER DECOUPLED ARCHITECTURE                        |
  +-----------------------------------------------------------------------------------------+

      [ 1. LOCAL CLOSED-LOOP CONTROL (Zero Cloud Dependency) ]
      Dual JSN-SR04T + DHT22 ──> ESP32 Firmware Logic ──> MG996R Gate (0%, 30%, 50%)
                                        │               ──> Active Buzzer Siren (GPIO27)
                                        │               ──> RGB Alert LED (Active LOW)
                                        └──> SIM800L GSM ─> Staged SMS to Operators

      [ 2. TELEMETRY & REPORTING PATH ]
      ESP32 ──(Wi-Fi / WPA2)──> Supabase REST / Edge ──> PostgreSQL DB ──> Public App View
                                        │
                                        └──> FastAPI ML Microservice (LSTM / Autoencoder)

      [ 3. REAL-TIME COMMAND & CONTROL PATH ]
      Operator Mobile App ──(MQTT / TLS)──> HiveMQ / EMQX Broker ──> ESP32 Firmware
      (Auth Guarded, Timeout Watchdog)                               (Physical Override)
```

---

### 5.2 Corrected Hardware Pin Allocation

| ESP32 Pin | Function | Peripheral | Electrical Interface |
|---|---|---|---|
| **GPIO5** | Ultrasonic 1 TRIG | JSN-SR04T #1 | Via Level Converter Ch1 (LV1 $\rightarrow$ HV1 5V) |
| **GPIO19**| Ultrasonic 1 ECHO | JSN-SR04T #1 | Via Level Converter Ch2 (HV2 5V $\rightarrow$ LV2 3.3V) |
| **GPIO18**| Ultrasonic 2 TRIG | JSN-SR04T #2 | Via Level Converter Ch3 (LV3 $\rightarrow$ HV3 5V) |
| **GPIO21**| Ultrasonic 2 ECHO | JSN-SR04T #2 | Via Level Converter Ch4 (HV4 5V $\rightarrow$ LV4 3.3V) |
| **GPIO4** | Temperature / Humidity | DHT22 | 1-Wire with 10 kΩ pull-up to 3.3V |
| **GPIO32**| Red LED Cathode | Common Anode RGB | 220 Ω series resistor to 3.3V rail (Active LOW) |
| **GPIO33**| Green LED Cathode | Common Anode RGB | 100 Ω series resistor to 3.3V rail (Active LOW) |
| **GPIO13**| Blue LED Cathode | Common Anode RGB | 100 Ω series resistor to 3.3V rail (Active LOW) |
| **GPIO25**| Servo PWM Signal | TowerPro MG996R | 50 Hz PWM via 330 Ω series resistor |
| **GPIO27**| Buzzer Driver | 5V Active Buzzer | 1 kΩ to Base of BC547 NPN; 1N4007 clamp diode |
| **GPIO16**| Hardware UART2 RX2 | SIM800L TXD | Direct 2.8V $\rightarrow$ 3.3V digital input |
| **GPIO17**| Hardware UART2 TX2 | SIM800L RXD | 1 kΩ / 2.2 kΩ voltage divider (outputs 2.27V) |
| **GPIO23**| Hardware Modem RST | SIM800L RST | Active-LOW 100 ms reset line |
| **GPIO14**| Physical Button: OPEN | Push Button | Wired to GND, internal PULLUP, 20 ms debounce |
| **GPIO26**| Physical Button: CLOSE| Push Button | Wired to GND, internal PULLUP, 20 ms debounce |
| **GPIO22**| Physical Button: STOP | Push Button | Wired to GND, internal PULLUP, Emergency E-STOP |
| **GPIO34**| Rain Gauge (Optional) | Tipping Bucket | Input-only GPIO with external 10 kΩ pull-up |

---

## 6. Operational State Machine & Hysteresis Logic

The automated gate controller implements a four-stage flood alert finite-state machine (FSM). To prevent gate motor oscillation caused by water surface sloshing, a **3% downward hysteresis threshold** is enforced.

```
       Level >= 60%                      Level >= 80%                     Level >= 85%
  [ NORMAL ]  ───────>  [ PRE-WARNING ]  ───────>  [ CLEAR AREA ] ───────>  [ DANGER ]
  Gate: 0%               Gate: 0% (Hold)           Gate: 30% Open           Gate: 50% Open
  LED: Green             LED: Yellow               LED: Orange              LED: Red
  Buzzer: OFF            Buzzer: OFF               Buzzer: OFF              Buzzer: PULSING
  No SMS                 Manual App SMS            Auto "Clear" SMS         Auto Danger SMS
      │                       │                         │                         │
      │   Level < 57%         │     Level < 77%         │     Level < 82%         │
      └───────────────────────┴─────────────────────────┴─────────────────────────┘
                                   3% Hysteresis Step-Down
```

### Table 6.1: Audited Alert Matrix & Actuator States

| Alert State | Entry Threshold | Exit Threshold | Sluice Gate Position | RGB LED | Local Buzzer | Notification Protocol |
|:---|:---:|:---:|:---:|:---:|:---:|:---|
| **NORMAL** | $< 60\%$ | N/A | **0% (Closed)** | **Green** | Silent | Routine telemetry logging (5s interval). |
| **PRE-WARNING**| $\ge 60\%$ | $< 57\%$ | **0% (Closed)** | **Yellow** | Silent | Preserves reservoir water. Push notification to operator app; operator can trigger manual SMS broadcast. |
| **CLEAR AREA** | $\ge 80\%$ | $< 77\%$ | **30% (Servo $54^\circ$)** | **Orange** | Silent | Automated cellular SMS: *"CLEAR THE AREA: Sluice gate opening initiated."* |
| **DANGER** | $\ge 85\%$ | $< 82\%$ | **50% (Servo $90^\circ$)** | **Red** | **Continuous Pulsing Siren** | Automated critical cellular SMS to emergency services + high-priority mobile app alert. |

---

## 7. Machine Learning Strategy & Realistic Metrics

### 7.1 Microservice Architecture (FastAPI)
The machine learning component runs as an external inference microservice (`backend_ml`) rather than on the microcontroller. The ESP32 is responsible solely for high-speed, deterministic rule-based gate protection. The ML server ingests streaming telemetry alongside historical precipitation metrics retrieved from the **Open-Meteo Weather API** for the Puttalam catchment area ($8.03^\circ\text{N}, 79.83^\circ\text{E}$).

### 7.2 Models & Functional Scope
1. **LSTM Water-Level Forecaster:** Recurrent sequence model accepting a sliding window of the past 60 minutes of water levels and rainfall to forecast reservoir level $t+60\text{ min}$ ahead.
2. **Autoencoder Anomaly Detector:** Multi-layer neural network trained on normal reservoir inflow patterns. Computes reconstruction Mean Squared Error (MSE). Sensor noise, mechanical sticking, or ultrasonic deflection produces high reconstruction error ($\text{MSE} > \theta_{\text{threshold}}$), flagging a sensor anomaly within 5 seconds.
3. **Random Forest Classifier:** Multi-class classification serving as a cross-verification ensemble to categorise immediate flood hazard risk levels.

### 7.3 Realistic Evaluation Metrics (Post-Audit Rectification)
Previous proposal literature quoted unrealistic metrics (e.g., $99.93\%$ accuracy and single-figure MAPE near zero datum). The revised framework adopts rigorous, non-leaking evaluation standards:

| Metric Category | Target Value | Measurement Protocol |
|---|---|---|
| **Forecasting Accuracy (MAE)** | $\le 2.5\text{ cm}$ | Mean Absolute Error across 1-hour ahead continuous test horizons. |
| **Forecasting Accuracy (RMSE)**| $\le 3.8\text{ cm}$ | Root Mean Squared Error penalizing extreme deviations during rapid surge inflows. |
| **Forecasting Error (MAPE)** | $\le 4.5\%$ | Calculated only above 20% reservoir datum to prevent near-zero division distortion. |
| **Anomaly Detection Window** | $\le 5.0\text{ s}$ | Elapsed time from physical sensor drift induction to threshold MSE breach. |
| **False Alarm Rate (FAR)** | $\le 1.2\%$ | Evaluated per event window (5 consecutive anomalous windows required before alarm). |

---

## 8. Ethics, Data Governance & Security Architecture

1. **Cryptographic Protection of Contact PII:** Public and emergency personnel phone numbers stored in the Supabase PostgreSQL database are encrypted at rest using AES-GCM. Numbers are never exposed to public client applications.
2. **Role-Based Row Level Security (RLS):**
   - The `public_dam_status_view` view is open to unauthenticated anonymous queries (`anon` role), exposing only timestamp, level percentage, and alert state.
   - Actuator commands, contact lists, and manual override tables are strictly restricted to authenticated operators (`authenticated` role) with verified Supabase Auth tokens.
3. **Firmware Security:** The ESP32 firmware contains only a scoped, insert-only anon key for posting telemetry. The master `service_role` administrative key is never compiled into firmware binaries.
4. **Command Override Safety Timeout:** Remote operator commands expire after a 300-second watchdog window, automatically falling back to autonomous rule-based mode if operator connection is lost.

---

## 9. Deliverables & Resource Budget

### 9.1 Core Project Deliverables
- **Hardware Prototype:** Complete physical tank model with dual JSN-SR04T transducers, MG996R gate servo, 3S UPS power system, and SIM800L module.
- **Embedded C++ Firmware:** Fully modularized ESP32 firmware implementing FreeRTOS task scheduling, dual-sensor plausibility voting, 4-tier state machine, and fail-safe NVS memory recovery.
- **Cloud Database & Broker:** Supabase PostgreSQL database with RLS policies, views, triggers, and HiveMQ / EMQX MQTT broker bridge.
- **ML Inference Microservice:** Production-grade Python FastAPI backend with LSTM forecaster, Autoencoder anomaly detector, and Open-Meteo weather integration.
- **Dual Mobile Applications:** Public Informational App and Operator Command Console built with React Native / Expo.
- **Comprehensive Engineering Documentation:** Complete circuit schematics, bill of materials, calibration guidelines, and test logs.

---

## 10. References (IEEE Format with Full Dates)

1. L. N. K. Weerasinghe, M. Thayaparan, and T. Fernando, "Functional Characteristics of an Early Warning System to Minimise the Risk of Dam Breaks in Sri Lanka," in *Proc. 10th World Construction Symposium*, Colombo, Sri Lanka, Jun. 24–26, 2022, pp. 507–517. doi: 10.31705/WCS.2022.42.
2. G. Sasikala, S. Srinivasan, J. Navarajan, and M. M. Theresa, "IoT based Water Level Monitoring and Management in Reservoir," in *Proc. 2022 3rd Int. Conf. on Electronics and Sustainable Communication Systems (ICESC)*, Coimbatore, India, Aug. 17–19, 2022, pp. 1763–1767. doi: 10.1109/ICESC54411.2022.9885714.
3. B. Nirmal and S. Shekapure, "AI-Driven Smart Dam Management System for Enhanced Safety and Flood Prevention," *Journal of Mines, Metals and Fuels*, vol. 73, no. 7, pp. 2137–2145, Jul. 15, 2025. doi: 10.18311/jmmf/2025/49125.
4. Espressif Systems, "ESP32 Technical Reference Manual," Version 5.1, Espressif Systems (Shanghai) Co., Ltd., Shanghai, China, Mar. 2024. [Online]. Available: https://www.espressif.com/en/support/documents/technical-documents
5. Arduino LLC, "Arduino IDE 2.0 Core Reference & Documentation," Arduino Project, Somerville, MA, USA, Jan. 2024. [Online]. Available: https://docs.arduino.cc
6. Supabase Inc., "Supabase Architecture and PostgreSQL Row Level Security Documentation," San Francisco, CA, USA, Feb. 2025. [Online]. Available: https://supabase.com/docs
7. Meta Platforms, "React Native Core Architecture Documentation," Menlo Park, CA, USA, Jan. 2025. [Online]. Available: https://reactnative.dev
8. 650 Industries Inc., "Expo Framework and SDK Documentation," Palo Alto, CA, USA, Feb. 2025. [Online]. Available: https://docs.expo.dev
9. Open-Meteo GmbH, "Open-Meteo Free Weather API Technical Reference," Berlin, Germany, Jan. 2025. [Online]. Available: https://open-meteo.com/en/docs
