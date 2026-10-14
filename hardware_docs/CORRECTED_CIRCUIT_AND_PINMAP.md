# SDAS Corrected Hardware Blueprint & Engineering Specification
## Smart Dam Alert System with Automated Gate Control

**Document Revision:** 2.1 (HC-SR04 & MG90S Integration • RNT Standard)  
**Target Hardware:** ESP32-WROOM-32 (30-pin DevKit V1), Dual HC-SR04 Ultrasonic Sensors, MG90S Micro Metal-Gear Servo, SIM800L GSM/GPRS, DHT22 Sensor, 3S 18650 UPS.

---

## 1. Executive Summary of Circuit Audits & Critical Fault Rectifications

The original circuit diagram and proposal contained critical electronic and architectural faults that would have led to component destruction, modem brownouts, boot failure, or uncommanded gate movement. Below is the audited breakdown of all 11 critical issues and their exact engineering fixes.

| # | Fault in Original Design | Failure Mode / Consequence | Corrected Engineering Implementation |
|---|---------------------------|----------------------------|--------------------------------------|
| **1** | **UART Pins Swapped** | ESP32 GPIO16 is labeled TX2 and GPIO17 as RX2. On ESP32 hardware UART2, **GPIO16 is RX2** and **GPIO17 is TX2**. Inverted serial pins prevent AT command communication with SIM800L. | Wire **SIM800L TXD $\rightarrow$ ESP32 GPIO16 (RX2)** directly. Wire **ESP32 GPIO17 (TX2) $\rightarrow$ SIM800L RXD** through a voltage divider. |
| **2** | **5V and 4V Rails Tied Together** | A vertical line tied the +5V and +4V outputs. Connecting 5V directly to SIM800L will burn the baseband RF IC (maximum rated voltage 4.4V). | **Strictly separate Buck #1 (5.0V) and Buck #2 (4.0V)**. Only grounds are common. Buck #2 is trimmed with a precision DMM to **4.0V ± 0.05V** before connecting the SIM800L module. |
| **3** | **Buzzer Has No Driver** | GPIO27 connected directly to a 5V buzzer on a 4V rail wire. An ESP32 GPIO pin cannot source 30–50 mA at 5V; direct connection damages the GPIO silicon. | Use an **NPN transistor driver (BC547 / 2N2222)**: ESP32 GPIO27 $\rightarrow$ 1 kΩ base resistor $\rightarrow$ Base; Emitter to GND; Collector to Buzzer (−); Buzzer (+) to +5V rail. Install a **1N4007 flyback diode** antiparallel across the buzzer. |
| **4** | **SIM800L Serial Line Needs Protection** | SIM800L digital I/O operates at ~2.8V logic level. Direct 3.3V drive from ESP32 GPIO17 stresses the modem's internal clamp diodes. | Implement a **1 kΩ / 2.2 kΩ passive resistor divider** on the TX line: ESP32 GPIO17 $\rightarrow$ 1 kΩ $\rightarrow$ [Junction] $\rightarrow$ SIM800L RXD. From [Junction], place a 2.2 kΩ resistor to GND ($V_{RX} \approx 3.3 \times \frac{2.2}{1.0 + 2.2} \approx 2.27\text{ V}$). |
| **5** | **ESP32 3V3 Pin Not Drawn Connected** | DHT22, level shifter LV side, and RGB LED lacked an explicit, regulated 3.3V power feed. | Tie the ESP32 on-board LDO **3V3 pin** to: (1) DHT22 $V_{CC}$, (2) 10 kΩ pull-up $R_1$, (3) RGB LED common anode, and (4) 4-Channel Logic Level Converter **LV** reference pin. |
| **6** | **Pin Conflict on Manual Override Buttons** | Earlier diagrams placed manual push buttons on GPIO32 and GPIO33, which conflict with the RGB LED Red & Green channels. | Retain GPIO32 and GPIO33 for RGB LED. Relocate manual buttons: **OPEN $\rightarrow$ GPIO14**, **CLOSE $\rightarrow$ GPIO26**, **STOP $\rightarrow$ GPIO22**. Wire to GND using internal pull-up resistors and 20 ms software debounce. |
| **7** | **Lack of Input Protection** | Power transients, reverse battery hookup, or short circuits would instantly destroy both XL4015 buck converters and the ESP32. | Place a **5A fast-acting cartridge fuse**, a **10A Schottky diode (MBR1045)** or P-MOSFET reverse-polarity circuit, and a 1000 µF 25V low-ESR electrolytic capacitor ($C_1$) immediately after the 12V 5A adapter / switch. |
| **8** | **Power Supply Undersizing & High Surge Demands** | A 12V supply must withstand simultaneous MG90S servo stall surges (~750mA at 5V) and SIM800L 217 Hz GSM transmission bursts (2.0A at 4V). | Upgrade to **12V / 5A (60W) regulated DC adapter**. Add heatsinks to both XL4015 buck converters. Add battery backup (3S 18650 pack with BMS) with an automatic diode-OR switchover stage. |
| **9** | **Simultaneous USB and VIN Power Risk** | Plugging USB into the PC while the 12V buck feeds 5V into DevKit VIN creates diode back-feeding and ground loops that can destroy PC USB host controllers. | Operational rule: **Never connect USB and VIN simultaneously**. Provide a disconnect jumper on VIN or disconnect the 5V line before connecting USB programming cable. |
| **10** | **RGB LED Current Limiting Imbalance** | Equal 220 Ω resistors make Green and Blue dim because their forward voltage ($V_f \approx 3.0\text{V}$) is higher than Red ($V_f \approx 1.9\text{V}$). | Use **220 Ω for Red** ($I \approx 6.4\text{ mA}$) and **100 Ω for Green and Blue** ($I \approx 3.0\text{ mA}$ each), ensuring balanced luminosity across all 4 operational alert colors. |
| **11** | **SIM800L Hangs Unrecoverable** | In remote field deployments, GSM modems frequently latch up due to cell tower registration failures or brownouts. | Connect **ESP32 GPIO23 $\rightarrow$ SIM800L RST pin**. The firmware monitors modem heartbeat and executes a hard active-LOW 100 ms reset pulse if AT commands timeout. |

