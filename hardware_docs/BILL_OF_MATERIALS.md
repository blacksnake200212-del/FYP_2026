# SDAS Complete Bill of Materials (BOM)
## Smart Dam Alert System with Automated Gate Control

This document lists every electronic, electromechanical, power, and passive component required to build the corrected SDAS physical prototype node.

---

### 1. Active & Core Semiconductor Modules

| Item | Component | Specification / Model | Qty | Designator | Role & Technical Description |
|:---:|:---|:---|:---:|:---:|:---|
| 1 | Microcontroller | **ESP32 DevKit V1 (30-pin)** | 1 | U1 | Dual-core Tensilica Xtensa 32-bit LX6 @ 240MHz, 520KB SRAM, Wi-Fi 802.11 b/g/n, BLE, 3x UARTs. Runs local control loop and telemetry. |
| 2 | Cellular GSM Modem | **SIM800L Module** | 1 | U2 | Quad-band 850/900/1800/1900 MHz GSM/GPRS. Used exclusively for staged SMS emergency broadcasting. 2.8V UART, 3.4V–4.4V supply. |
| 3 | Waterproof Ultrasonic Sensor | **JSN-SR04T-2.0** | 2 | S1, S2 | Waterproof ultrasonic transducer + board. Operating voltage 5V, range 25cm–450cm, resolution 0.5cm. Primary water level sensing. |
| 4 | Temp & Humidity Sensor | **DHT22 (AM2302)** | 1 | S3 | Digital single-bus sensor. Operating voltage 3.3V–5V, temp range -40°C to +80°C (±0.5°C). Used for speed-of-sound acoustic compensation. |
| 5 | DC-DC Step-Down Buck Converter | **XL4015 5A Buck Module** | 2 | BUCK1, BUCK2 | Constant Voltage / Constant Current buck. Input 8–36V, adjustable output 1.25–32V, max current 5A. (BUCK1 = 5.0V, BUCK2 = 4.0V). |
| 6 | Logic Level Converter | **ML2029 / BSS138 4-Ch** | 1 | U3 | 4-Channel Bi-directional MOSFET converter. High side (HV) = 5.0V, Low side (LV) = 3.3V. Bridges ESP32 GPIOs and JSN-SR04T 5V I/O. |
| 7 | High-Torque Servo Motor | **TowerPro MG996R** | 1 | M1 | Metal gear servo. Operating voltage 4.8V–6.6V, stall torque 11 kg·cm at 4.8V, PWM 50Hz (500µs–2500µs pulse width). Controls dam sluice gate. |
| 8 | BJT Switching Transistor | **BC547 or 2N2222 (NPN)** | 1 | Q1 | TO-92 package, $V_{CEO} = 45\text{V}$, $I_C = 100\text{mA}$ (BC547) or $800\text{mA}$ (2N2222). Drives the 5V high-decibel alert buzzer. |
| 9 | Rectifier / Flyback Diode | **1N4007** | 1 | D1 | 1000V 1A general purpose diode. Connected antiparallel across buzzer terminals to clamp inductive voltage spikes. |
| 10 | Reverse Polarity Schottky Diode | **MBR1045 or SS54** | 1 | D2 | 45V 10A Schottky diode (or P-channel MOSFET). Installed at 12V DC input to block accidental reverse voltage connection. |

---

### 2. Passives, Indicators & Mechanical Hardware

