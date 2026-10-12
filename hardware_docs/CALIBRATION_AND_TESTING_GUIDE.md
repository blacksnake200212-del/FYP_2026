# SDAS Hardware Calibration & 7-Stage Testing Verification Protocol

## 1. Prescribed Build Order & Verification Protocol

To prevent component damage and isolate hardware faults systematically, assembly and verification must follow this strict sequential order:

```
+-----------------------------------------------------------------------------------------+
|                               SEQUENTIAL BUILD & TEST PIPELINE                          |
+-----------------------------------------------------------------------------------------+

  [Stage 1] Power Board Trimming & Load Testing
      │
      ▼
  [Stage 2] ESP32 + Dual Ultrasonic Sensors + DHT22 Ruler Calibration (±2 cm)
      │
      ▼
  [Stage 3] MG996R Sluice Gate Mechanism & 100-Cycle Endurance Test
      │
      ▼
  [Stage 4] SIM800L AT Diagnostic, Hardware Reset & Staged SMS Transmission
      │
      ▼
  [Stage 5] Firmware Alert State Machine & Hysteresis Tank Simulation
      │
      ▼
  [Stage 6] Supabase Telemetry & MQTT Sub-2-Second Command Latency Benchmark
      │
      ▼
  [Stage 7] ML Inference Pipeline & Mobile App End-to-End Validation
```

---

## 2. Stage-by-Stage Verification Procedures

### Stage 1: Power Board Trimming & Load Testing
1. **Unconnected Output Verification:**  
   Connect 12V 5A adapter to the power input board. Turn ON $SW_{\text{PWR}}$. With no loads connected:
   - Probe Buck #1 output with digital multimeter (DMM). Adjust trim potentiometer until voltage reads **5.00 V ± 0.02 V**.
   - Probe Buck #2 output with DMM. Adjust trim potentiometer until voltage reads **4.00 V ± 0.02 V**.
2. **Transient Load Step Test:**  
   - Connect a 2.5 Ω 25W load resistor across Buck #1 (simulating 2.0A continuous servo load). Verify voltage remains within $4.92\text{V} - 5.05\text{V}$.
   - Connect a 2.2 Ω 25W load resistor across Buck #2 for 3 seconds (simulating 1.8A GSM burst). Verify voltage remains $> 3.80\text{V}$.
3. **Safety Isolation Check:**  
   Measure continuity between Buck #1 (+5V) and Buck #2 (+4V). **Resistance must read infinite (open circuit)**.

---

### Stage 2: Dual Ultrasonic Sensor Calibration (±2 cm Benchmark)
1. **Physical Setup:** Mount the dual JSN-SR04T transducers side-by-side ($8\text{ cm}$ center-to-center spacing) on a rigid perpendicular test rig overlooking a smooth wooden/water acoustic target.
2. **Temperature Compensation Check:**  
   DHT22 temperature $T$ is acquired. Firmware computes:
   $$v = 331.4 + 0.606 \times T \,(\text{m/s})$$
3. **Calibration Sweep:** Move the acoustic target at 10 cm increments from $30\text{ cm}$ to $120\text{ cm}$ measured against a precision steel ruler.
   - Record 20 pulses per distance for Sensor 1 and Sensor 2.
   - Sensor 1 and Sensor 2 must be triggered alternately at least $60\text{ ms}$ apart to eliminate acoustic reverberations.
   - Criteria: $\text{Absolute Error} \le \pm 2.0\text{ cm}$; Sensor delta $|d_1 - d_2| \le 1.5\text{ cm}$.

---

### Stage 3: MG996R Sluice Gate 100-Cycle Stress Test
1. **Mechanical Rig:** Attach the MG996R metal horn to the slide gate linkage.
2. **Automated Stress Routine:** Run an automated firmware test script cycling through:
   - $0^\circ$ (Closed, 0%) $\rightarrow$ hold 3s
   - $54^\circ$ (Clear Area, 30%) $\rightarrow$ hold 3s
   - $90^\circ$ (Danger, 50%) $\rightarrow$ hold 3s
   - $180^\circ$ (Full Emergency Flush, 100%) $\rightarrow$ hold 3s
   - Return to $0^\circ$ (Closed).