---

## 2. Final Audited System Pin Mapping

All pins have been selected to avoid ESP32 boot strapping pins (specifically avoiding GPIO12, GPIO0, GPIO2 strapping issues, and input-only restrictions on ADC2 during Wi-Fi operation).

| Function / Peripheral | ESP32 Pin | I/O Mode | Signal Level | Circuit Notes / Protection |
|-----------------------|-----------|----------|--------------|----------------------------|
| **Ultrasonic 1 TRIG** | **GPIO5** | OUTPUT | 3.3V $\rightarrow$ 5.0V | Routed via Level Converter Ch1 (LV1 $\rightarrow$ HV1) to HC-SR04 #1 |
| **Ultrasonic 1 ECHO** | **GPIO19** | INPUT | 5.0V $\rightarrow$ 3.3V | Routed via Level Converter Ch2 (HV2 $\rightarrow$ LV2) from HC-SR04 #1 |
| **Ultrasonic 2 TRIG** | **GPIO18** | OUTPUT | 3.3V $\rightarrow$ 5.0V | Routed via Level Converter Ch3 (LV3 $\rightarrow$ HV3) to HC-SR04 #2 |
| **Ultrasonic 2 ECHO** | **GPIO21** | INPUT | 5.0V $\rightarrow$ 3.3V | Routed via Level Converter Ch4 (HV4 $\rightarrow$ LV4) from HC-SR04 #2 |
| **DHT22 Data Line** | **GPIO4** | INPUT/OUTPUT | 3.3V | Dedicated 10 kΩ pull-up resistor $R_1$ to ESP32 3V3 rail |
| **RGB LED - Red** | **GPIO32** | OUTPUT | 3.3V (Active LOW) | Connected through 220 Ω resistor to Red cathode |
| **RGB LED - Green** | **GPIO33** | OUTPUT | 3.3V (Active LOW) | Connected through 100 Ω resistor to Green cathode |
| **RGB LED - Blue** | **GPIO13** | OUTPUT | 3.3V (Active LOW) | Connected through 100 Ω resistor to Blue cathode |
| **Servo PWM Signal** | **GPIO25** | OUTPUT (LEDC) | 3.3V PWM (50 Hz) | 330 Ω series resistor to MG90S signal line (absorbs ringing) |
| **Buzzer Driver** | **GPIO27** | OUTPUT | 3.3V | 1 kΩ to Base of BC547/2N2222; Emitter=GND, Collector=Buzzer (−) |
| **SIM800L RX2 (Receive)** | **GPIO16** | INPUT (UART2) | 2.8V $\rightarrow$ 3.3V | Connected directly to SIM800L TXD (reads 2.8V as valid logic HIGH) |
| **SIM800L TX2 (Transmit)**| **GPIO17** | OUTPUT (UART2) | 3.3V $\rightarrow$ 2.27V | 1 kΩ series + 2.2 kΩ shunt divider to GND before SIM800L RXD |
| **SIM800L Reset (RST)** | **GPIO23** | OUTPUT | 3.3V | Active-LOW hardware reset pulse to unfreeze modem |
| **Manual Button: OPEN** | **GPIO14** | INPUT_PULLUP | 3.3V $\rightarrow$ GND | Momentary push switch to GND, 20 ms debounced in firmware |
| **Manual Button: CLOSE**| **GPIO26** | INPUT_PULLUP | 3.3V $\rightarrow$ GND | Momentary push switch to GND, 20 ms debounced in firmware |
| **Manual Button: STOP** | **GPIO22** | INPUT_PULLUP | 3.3V $\rightarrow$ GND | Emergency E-STOP push switch to GND, highest priority interrupt |
| **Rain Gauge (Tipping)**| **GPIO34** | INPUT (Ext Pull-up) | 3.3V | Input-only GPIO. External 10 kΩ pull-up to 3.3V required |

