# SDAS Power Architecture & Battery Backup System Engineering Design

## 1. Load Profile & Worst-Case Current Budget

A mission-critical dam safety node must operate without brownouts during concurrent peak loads (e.g. gate motor activation while transmitting an emergency SMS over GSM).

### 1.1 Individual Subsystem Current Consumption

| Component | Rail Voltage | Quiescent / Nominal | Peak / Transient Current | Worst-Case Operational Condition |
|:---|:---:|:---:|:---:|:---|
| **ESP32 MCU** | 5.0 V (VIN) | 80 mA | 240 mA | Wi-Fi Tx burst @ 802.11b +20 dBm |
| **Dual JSN-SR04T Sensors** | 5.0 V | 30 mA (total) | 60 mA | Active ultrasonic transducer excitation |
| **MG996R Servo Motor** | 5.0 V | 100 mA (idle) | **2,500 mA (2.5 A)** | Full torque actuation or gate mechanical stall |
| **5V Active Buzzer** | 5.0 V | 0 mA | 45 mA | Pulsing danger alarm siren |
| **DHT22 & Logic Converter**| 3.3 V | 2 mA | 5 mA | Active sampling |
| **RGB Status LED** | 3.3 V | 0 mA | 15 mA | DANGER / CLEAR AREA illumination |
| **SIM800L GSM Module** | 4.0 V | 20 mA (idle) | **2,000 mA (2.0 A)** | 2G TDMA transmission burst (217 Hz, 577 µs width) |

---

### 1.2 Mathematical Derivation of Peak Power & 12V Adapter Sizing

Let us calculate the total peak power required at the DC outputs:

1. **5.0 V Rail Peak Load ($P_{5\text{V}}$):**
   $$I_{5\text{V, peak}} = I_{\text{ESP32}} + I_{\text{Sensors}} + I_{\text{Servo}} + I_{\text{Buzzer}} = 0.24\text{A} + 0.06\text{A} + 2.50\text{A} + 0.045\text{A} \approx 2.85\text{ A}$$
   $$P_{5\text{V, peak}} = 5.0\text{ V} \times 2.85\text{ A} = 14.25\text{ W}$$

2. **4.0 V Rail Peak Load ($P_{4\text{V}}$):**
   $$I_{4\text{V, peak}} = 2.00\text{ A}$$
   $$P_{4\text{V, peak}} = 4.0\text{ V} \times 2.00\text{ A} = 8.00\text{ W}$$

3. **Total DC Load Power ($P_{\text{DC, total}}$):**
   $$P_{\text{DC, total}} = 14.25\text{ W} + 8.00\text{ W} = 22.25\text{ W}$$

4. **Accounting for Buck Converter Conversion Efficiency ($\eta \approx 82\%$ under surge):**
   $$P_{\text{input, 12V}} = \frac{P_{\text{DC, total}}}{\eta} = \frac{22.25\text{ W}}{0.82} \approx 27.13\text{ W}$$

5. **Current Drawn from 12V Supply:**
   $$I_{\text{in, 12V}} = \frac{27.13\text{ W}}{12.0\text{ V}} \approx 2.26\text{ A}$$

> **Why a 12V 3A adapter is inadequate:**  
> A 3A rated adapter operating at 2.26A load is at **75.3% of its absolute continuous capacity**. Low-cost commercial 3A adapters suffer up to 10% voltage droop under fast dynamic load steps ($di/dt > 10\text{ A/ms}$ from the servo motor). When the 12V input droops, the XL4015 buck converters can drop out of regulation, inducing an ESP32 brownout reset.  
> **Engineering Decision:** Deploying a **12V / 5A (60W) power supply** provides a **2.2x safety margin**, keeping the power supply running cool and ripple-free.

---

## 2. Uninterruptible Power Supply (UPS) & 3S Li-Ion Battery Architecture

Dams in Sri Lanka's Puttalam district face severe monsoon storms accompanied by local power grid blackouts. The SDAS node incorporates an integrated 3S Li-ion battery backup.

### 2.1 Battery Pack Specification
- **Configuration:** 3S2P (3 cells in series, 2 in parallel) using 18650 cylindrical cells (3.7V nominal, 2600 mAh each).
- **Nominal Voltage:** $3 \times 3.7\text{ V} = 11.1\text{ V}$.
- **Fully Charged Float Voltage:** $3 \times 4.2\text{ V} = 12.6\text{ V}$.
- **Cut-Off Discharge Voltage:** $3 \times 3.0\text{ V} = 9.0\text{ V}$.
- **Total Pack Capacity:** $2 \times 2600\text{ mAh} = 5,200\text{ mAh} = 5.2\text{ Ah}$.
- **Total Energy:** $11.1\text{ V} \times 5.2\text{ Ah} \approx 57.7\text{ Watt-hours (Wh)}$.

```
    [12V 5A Mains] ----> [Schottky / Ideal Diode 1] ----+
                                                        |
    [3S2P Battery] ----> [Schottky / Ideal Diode 2] ----+----> [5A Fuse] ---> [XL4015 Bucks]
    (11.1V - 12.6V)
```

### 2.2 Autonomy Runtime Calculation
In typical monitoring mode (average steady-state consumption):
- ESP32 (Wi-Fi connected): 100 mA @ 5V = 0.50 W
- JSN-SR04T dual sensors: 30 mA @ 5V = 0.15 W
- SIM800L standby: 20 mA @ 4V = 0.08 W
- Servo quiescent: 20 mA @ 5V = 0.10 W
- Indicator & conversion losses: ~0.35 W
- **Total Average Steady-State Power:** $\approx 1.18\text{ W}$

During emergency gate activation and staged SMS dispatch (intermittent):
- Average power rises to $\approx 3.5\text{ W}$.

**Calculated Offline Battery Autonomy:**
$$\text{Runtime}_{\text{Steady-State}} = \frac{57.7\text{ Wh} \times 0.85 (\text{usable depth of discharge})}{1.18\text{ W}} \approx \mathbf{41.5\text{ hours}}$$
$$\text{Runtime}_{\text{Heavy Emergency}} = \frac{57.7\text{ Wh} \times 0.85}{3.5\text{ W}} \approx \mathbf{14.0\text{ hours}}$$

Even under severe storm conditions with frequent gate position adjustments and SMS alerts, the node guarantees over **10 to 14 hours of continuous autonomous field operation**.

---

## 3. Thermal Management & Capacitor Placement

1. **XL4015 Heatsinking:**  
   The XL4015 switching regulator IC has a junction-to-case thermal resistance $\theta_{JC} \approx 5^\circ\text{C/W}$. With continuous servo and sensor draws, power dissipation $P_D \approx 1.5\text{W}$ elevates junction temperature. Anodized aluminum heatsinks ($14 \times 14 \times 6\text{ mm}$) with thermally conductive adhesive tape ($k \ge 1.5\text{ W/m}\cdot\text{K}$) are mounted to both modules.
2. **Capacitor C2 & C3 Positioning:**  
   - $C_2$ (1000 µF 16V) must be placed on the 5V terminal block directly adjacent to the MG996R servo power leads.  
   - $C_3$ (1000 µF 16V low-ESR) must be soldered directly across SIM800L VCC and GND pins with lead lengths $< 15\text{ mm}$. This provides instantaneous local charge storage during 2A GSM burst transmit pulses, keeping rail dip below 150 mV.