3. **Pass Criteria:**
   - Complete 100 consecutive cycles without gear slipping, mechanical stalling, or servo motor temperature exceeding $55^\circ\text{C}$.
   - Current draw during steady movement must not exceed $650\text{ mA}$.
   - NVS Flash recovery: Interrupt power during cycle 50, reapply power, and confirm firmware restores last known gate angle quietly without high-speed mechanical snapping.

---

### Stage 4: SIM800L Modem & SMS Dispatch Latency Benchmark
1. **Modem Registration Check:**
   - Verify SIM800L NET LED transitions from 1-second fast flash (searching) to 3-second periodic blink (registered on 2G network).
   - Verify AT command handshake over hardware UART2:
     ```
     AT -> OK
     AT+CPIN? -> +CPIN: READY
     AT+CSQ -> +CSQ: 18,0 (Signal quality acceptable)
     AT+CREG? -> +CREG: 0,1 or 0,5 (Registered on home/roaming network)
     ```
2. **Hardware Reset Verification:**
   - Pull GPIO23 LOW for 150 ms. Verify modem restarts and re-registers cleanly.
3. **Staged SMS Transmission Latency:**
   - Dispatch emergency test SMS (`"TEST SDAS ALERT"`) to 3 pre-registered operator numbers.
   - Measure transmission timestamp from command issue to delivery acknowledgment:
     - Expected latency: **3.5 to 7.0 seconds per SMS message**.
     - Broadcast batch to 3 primary operators completed within **< 25 seconds**.

---

### Stage 5: Full State Machine Tank Simulation & Hysteresis
1. **Controlled Water Fill Test:** Slowly fill the prototype acrylic tank while logging sensor readings, gate angle, RGB LED, and buzzer state:
   - Level $< 60\%$: Gate 0%, LED Green, Buzzer OFF.
   - Level $\ge 60\%$: State enters **PRE-WARNING**. Gate remains 0% (water conservation), LED turns Yellow. Push notification dispatched to operator app.
   - Level $\ge 80\%$: State enters **CLEAR AREA**. Gate automatically opens to 30% (Servo $54^\circ$), LED turns Orange. SMS alert dispatched.
   - Level $\ge 85\%$: State enters **DANGER**. Gate automatically opens to 50% (Servo $90^\circ$), LED turns Red. Active buzzer sounds pulsing siren pattern. Danger SMS broadcast dispatched.
2. **Hysteresis Verification (Draining Test):**
   - Drain water slowly:
     - DANGER must NOT exit until level drops below **82%** ($85\% - 3\%$).
     - CLEAR AREA must NOT exit until level drops below **77%** ($80\% - 3\%$).
     - PRE-WARNING must NOT exit until level drops below **57%** ($60\% - 3\%$).
   - This verifies the 3% hysteresis band prevents high-frequency relay/servo chatter around threshold boundaries.

---

### Stage 6: Cloud Telemetry & MQTT Response Benchmark
1. **Wi-Fi Telemetry Ingestion:**
   - ESP32 posts JSON telemetry payload to Supabase REST / Edge Function every 5 seconds.
   - Verify HTTP status `201 Created` with insert-only anon key.
2. **Sub-2-Second Remote Command Target:**
   - From Operator App / MQTT client, publish manual override command: `{"command": "OPEN_30", "operator_id": "OP_01", "timeout_sec": 300}`.
   - Measure time delta between MQTT message publish timestamp and ESP32 physical servo PWM execution.
   - Target benchmark: **Latency $< 1.2\text{ seconds}$** (easily beating the 2.0s proposal threshold).