> **Strapping Pin Warning:** GPIO12 must be left strictly floating/unconnected during boot, as pulling it HIGH forces the ESP32 internal flash LDO to 1.8V, permanently preventing boot.

---

## 3. Power Architecture & Rail Segregation

```
+-------------------------------------------------------------------------------------------------+
|                                    POWER ARCHITECTURE SCHEMATIC                                 |
+-------------------------------------------------------------------------------------------------+

  [ 12V 5A DC Adapter ] ----+
                            |     [ 5A Fuse ]   [ Reverse Schottky ]  [ SPST 5A ]
                            +------> [===] ---------> |--- ------------> [ / ] ----+
  [ 3S 18650 Battery Pack ] |                                                      |
    (11.1V - 12.6V, BMS)  --+                                                      |
                                                                                   +---> C1: 1000uF/25V
                                                                                   |
         +-------------------------------------------------------------------------+
         |                                                 |
         v                                                 v
  +--------------------------------+              +--------------------------------+
  |    BUCK CONVERTER #1 (XL4015)   |              |    BUCK CONVERTER #2 (XL4015)   |
  |     Stepped down to +5.0V      |              |     Stepped down to +4.0V      |
  +--------------------------------+              +--------------------------------+
         |                                                 |
         +---> C2: 1000uF/16V (Low ESR)                    +---> C3: 1000uF/16V (Low ESR)
         |                                                 |
         +--> ESP32 VIN (Pin 19)                           +--> SIM800L VCC Pin ONLY
         +--> MG90S Servo Power (+5V)                      |    (Peak 2A GSM burst sink)
         +--> 5V Active Buzzer (+)                         |
         +--> HC-SR04 Sensor #1 VCC                        |
         +--> HC-SR04 Sensor #2 VCC                        |
         +--> Level Converter HV Pin (5.0V)                |
                                                           |
  [ ESP32 On-Board 3.3V LDO ]                              |
         |                                                 |
         +--> Level Converter LV Pin (3.3V)                |
         +--> DHT22 VCC                                    |
         +--> R1 (10 kΩ) Pull-Up                           |
         +--> RGB LED Common Anode                         |
                                                           |
  [ COMMON GROUND BUS (GND) ] <----------------------------+-------------------------------+
   Tied to Adapter (-), Battery (-), Buck #1 GND, Buck #2 GND, ESP32 GND, All Sensor GNDs
```