| Item | Component | Specification | Qty | Designator | Role & Technical Description |
|:---:|:---|:---|:---:|:---:|:---|
| 11 | RGB LED Module | **Common Anode (4-pin)** | 1 | LED1 | 3-color full spectrum LED. Anode connected to 3.3V rail. Active-low cathode drive for 4 distinct alert states. |
| 12 | Current Limiting Resistor | **220 Ω, 0.25W, 5%** | 1 | R_RED | Red LED current limiter ($I \approx 6.4\text{ mA}$). |
| 13 | Current Limiting Resistors | **100 Ω, 0.25W, 5%** | 2 | R_GRN, R_BLU | Green & Blue LED current limiters ($I \approx 3.0\text{ mA}$ each). Balanced lumen output. |
| 14 | Pull-Up Resistor | **10 kΩ, 0.25W, 5%** | 1 | R1 | Pull-up on DHT22 bidirectional single-bus data line (GPIO4 to 3.3V). |
| 15 | Transistor Base Resistor | **1.0 kΩ, 0.25W, 5%** | 1 | R_BASE | Current limiter from ESP32 GPIO27 to Base of Q1 transistor ($I_B \approx 2.6\text{ mA}$). |
| 16 | Serial Divider Series Resistor | **1.0 kΩ, 0.25W, 5%** | 1 | R_TX1 | Upper branch of voltage divider from ESP32 GPIO17 (TX2) to SIM800L RXD. |
| 17 | Serial Divider Shunt Resistor | **2.2 kΩ, 0.25W, 5%** | 1 | R_TX2 | Lower branch of voltage divider from SIM800L RXD junction to GND (outputs 2.27V). |
| 18 | Servo Ringing Suppressor | **330 Ω, 0.25W, 5%** | 1 | R_SERVO | Series damping resistor between ESP32 GPIO25 and MG996R PWM signal line. |
| 19 | Input Filter Capacitor | **1000 µF, 25V Electrolytic** | 1 | C1 | Low-ESR bulk decoupling capacitor placed on 12V bus after the main power switch. |
| 20 | 5V Rail Decoupling Capacitor | **1000 µF, 16V Electrolytic** | 1 | C2 | Low-ESR buffer capacitor across Buck #1 5V output to absorb MG996R servo motor start surges. |
| 21 | GSM Burst Buffer Capacitor | **1000 µF, 16V Low-ESR** | 1 | C3 | Placed right at SIM800L VCC and GND pins. Suppresses 2A / 217Hz transmission dropouts. |
| 22 | Active Buzzer | **5V DC Active Buzzer** | 1 | BZ1 | 85 dB @ 10cm, resonant frequency 2.3 kHz. Generates audible hazard warnings. |
| 23 | Manual Push Buttons | **Tactile Momentary Switches**| 3 | SW1, SW2, SW3| Panel mount momentary buttons (OPEN on GPIO14, CLOSE on GPIO26, STOP on GPIO22). |
| 24 | Power Input Cartridge Fuse | **5A Fast-Blow (5x20mm)** | 1 | F1 | Overcurrent protection against short-circuit on raw 12V DC power bus. |
| 25 | Fuse Holder | **5x20mm In-line or Panel** | 1 | FH1 | Heavy-duty fuse holder rated for minimum 250V 10A. |
| 26 | Main Power Switch | **SPST Toggle / Rocker** | 1 | SW_PWR | Panel mount single-pole single-throw switch rated $\ge 5\text{A}$ at 12V DC. |
| 27 | DC Jack Female Socket | **5.5 x 2.1 mm Barrel Jack** | 1 | J1 | Panel mount screw-terminal DC power socket for 12V input. |

---

### 3. Power Supply & Backup Subsystem

| Item | Component | Specification | Qty | Role & Technical Description |
|:---:|:---|:---|:---:|:---|
| 28 | AC/DC Mains Power Adapter | **12V DC, 5A (60W)** | 1 | Primary regulated desktop power supply (input 100–240V AC 50/60Hz). |
| 29 | Li-Ion Battery Pack | **3S 18650 Pack (11.1V / 5.2Ah)**| 1 | 3S2P configuration using Samsung/LG 2600mAh cells. Provides ~10 hours offline autonomy. |
| 30 | Battery Management System | **3S 20A Li-ion BMS Board** | 1 | Over-charge (4.25V/cell), over-discharge (2.7V/cell), and short-circuit protection. |
| 31 | UPS Diode-OR Stage | **Ideal Diode Module or Dual Schottky**| 1 | Zero-drop automatic transfer switch between 12V mains and 3S battery pack. |
| 32 | Heatsinks | **Anodized Aluminum 14x14x6mm** | 2 | Affixed with thermal tape to XL4015 ICs to maintain operating temperature $< 65^\circ\text{C}$. |

---

### 4. Mechanical & Mounting Rig

- Prototype water tank: Acrylic reservoir column ($60\text{ cm height} \times 25\text{ cm diameter}$).
- Sluice gate model: Precision laser-cut 3mm acrylic slide gate connected to MG996R horn via aluminum tie rod.
- Sensor mounting bracket: 3D-printed PETG bracket securing dual JSN-SR04T transducers $35\text{ cm}$ above maximum spillway waterline.
- Standoffs, screw terminal blocks, and 22 AWG stranded silicone hookup wires.