### Power Rails Summary
1. **12.0 V Raw Bus:** Feeds Buck #1 and Buck #2 inputs through fuse and switch.
2. **5.0 V Actuator & Sensor Rail (Buck #1):** Sized for 5A peak current. Powers MG90S micro servo motor, both HC-SR04 ultrasonic distance sensors, the active buzzer, and level converter high side.
3. **4.0 V Dedicated GSM Rail (Buck #2):** Trimmed precisely to 4.00V. Connected **only** to SIM800L VCC with a 1000 µF low-ESR electrolytic capacitor physically mounted within 15 mm of the GSM module header.
4. **3.3 V Logic Rail (ESP32 On-board LDO):** Used solely for low-power digital logic: DHT22, level shifter low-side reference, RGB LED common anode, and pull-up resistors.

---

## 4. Subsystem Interfacing Details

### 4.1 Ultrasonic Water Level Sensing (Dual HC-SR04)
- **Sensor Selection:** The HC-SR04 4-pin ultrasonic distance sensor (VCC, TRIG, ECHO, GND) operates over a range of 2.0 cm to 400.0 cm with 0.3 cm resolution.
- **Blind Zone Mitigation:** Unlike industrial sensors that require 20–25 cm deadbands, the HC-SR04 has a tight physical blind zone of only **2.0 cm**. The sensor bracket is physically mounted **at 50.0 cm above the tank floor (providing 10.0 cm safety clearance over the 40.0 cm full crest line)**.
- **Extreme Flood Failsafe:** If water rises closer than 2.0 cm ($d < 2.0\text{ cm}$), the firmware clamps the reading to 100% full capacity (DANGER) rather than flagging a sensor fault, ensuring the automated spillway gate opens to 50% immediately.
- **Pulse Timing:** Uses standard 10 µs HIGH trigger pulse followed by echo pulse width measurement (timeout 30,000 µs $\approx$ 5 m).
- **Alternating Pulse Schedule:** To prevent acoustic cross-talk (multipath echo confusion), the ESP32 triggers Sensor 1 and Sensor 2 sequentially with a minimum **60 ms blanking interval** between bursts.
- **Speed-of-Sound Compensation:**
  $$\text{Speed of Sound } v(T) = 331.4 + (0.606 \times T_{\text{DHT22}}) \quad [\text{m/s}]$$
  $$\text{Distance } d = \frac{v(T) \times \Delta t_{\text{ECHO}}}{2}$$

### 4.2 Buzzer Driver & Flyback Protection
- **Transistor:** BC547 or 2N2222 NPN transistor.
- **Base Resistor:** 1 kΩ (limits base current to $I_B \approx \frac{3.3\text{V} - 0.7\text{V}}{1000\,\Omega} = 2.6\text{ mA}$, driving transistor into hard saturation with $h_{FE} > 50$).
- **Flyback Diode:** 1N4007 or 1N4148 antiparallel across the buzzer coil (Cathode to +5V, Anode to Collector) prevents inductive back-EMF voltage spikes from exceeding $V_{CE(\text{breakdown})}$.

### 4.3 Level Shifter Wiring Map
- **Module:** 4-Channel Bi-Directional MOSFET Level Converter (ML2029 / BSS138 based).
- **Power:** HV $\rightarrow$ 5.0V (from Buck #1), LV $\rightarrow$ 3.3V (from ESP32 3V3 pin), GND $\rightarrow$ Common GND.
- **Channel Allocation:**
  - Ch 1: ESP32 GPIO5 (LV1) $\longleftrightarrow$ Sensor 1 TRIG (HV1)
  - Ch 2: ESP32 GPIO19 (LV2) $\longleftrightarrow$ Sensor 1 ECHO (HV2)
  - Ch 3: ESP32 GPIO18 (LV3) $\longleftrightarrow$ Sensor 2 TRIG (HV3)
  - Ch 4: ESP32 GPIO21 (LV4) $\longleftrightarrow$ Sensor 2 ECHO (HV4)

### 4.4 RGB LED Current Balancing (Common Anode)
- Common Anode tied to **ESP32 3.3V rail**.
- Active-LOW control logic (`LOW` = ON, `HIGH` = OFF).
- **Red channel:** $V_f \approx 1.9\text{V} \implies R_{\text{Red}} = \frac{3.3\text{V} - 1.9\text{V}}{6.4\text{ mA}} \approx 220\,\Omega$.
- **Green channel:** $V_f \approx 3.0\text{V} \implies R_{\text{Green}} = \frac{3.3\text{V} - 3.0\text{V}}{3.0\text{ mA}} \approx 100\,\Omega$.
- **Blue channel:** $V_f \approx 3.0\text{V} \implies R_{\text{Blue}} = \frac{3.3\text{V} - 3.0\text{V}}{3.0\text{ mA}} \approx 100\,\Omega$.

---

## 5. Circuit Assembly Checklist & Bench Verification

1. **Unpowered Stage:** Inspect continuity of common ground across all boards. Confirm no continuity between +5V and +4V outputs.
2. **Buck Converter Trimming:** Before inserting ESP32, Servo, or SIM800L:
   - Apply 12V to input.
   - Adjust Buck #1 potentiometer until output reads **exactly 5.00V**.
   - Adjust Buck #2 potentiometer until output reads **exactly 4.00V**.
3. **Load Drop Test:** Place a 2.2 Ω 10W test resistor across Buck #2 (simulating ~1.8A burst) and verify voltage stays above 3.75V without ripple brownout.
4. **Firmware Flash:** Connect ESP32 to PC via USB **with 12V supply disconnected**. Flash firmware.
5. **System Integration:** Disconnect USB, reconnect 5V VIN from Buck #1, apply 12V mains. Verify RGB boot sequence and SIM800L LED 3-second network blink.
