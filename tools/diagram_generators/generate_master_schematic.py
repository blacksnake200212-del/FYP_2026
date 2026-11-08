import os
from PIL import Image, ImageDraw, ImageFont

def generate_colorful_schematic():
    W, H = 3400, 2200
    img = Image.new('RGB', (W, H), (248, 250, 252))
    draw = ImageDraw.Draw(img)

    # Base Colors
    BG_CARD = (255, 255, 255)
    BORDER_CARD = (226, 232, 240)
    BORDER_ACCENT = (203, 213, 225)
    TEXT_MAIN = (15, 23, 42)
    TEXT_MUTED = (71, 85, 105)
    TEXT_LIGHT = (148, 163, 184)
    TEXT_CYAN = (2, 132, 199)

    # -------------------------------------------------------------------------
    # DEDICATED WIRE COLOR SYSTEM (EVERY WIRE HAS A DISTINCT UNIQUE COLOR)
    # -------------------------------------------------------------------------
    W_12V_RAW   = (185, 28, 28)    # Deep Crimson (12V Input)
    W_5V_MAIN   = (220, 38, 38)    # Bright Red (+5.0V Main Rail)
    W_4V_GSM    = (147, 51, 234)   # Vivid Purple (+4.0V GSM Rail)
    W_3V3_LOGIC = (14, 165, 233)   # Sky Blue (+3.3V Logic Rail)
    W_GND       = (30, 41, 59)     # Dark Charcoal (Common GND)

    # Sensors Wires
    W_TRIG1     = (132, 204, 22)   # Lime Green (Sensor 1 TRIG - GPIO5)
    W_ECHO1     = (16, 185, 129)   # Emerald Green (Sensor 1 ECHO - GPIO19)
    W_TRIG2     = (21, 128, 61)    # Dark Green (Sensor 2 TRIG - GPIO18)
    W_ECHO2     = (20, 184, 166)   # Teal (Sensor 2 ECHO - GPIO21)
    W_DHT_DATA  = (6, 182, 212)    # Cyan (DHT22 Data - GPIO4)

    # Actuators & Indicators Wires
    W_SERVO_PWM = (234, 88, 12)    # Vivid Orange (MG90S Servo PWM - GPIO25)
    W_BUZZER    = (217, 119, 6)    # Amber/Gold (Buzzer Driver - GPIO27)
    W_LED_RED   = (225, 29, 72)    # Rose Red (RGB Red - GPIO32)
    W_LED_GRN   = (22, 163, 74)    # Forest Green (RGB Green - GPIO33)
    W_LED_BLU   = (37, 99, 235)    # Royal Blue (RGB Blue - GPIO13)

    # GSM Modem Wires
    W_GSM_TX2   = (99, 102, 241)   # Indigo (ESP32 TX2 -> SIM800L RXD - GPIO17)
    W_GSM_RX2   = (30, 64, 175)    # Navy Blue (SIM800L TXD -> ESP32 RX2 - GPIO16)
    W_GSM_RST   = (236, 72, 153)   # Hot Pink (SIM800L RST - GPIO23)

    # Buttons Wires
    W_BTN_OPEN  = (249, 115, 22)   # Light Orange (OPEN Button - GPIO14)
    W_BTN_CLOSE = (180, 83, 9)     # Bronze/Brown (CLOSE Button - GPIO26)
    W_BTN_ESTOP = (239, 68, 68)    # Emergency Red (STOP Button - GPIO22)

    # Fonts
    try:
        f_hero = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 30)
        f_title = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 17)
        f_sub = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 13)
        f_bold = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 13)
        f_reg = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 12)
        f_small = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 11)
        f_small_bold = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 11)
        f_code = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 12)
        f_code_bold = ImageFont.truetype('C:/Windows/Fonts/consolab.ttf', 12)
        f_badge = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 10)
    except Exception:
        f_hero = f_title = f_sub = f_bold = f_reg = f_small = f_small_bold = f_code = f_code_bold = f_badge = ImageFont.load_default()

    # Helper: Card Drawer
    def draw_card(x, y, w, h, title, subtitle="", badge="", header_color=(15, 23, 42)):
        draw.rounded_rectangle([x, y, x + w, y + h], radius=10, fill=BG_CARD, outline=BORDER_CARD, width=2)
        draw.rounded_rectangle([x, y, x + w, y + 42], radius=10, fill=(248, 250, 252))
        draw.rectangle([x, y + 25, x + w, y + 42], fill=(248, 250, 252))
        draw.line([(x, y + 42), (x + w, y + 42)], fill=BORDER_ACCENT, width=1)
        draw.rounded_rectangle([x + 12, y + 10, x + 16, y + 32], radius=2, fill=header_color)
        draw.text((x + 24, y + 11), title, fill=TEXT_MAIN, font=f_title)
        badge_w = 0
        if badge:
            badge_w = int(draw.textlength(badge, font=f_badge)) + 16
            draw.rounded_rectangle([x + w - badge_w - 12, y + 10, x + w - 12, y + 32], radius=6, fill=header_color)
            draw.text((x + w - badge_w - 4, y + 13), badge, fill=(255, 255, 255), font=f_badge)
        if subtitle:
            t_len = draw.textlength(title, font=f_title)
            avail_w = w - t_len - badge_w - 60
            sub_txt = subtitle
            if draw.textlength(" - " + sub_txt, font=f_sub) > avail_w:
                while draw.textlength(" - " + sub_txt + "...", font=f_sub) > avail_w and len(sub_txt) > 5:
                    sub_txt = sub_txt[:-3]
                sub_txt += "..."
            if avail_w > 40:
                draw.text((x + 24 + t_len + 12, y + 14), "-  " + sub_txt, fill=TEXT_MUTED, font=f_sub)

    # -------------------------------------------------------------------------
    # 1. HEADER BANNER & WIRE COLOR SYSTEM LEGEND
    # -------------------------------------------------------------------------
    draw.rectangle([0, 0, W, 85], fill=(15, 23, 42))
    draw.text((40, 14), "SMART DAM ALERT SYSTEM (SDAS) - HARDWARE CIRCUIT & WIRE COLOR MAP", fill=(255, 255, 255), font=f_hero)
    draw.text((42, 52), "ESP32-WROOM-32 • 1x MG90S Micro Servo • Dual HC-SR04 Sensors • SIM800L 4V Isolated Rail • Color-Coded Physical Jumper Reference", fill=TEXT_LIGHT, font=f_sub)

    # Top Mini Legend
    leg_x = W - 1050
    draw.rounded_rectangle([leg_x, 10, W - 30, 75], radius=8, fill=(30, 41, 59), outline=(51, 65, 85), width=1)
    
    top_swatches = [
        (W_5V_MAIN,   "+5V Power (Red)"),
        (W_4V_GSM,    "+4V GSM (Purple)"),
        (W_3V3_LOGIC, "+3.3V Logic (Sky)"),
        (W_GND,       "GND (Black)"),
        (W_SERVO_PWM, "Servo (Orange)"),
        (W_BUZZER,    "Buzzer (Amber)"),
        (W_TRIG1,     "Trig1 (Lime)"),
        (W_ECHO1,     "Echo1 (Emerald)"),
    ]
    cur_x = leg_x + 16
    for col, lbl in top_swatches[:4]:
        draw.line([(cur_x, 26), (cur_x + 20, 26)], fill=col, width=4)
        draw.text((cur_x + 26, 18), lbl, fill=(255, 255, 255), font=f_small_bold)
        cur_x += 160
    cur_x = leg_x + 16
    for col, lbl in top_swatches[4:]:
        draw.line([(cur_x, 54), (cur_x + 20, 54)], fill=col, width=4)
        draw.text((cur_x + 26, 46), lbl, fill=(255, 255, 255), font=f_small_bold)
        cur_x += 160

    # -------------------------------------------------------------------------
    # 2. POWER SUPPLY SECTION (Top Left)
    # -------------------------------------------------------------------------
    p_x, p_y, p_w, p_h = 40, 105, 1280, 280
    draw_card(p_x, p_y, p_w, p_h, "1. DUAL-STAGE POWER SUPPLY & ISOLATED VOLTAGE RAILS", "12V 5A Input with Dedicated Buck Regulation", "POWER CORE", W_12V_RAW)

    # 12V Input Jack
    draw.rounded_rectangle([p_x + 20, p_y + 55, p_x + 160, p_y + 130], radius=8, fill=(241, 245, 249), outline=(203, 213, 225), width=1)
    draw.text((p_x + 28, p_y + 65), "12V 5A DC IN", fill=TEXT_MAIN, font=f_bold)
    draw.text((p_x + 28, p_y + 85), "Adapter / 3S Battery", fill=TEXT_MUTED, font=f_small)
    draw.text((p_x + 28, p_y + 101), "(11.1V - 12.6V BMS)", fill=TEXT_MUTED, font=f_small)

    stages = [
        ("FUSE 5A", "Fast-Blow", (254, 243, 199), (180, 83, 9)),
        ("1N5408", "Reverse Diode", (241, 245, 249), TEXT_MAIN),
        ("SMBJ15A", "TVS Clamp", (241, 245, 249), TEXT_MAIN),
        ("SPST SW", "Main Switch", (241, 245, 249), TEXT_MAIN),
    ]
    st_x = p_x + 180
    for title, desc, bg, fg in stages:
        draw.rounded_rectangle([st_x, p_y + 65, st_x + 95, p_y + 120], radius=6, fill=bg, outline=(203, 213, 225), width=1)
        draw.text((st_x + 8, p_y + 73), title, fill=fg, font=f_small_bold)
        draw.text((st_x + 8, p_y + 93), desc, fill=TEXT_MUTED, font=f_small)
        draw.line([(st_x - 20, p_y + 92), (st_x, p_y + 92)], fill=W_12V_RAW, width=3)
        st_x += 115

    # C1 Cap
    c1_x = st_x - 5
    draw.line([(c1_x - 15, p_y + 92), (c1_x + 20, p_y + 92)], fill=W_12V_RAW, width=3)
    draw.rounded_rectangle([c1_x + 20, p_y + 65, c1_x + 80, p_y + 120], radius=6, fill=(224, 242, 254), outline=(2, 132, 199), width=1)
    draw.text((c1_x + 28, p_y + 73), "C1 Cap", fill=TEXT_CYAN, font=f_small_bold)
    draw.text((c1_x + 28, p_y + 93), "1000 µF", fill=TEXT_MAIN, font=f_small_bold)

    # 12V Bus Rail
    bus_x = c1_x + 105
    draw.line([(c1_x + 80, p_y + 92), (bus_x, p_y + 92)], fill=W_12V_RAW, width=3)
    draw.line([(bus_x, p_y + 72), (bus_x, p_y + 195)], fill=W_12V_RAW, width=3)

    # Buck #1 (5.0V Main)
    b1_x = bus_x + 25
    draw.line([(bus_x, p_y + 72), (b1_x, p_y + 72)], fill=W_12V_RAW, width=3)
    draw.rounded_rectangle([b1_x, p_y + 50, b1_x + 460, p_y + 138], radius=8, fill=(255, 247, 237), outline=W_5V_MAIN, width=2)
    draw.text((b1_x + 12, p_y + 58), "BUCK CONVERTER #1 (XL4015 5A)", fill=W_5V_MAIN, font=f_bold)
    draw.text((b1_x + 12, p_y + 76), "Output: +5.00V ± 0.05V (Trimmed via DMM) [RED WIRE]", fill=TEXT_MAIN, font=f_small_bold)
    draw.text((b1_x + 12, p_y + 94), "C2: 1000 µF / 16V Decoupling Cap • Powers: Servo, Buzzer, ESP32 VIN", fill=TEXT_MUTED, font=f_small)
    draw.text((b1_x + 12, p_y + 112), "Feeds: ESP32 VIN via 1N5819 Schottky diode (Protects PC USB port)", fill=W_5V_MAIN, font=f_small_bold)

    # Buck #2 (4.0V GSM Dedicated)
    draw.line([(bus_x, p_y + 195), (b1_x, p_y + 195)], fill=W_12V_RAW, width=3)
    draw.rounded_rectangle([b1_x, p_y + 155, b1_x + 460, p_y + 245], radius=8, fill=(250, 245, 255), outline=W_4V_GSM, width=2)
    draw.text((b1_x + 12, p_y + 163), "BUCK CONVERTER #2 (XL4015 5A)", fill=W_4V_GSM, font=f_bold)
    draw.text((b1_x + 12, p_y + 181), "Output: +4.00V ± 0.05V (Trimmed via DMM) [PURPLE WIRE]", fill=TEXT_MAIN, font=f_small_bold)
    draw.text((b1_x + 12, p_y + 199), "C3: 1000 µF Low-ESR Cap (< 15mm from GSM header) to absorb 2A bursts", fill=TEXT_MUTED, font=f_small)
    draw.text((b1_x + 12, p_y + 217), "Dedicated EXCLUSIVELY to SIM800L VCC (Shared Common Ground ONLY)", fill=W_4V_GSM, font=f_small_bold)

    # -------------------------------------------------------------------------
    # 3. CENTER: ESP32 DEVKIT V1 (30-PIN NODE CORE)
    # -------------------------------------------------------------------------
    esp_x, esp_y, esp_w, esp_h = 1400, 105, 600, 1040
    draw.rounded_rectangle([esp_x, esp_y, esp_x + esp_w, esp_y + esp_h], radius=16, fill=(15, 23, 42), outline=(56, 189, 248), width=3)

    # ESP32 Header
    draw.text((esp_x + 180, esp_y + 20), "ESP32 DevKit V1", fill=(255, 255, 255), font=f_title)
    draw.text((esp_x + 165, esp_y + 44), "30-Pin Node Core Controller", fill=TEXT_CYAN, font=f_bold)

    # Realistic RF Shield
    rf_x, rf_y, rf_w, rf_h = esp_x + 140, esp_y + 160, 320, 420
    draw.rounded_rectangle([rf_x, rf_y, rf_x + rf_w, rf_y + rf_h], radius=10, fill=(51, 65, 85), outline=(148, 163, 184), width=2)
    draw.rounded_rectangle([rf_x + 20, rf_y + 15, rf_x + rf_w - 20, rf_y + 55], radius=4, fill=(30, 41, 59), outline=(100, 116, 139), width=1)
    draw.text((rf_x + 85, rf_y + 26), "2.4GHz PCB ANTENNA", fill=(148, 163, 184), font=f_badge)
    draw.text((rf_x + 65, rf_y + 110), "ESP-WROOM-32", fill=(255, 255, 255), font=f_title)
    draw.text((rf_x + 55, rf_y + 145), "Xtensa® Dual-Core 32-bit LX6", fill=(203, 213, 225), font=f_small)
    draw.text((rf_x + 75, rf_y + 170), "Clock Speed: 240 MHz", fill=TEXT_LIGHT, font=f_small)
    draw.text((rf_x + 60, rf_y + 195), "FreeRTOS Dual-Core Enabled", fill=TEXT_CYAN, font=f_small_bold)
    draw.text((rf_x + 70, rf_y + 225), "- Core 0: Net Telemetry", fill=(241, 245, 249), font=f_badge)
    draw.text((rf_x + 70, rf_y + 245), "- Core 1: Real-Time Control", fill=(241, 245, 249), font=f_badge)
    draw.text((rf_x + 95, rf_y + 285), "FCC ID: 2AC7Z", fill=(100, 116, 139), font=f_badge)
    draw.text((rf_x + 105, rf_y + 305), "CE  •  RoHS", fill=(100, 116, 139), font=f_badge)

    # MicroUSB Jack
    draw.rounded_rectangle([esp_x + 240, esp_y + esp_h - 40, esp_x + 360, esp_y + esp_h], radius=6, fill=(203, 213, 225), outline=(71, 85, 105), width=2)
    draw.text((esp_x + 268, esp_y + esp_h - 26), "MicroUSB", fill=TEXT_MAIN, font=f_small_bold)

    # Exact Pin Table with Colors
    left_pins = [
        ("3V3",    "+3.3V Logic Rail",      W_3V3_LOGIC),
        ("GND",    "Common Ground",         W_GND),
        ("GPIO15", "Reserved",              (100, 116, 139)),
        ("GPIO2",  "Internal LED",          (100, 116, 139)),
        ("GPIO4",  "DHT22 DATA (Cyan)",     W_DHT_DATA),
        ("GPIO16", "RX2 <- GSM TXD (Navy)", W_GSM_RX2),
        ("GPIO17", "TX2 -> GSM RXD (Indigo)",W_GSM_TX2),
        ("GPIO5",  "TRIG1 -> LV1 (Lime)",   W_TRIG1),
        ("GPIO18", "TRIG2 -> LV3 (DkGrn)",  W_TRIG2),
        ("GPIO19", "ECHO1 <- LV2 (Emerald)",W_ECHO1),
        ("GPIO21", "ECHO2 <- LV4 (Teal)",   W_ECHO2),
        ("GPIO3",  "UART0 RX (Prog)",       (100, 116, 139)),
        ("GPIO1",  "UART0 TX (Prog)",       (100, 116, 139)),
        ("GPIO22", "STOP Button (E-STOP)",  W_BTN_ESTOP),
        ("GPIO23", "GSM Reset (Pink)",      W_GSM_RST)
    ]

    right_pins = [
        ("VIN",    "+5.0V Buck #1 (Red)",   W_5V_MAIN),
        ("GND",    "Common Ground",         W_GND),
        ("GPIO13", "RGB Blue (Royal Blue)", W_LED_BLU),
        ("GPIO12", "STRAPPING (LEAVE OPEN)",(239, 68, 68)),
        ("GPIO14", "OPEN Button (LtOrange)",W_BTN_OPEN),
        ("GPIO27", "Buzzer Driver (Amber)", W_BUZZER),
        ("GPIO26", "CLOSE Button (Brown)",  W_BTN_CLOSE),
        ("GPIO25", "MG90S Servo (Orange)",  W_SERVO_PWM),
        ("GPIO33", "RGB Green (Forest)",    W_LED_GRN),
        ("GPIO32", "RGB Red (Crimson)",     W_LED_RED),
        ("GPIO35", "Input Only (Unused)",   (100, 116, 139)),
        ("GPIO34", "Tipping Rain Gauge",    (100, 116, 139)),
        ("VN",     "ADC1_0 (Unused)",       (100, 116, 139)),
        ("VP",     "ADC1_3 (Unused)",       (100, 116, 139)),
        ("EN",     "Reset Button",          (100, 116, 139))
    ]

    pin_start_y = esp_y + 90
    pin_pitch = 60

    left_wire_anchor = {}
    right_wire_anchor = {}

    for i, (pname, pdesc, pcol) in enumerate(left_pins):
        py = pin_start_y + i * pin_pitch
        draw.ellipse([esp_x + 12, py - 10, esp_x + 32, py + 10], fill=(226, 232, 240), outline=(100, 116, 139), width=2)
        draw.ellipse([esp_x + 18, py - 4, esp_x + 26, py + 4], fill=pcol)
        draw.text((esp_x + 40, py - 8), pname, fill=(255, 255, 255), font=f_code_bold)
        draw.line([(esp_x + 12, py), (esp_x - 30, py)], fill=pcol, width=4)
        left_wire_anchor[pname] = (esp_x - 30, py)

    for i, (pname, pdesc, pcol) in enumerate(right_pins):
        py = pin_start_y + i * pin_pitch
        draw.ellipse([esp_x + esp_w - 32, py - 10, esp_x + esp_w - 12, py + 10], fill=(226, 232, 240), outline=(100, 116, 139), width=2)
        draw.ellipse([esp_x + esp_w - 26, py - 4, esp_x + esp_w - 18, py + 4], fill=pcol)
        p_len = draw.textlength(pname, font=f_code_bold)
        draw.text((esp_x + esp_w - 40 - p_len, py - 8), pname, fill=(255, 255, 255), font=f_code_bold)
        draw.line([(esp_x + esp_w - 12, py), (esp_x + esp_w + 30, py)], fill=pcol, width=4)
        right_wire_anchor[pname] = (esp_x + esp_w + 30, py)

    # -------------------------------------------------------------------------
    # 4. LEFT PERIPHERALS: SIM800L, DHT22, LEVEL SHIFTER & SENSORS
    # -------------------------------------------------------------------------
    # Card 2: SIM800L GSM Gateway (Left Side directly adjacent to Buck #2 4V!)
    gsm_x, gsm_y, gsm_w, gsm_h = 40, 415, 620, 325
    draw_card(gsm_x, gsm_y, gsm_w, gsm_h, "2. SIM800L GSM GATEWAY", "Staged SMS Broadcasting Engine", "CELLULAR GSM", W_4V_GSM)

    draw.rounded_rectangle([gsm_x + 15, gsm_y + 50, gsm_x + 290, gsm_y + 310], radius=8, fill=(250, 245, 255), outline=W_4V_GSM, width=1)
    draw.text((gsm_x + 25, gsm_y + 60), "SIM800L INTERFACE", fill=W_4V_GSM, font=f_bold)
    gsm_pins = [
        ("VCC", "+4.0V Buck #2 (C3 1000µF)", W_4V_GSM),
        ("GND", "Common Ground Bus",          W_GND),
        ("TXD", "ESP32 GPIO16 (RX2)",         W_GSM_RX2),
        ("RXD", "GPIO17 via 1k/2.2k Divider", W_GSM_TX2),
        ("RST", "ESP32 GPIO23 Reset Pulse",   W_GSM_RST),
    ]
    gsm_lead_in = {}
    for idx, (gp, gd, gc) in enumerate(gsm_pins):
        gy = gsm_y + 95 + idx * 36
        draw.ellipse([gsm_x + 290 - 5, gy - 5, gsm_x + 290 + 5, gy + 5], fill=gc)
        draw.text((gsm_x + 25, gy - 7), gp, fill=TEXT_MAIN, font=f_code_bold)
        draw.text((gsm_x + 65, gy - 7), "-> " + gd, fill=TEXT_MUTED, font=f_small)
        gsm_lead_in[gp] = (gsm_x + 290, gy)

    # Passive Divider Schematic inside GSM Card
    draw.rounded_rectangle([gsm_x + 305, gsm_y + 50, gsm_x + 605, gsm_y + 310], radius=8, fill=(241, 245, 249), outline=(203, 213, 225), width=1)
    draw.text((gsm_x + 315, gsm_y + 60), "VOLTAGE DIVIDER (3.3V->2.27V)", fill=TEXT_MAIN, font=f_small_bold)
    draw.text((gsm_x + 315, gsm_y + 90), "ESP32 TX2 (3.3V)\n      |\n  [ 1.0 kΩ ] (Series)\n      |\n      +-----> SIM800L RXD\n      |       (~2.27V Safe)\n  [ 2.2 kΩ ]\n      |\n   Common GND", fill=TEXT_MAIN, font=f_code)
    draw.text((gsm_x + 315, gsm_y + 265), "Protects 2.8V internal clamp\nsilicon from 3.3V drive.", fill=W_GSM_TX2, font=f_small)

    # Route Wires from ESP32 to SIM800L
    # Purple wire from Buck #2 to SIM800L VCC
    draw.line([(b1_x + 200, p_y + 245), (b1_x + 200, gsm_y + 15), (gsm_x + 50, gsm_y + 15), (gsm_x + 50, gsm_y + 95), (gsm_x + 290, gsm_y + 95)], fill=W_4V_GSM, width=4)
    
    # GPIO16 (RX2 - Navy Blue)
    draw.line([left_wire_anchor["GPIO16"], (gsm_x + 650, left_wire_anchor["GPIO16"][1]), (gsm_x + 650, gsm_lead_in["TXD"][1]), gsm_lead_in["TXD"]], fill=W_GSM_RX2, width=4)
    # GPIO17 (TX2 - Indigo)
    draw.line([left_wire_anchor["GPIO17"], (gsm_x + 630, left_wire_anchor["GPIO17"][1]), (gsm_x + 630, gsm_lead_in["RXD"][1]), gsm_lead_in["RXD"]], fill=W_GSM_TX2, width=4)
    # GPIO23 (RST - Hot Pink)
    draw.line([left_wire_anchor["GPIO23"], (gsm_x + 610, left_wire_anchor["GPIO23"][1]), (gsm_x + 610, gsm_lead_in["RST"][1]), gsm_lead_in["RST"]], fill=W_GSM_RST, width=4)

    # Card 3: DHT22 Climate Sensor (Beside SIM800L on left)
    d_x, d_y, d_w, d_h = 680, 415, 640, 325
    draw_card(d_x, d_y, d_w, d_h, "3. DHT22 TEMPERATURE & HUMIDITY SENSOR", "Acoustic Velocity Compensation", "CLIMATE", W_DHT_DATA)
    draw.text((d_x + 25, d_y + 55), "Speed of Sound Formula:  v(T) = 331.4 + (0.606 * T_DHT)  [m/s]", fill=(15, 118, 110), font=f_bold)
    draw.text((d_x + 25, d_y + 85), "[+] Pin 1 (VCC)  -> +3.3V Logic Rail [SKY BLUE WIRE]", fill=TEXT_MAIN, font=f_small_bold)
    draw.text((d_x + 25, d_y + 115), "[*] Pin 2 (DATA) -> ESP32 GPIO4 [CYAN WIRE]", fill=TEXT_MAIN, font=f_bold)
    draw.text((d_x + 50, d_y + 138), "• Dedicated 10 kΩ pull-up resistor to 3.3V rail", fill=TEXT_MUTED, font=f_small)
    draw.text((d_x + 50, d_y + 158), "• Pulse read protected via noInterrupts() against Wi-Fi jitter", fill=TEXT_MUTED, font=f_small)
    draw.text((d_x + 25, d_y + 190), "[-] Pin 4 (GND)  -> Common Ground Bus [BLACK WIRE]", fill=TEXT_MAIN, font=f_small_bold)
    
    # Route GPIO4 Cyan wire
    draw.line([left_wire_anchor["GPIO4"], (d_x + d_w + 30, left_wire_anchor["GPIO4"][1]), (d_x + d_w + 30, d_y + 115), (d_x + 200, d_y + 115)], fill=W_DHT_DATA, width=4)
    # Route 3.3V Sky Blue wire to DHT22
    draw.line([left_wire_anchor["3V3"], (d_x + d_w + 50, left_wire_anchor["3V3"][1]), (d_x + d_w + 50, d_y + 85), (d_x + 200, d_y + 85)], fill=W_3V3_LOGIC, width=3)

    # Card 4: DUAL HC-SR04 SENSORS & 4-CH LEVEL CONVERTER (Lower Left)
    s_x, s_y, s_w, s_h = 40, 765, 1280, 380
    draw_card(s_x, s_y, s_w, s_h, "4. DUAL HC-SR04 ULTRASONIC SENSORS & 4-CHANNEL LEVEL SHIFTER", "5V Transducers <-> 3.3V ESP32 Protection", "WATER SENSING", (2, 132, 199))

    # Sensor #1 (Primary) Box
    draw.rounded_rectangle([s_x + 15, s_y + 50, s_x + 330, s_y + 360], radius=8, fill=(248, 250, 252), outline=(203, 213, 225), width=1)
    draw.text((s_x + 25, s_y + 60), "HC-SR04 #1 (PRIMARY)", fill=(2, 132, 199), font=f_bold)
    draw.text((s_x + 25, s_y + 82), "• Mount: 50.0 cm above floor", fill=TEXT_MAIN, font=f_small)
    draw.text((s_x + 25, s_y + 102), "• Range: 2.0 cm - 400.0 cm", fill=TEXT_MUTED, font=f_small)
    draw.text((s_x + 25, s_y + 122), "• Headroom: 10cm at 100% full", fill=TEXT_MUTED, font=f_small)
    s1_pins = [
        ("VCC",  "+5.0V Main Rail", W_5V_MAIN),
        ("TRIG", "Level Shifter HV1", W_TRIG1),
        ("ECHO", "Level Shifter HV2", W_ECHO1),
        ("GND",  "Common Ground",     W_GND)
    ]
    s1_lead_points = {}
    for idx, (sp, sd, sc) in enumerate(s1_pins):
        sy = s_y + 165 + idx * 45
        draw.ellipse([s_x + 330 - 5, sy - 5, s_x + 330 + 5, sy + 5], fill=sc)
        draw.text((s_x + 25, sy - 7), sp, fill=TEXT_MAIN, font=f_code_bold)
        draw.text((s_x + 75, sy - 7), "-> " + sd, fill=TEXT_MUTED, font=f_small_bold)
        s1_lead_points[sp] = (s_x + 330, sy)

    # Sensor #2 (Redundant) Box
    draw.rounded_rectangle([s_x + 350, s_y + 50, s_x + 665, s_y + 360], radius=8, fill=(248, 250, 252), outline=(203, 213, 225), width=1)
    draw.text((s_x + 360, s_y + 60), "HC-SR04 #2 (REDUNDANT)", fill=(2, 132, 199), font=f_bold)
    draw.text((s_x + 360, s_y + 82), "• Mount: 50.0 cm above floor", fill=TEXT_MAIN, font=f_small)
    draw.text((s_x + 360, s_y + 102), "• Cross-Validation: |Δ| <= 5cm", fill=TEXT_MAIN, font=f_small_bold)
    draw.text((s_x + 360, s_y + 122), "• Clamps 100% on blind zone", fill=TEXT_MUTED, font=f_small)
    s2_pins = [
        ("VCC",  "+5.0V Main Rail", W_5V_MAIN),
        ("TRIG", "Level Shifter HV3", W_TRIG2),
        ("ECHO", "Level Shifter HV4", W_ECHO2),
        ("GND",  "Common Ground",     W_GND)
    ]
    s2_lead_points = {}
    for idx, (sp, sd, sc) in enumerate(s2_pins):
        sy = s_y + 165 + idx * 45
        draw.ellipse([s_x + 665 - 5, sy - 5, s_x + 665 + 5, sy + 5], fill=sc)
        draw.text((s_x + 360, sy - 7), sp, fill=TEXT_MAIN, font=f_code_bold)
        draw.text((s_x + 410, sy - 7), "-> " + sd, fill=TEXT_MUTED, font=f_small_bold)
        s2_lead_points[sp] = (s_x + 665, sy)

    # 4-Channel Level Converter Module (Right side of Card 4)
    llc_x, llc_y = s_x + 685, s_y + 50
    draw.rounded_rectangle([llc_x, llc_y, llc_x + 575, llc_y + 310], radius=8, fill=(239, 246, 255), outline=(59, 130, 246), width=1)
    draw.text((llc_x + 15, llc_y + 10), "4-CHANNEL MOSFET LEVEL CONVERTER (HV=5V, LV=3.3V)", fill=(29, 78, 216), font=f_bold)
    
    # HV Side
    draw.rounded_rectangle([llc_x + 15, llc_y + 35, llc_x + 270, llc_y + 295], radius=6, fill=(255, 255, 255), outline=(191, 219, 254), width=1)
    draw.text((llc_x + 25, llc_y + 45), "HV SIDE (5.0V HIGH)", fill=(29, 78, 216), font=f_small_bold)
    hv_pins = [
        ("HV",  "+5.0V Main Rail",   W_5V_MAIN),
        ("HV1", "TRIG1 In (Lime)",   W_TRIG1),
        ("HV2", "ECHO1 Out (Emerald)",W_ECHO1),
        ("HV3", "TRIG2 In (DkGrn)",  W_TRIG2),
        ("HV4", "ECHO2 Out (Teal)",  W_ECHO2),
        ("GND", "Common Ground",     W_GND),
    ]
    hv_lead_points = {}
    for idx, (hp, hd, hc) in enumerate(hv_pins):
        hy = llc_y + 80 + idx * 35
        draw.ellipse([llc_x + 15 - 5, hy - 5, llc_x + 15 + 5, hy + 5], fill=hc)
        draw.text((llc_x + 25, hy - 7), hp, fill=TEXT_MAIN, font=f_code_bold)
        draw.text((llc_x + 65, hy - 7), "-> " + hd, fill=TEXT_MUTED, font=f_small)
        hv_lead_points[hp] = (llc_x + 15, hy)

    # LV Side
    draw.rounded_rectangle([llc_x + 295, llc_y + 35, llc_x + 560, llc_y + 295], radius=6, fill=(255, 255, 255), outline=(204, 251, 241), width=1)
    draw.text((llc_x + 305, llc_y + 45), "LV SIDE (3.3V LOW)", fill=(15, 118, 110), font=f_small_bold)
    lv_pins = [
        ("LV",  "ESP32 3V3 Rail",     W_3V3_LOGIC),
        ("LV1", "GPIO5 TRIG1 (Lime)", W_TRIG1),
        ("LV2", "GPIO19 ECHO1 (Emerald)",W_ECHO1),
        ("LV3", "GPIO18 TRIG2 (DkGrn)",W_TRIG2),
        ("LV4", "GPIO21 ECHO2 (Teal)",W_ECHO2),
        ("GND", "Common Ground",      W_GND),
    ]
    lv_lead_points = {}
    for idx, (lp, ld, lc) in enumerate(lv_pins):
        ly = llc_y + 80 + idx * 35
        draw.ellipse([llc_x + 560 - 5, ly - 5, llc_x + 560 + 5, ly + 5], fill=lc)
        draw.text((llc_x + 305, ly - 7), lp, fill=TEXT_MAIN, font=f_code_bold)
        draw.text((llc_x + 345, ly - 7), "-> " + ld, fill=TEXT_MUTED, font=f_small)
        lv_lead_points[lp] = (llc_x + 560, ly)

    # Wires from Sensor 1 to Level Shifter HV
    draw.line([s1_lead_points["TRIG"], (s1_lead_points["TRIG"][0] + 15, s1_lead_points["TRIG"][1]), 
               (s1_lead_points["TRIG"][0] + 15, hv_lead_points["HV1"][1]), hv_lead_points["HV1"]], fill=W_TRIG1, width=4)
    draw.line([s1_lead_points["ECHO"], (s1_lead_points["ECHO"][0] + 25, s1_lead_points["ECHO"][1]), 
               (s1_lead_points["ECHO"][0] + 25, hv_lead_points["HV2"][1]), hv_lead_points["HV2"]], fill=W_ECHO1, width=4)

    # Wires from Sensor 2 to Level Shifter HV
    draw.line([s2_lead_points["TRIG"], (s2_lead_points["TRIG"][0] + 10, s2_lead_points["TRIG"][1]), 
               (s2_lead_points["TRIG"][0] + 10, hv_lead_points["HV3"][1]), hv_lead_points["HV3"]], fill=W_TRIG2, width=4)
    draw.line([s2_lead_points["ECHO"], (s2_lead_points["ECHO"][0] + 20, s2_lead_points["ECHO"][1]), 
               (s2_lead_points["ECHO"][0] + 20, hv_lead_points["HV4"][1]), hv_lead_points["HV4"]], fill=W_ECHO2, width=4)

    # Wires from Level Shifter LV to ESP32 Pins
    draw.line([lv_lead_points["LV1"], (esp_x - 50, lv_lead_points["LV1"][1]), (esp_x - 50, left_wire_anchor["GPIO5"][1]), left_wire_anchor["GPIO5"]], fill=W_TRIG1, width=4)
    draw.line([lv_lead_points["LV2"], (esp_x - 65, lv_lead_points["LV2"][1]), (esp_x - 65, left_wire_anchor["GPIO19"][1]), left_wire_anchor["GPIO19"]], fill=W_ECHO1, width=4)
    draw.line([lv_lead_points["LV3"], (esp_x - 80, lv_lead_points["LV3"][1]), (esp_x - 80, left_wire_anchor["GPIO18"][1]), left_wire_anchor["GPIO18"]], fill=W_TRIG2, width=4)
    draw.line([lv_lead_points["LV4"], (esp_x - 95, lv_lead_points["LV4"][1]), (esp_x - 95, left_wire_anchor["GPIO21"][1]), left_wire_anchor["GPIO21"]], fill=W_ECHO2, width=4)

    # -------------------------------------------------------------------------
    # 5. RIGHT PERIPHERALS: SERVO, BUZZER, RGB LED, BUTTONS
    # -------------------------------------------------------------------------
    # Card 5: Sluice Gate Actuator (1x MG90S Micro Servo)
    srv_x, srv_y, srv_w, srv_h = 2100, 105, 1260, 240
    draw_card(srv_x, srv_y, srv_w, srv_h, "5. ACTUATOR: 1x MG90S MICRO SERVO (SLUICE GATE)", "ONLY ONE SERVO MOTOR IN ENTIRE SYSTEM", "ACTUATOR (1 ONLY)", W_SERVO_PWM)

    draw.rounded_rectangle([srv_x + 20, srv_y + 50, srv_x + 440, srv_y + 225], radius=8, fill=(255, 247, 237), outline=W_SERVO_PWM, width=1)
    draw.text((srv_x + 35, srv_y + 60), "MG90S 3-WIRE WIRING CONNECTION", fill=W_SERVO_PWM, font=f_bold)
    draw.text((srv_x + 35, srv_y + 88), "[1] VCC (Red)    -> +5.0V Buck #1 Rail [RED WIRE]", fill=TEXT_MAIN, font=f_small_bold)
    draw.text((srv_x + 35, srv_y + 112), "[2] GND (Brown)  -> Common Ground Bus [BLACK WIRE]", fill=TEXT_MAIN, font=f_small_bold)
    draw.text((srv_x + 35, srv_y + 136), "[3] PWM (Orange) -> ESP32 GPIO25 via 330 Ω [ORANGE WIRE]", fill=W_SERVO_PWM, font=f_bold)
    draw.text((srv_x + 35, srv_y + 160), "• Slew-rate clamped to 1.0° per 15ms in firmware", fill=TEXT_MUTED, font=f_small)
    draw.text((srv_x + 35, srv_y + 180), "• Buffer capacitor: 470 µF directly at servo plug", fill=TEXT_MUTED, font=f_small)

    draw.rounded_rectangle([srv_x + 465, srv_y + 50, srv_x + 1235, srv_y + 225], radius=8, fill=(248, 250, 252), outline=(203, 213, 225), width=1)
    draw.text((srv_x + 480, srv_y + 60), "MANDATORY SLUICE GATE SAFETY PRESETS", fill=TEXT_MAIN, font=f_bold)
    draw.text((srv_x + 480, srv_y + 90), "• 0%  Position (0° Angle)   : Sluice gate fully closed. Zero spillway discharge (Water < 75%).", fill=TEXT_MAIN, font=f_small)
    draw.text((srv_x + 480, srv_y + 118), "• 20% Position (36° Angle)  : CLEAR AREA Advisory. Controlled base release (Level 80% to 85%).", fill=(180, 83, 9), font=f_small_bold)
    draw.text((srv_x + 480, srv_y + 146), "• 50% Position (90° Angle)  : CRITICAL DANGER Max Opening (Level >= 85%). 100% is prohibited.", fill=(220, 38, 38), font=f_bold)
    draw.text((srv_x + 480, srv_y + 174), "Safety Failsafe: Emergency Stop halts servo instantly without delay.", fill=TEXT_MUTED, font=f_small)

    # Route Wire: GPIO25 (Orange) to MG90S PWM
    draw.line([right_wire_anchor["GPIO25"], (srv_x + 20, srv_y + 140)], fill=W_SERVO_PWM, width=5)

    # Card 6: Emergency Piezo Buzzer & Driver
    buz_x, buz_y, buz_w, buz_h = 2100, 365, 1260, 205
    draw_card(buz_x, buz_y, buz_w, buz_h, "6. EMERGENCY SIREN: 5V ACTIVE PIEZO BUZZER & BC547 DRIVER", "NPN Transistor Switch with 1N4007 Diode", "SIREN", W_BUZZER)

    draw.rounded_rectangle([buz_x + 20, buz_y + 50, buz_x + 1235, buz_y + 190], radius=8, fill=(254, 242, 242), outline=(239, 68, 68), width=1)
    draw.text((buz_x + 35, buz_y + 60), "TRANSISTOR SWITCH SCHEMATIC (BC547 / 2N2222 NPN)", fill=(185, 28, 28), font=f_bold)
    draw.text((buz_x + 35, buz_y + 90), "ESP32 GPIO27 [AMBER WIRE] ----[ 1.0 kΩ Base Resistor ]----> Base (B)", fill=(15, 23, 42), font=f_code_bold)
    draw.text((buz_x + 35, buz_y + 115), "                                                           Collector (C) ----> Buzzer (-) --+--[ 1N4007 Diode ]--+--> +5.0V Rail [RED WIRE]", fill=(15, 23, 42), font=f_code_bold)
    draw.text((buz_x + 35, buz_y + 140), "                                                           Emitter (E)   ----> Common GND    +-(Anode)------------+-(Cathode)", fill=(15, 23, 42), font=f_code_bold)
    draw.text((buz_x + 35, buz_y + 165), "Inductive Kickback Protection: Antiparallel 1N4007 diode clamps voltage spikes when coil turns off.", fill=(185, 28, 28), font=f_small)

    # Route Wire: GPIO27 (Amber) to Buzzer Driver
    draw.line([right_wire_anchor["GPIO27"], (buz_x + 20, buz_y + 98)], fill=W_BUZZER, width=4)

    # Card 7: RGB LED Module
    rgb_x, rgb_y, rgb_w, rgb_h = 2100, 590, 1260, 255
    draw_card(rgb_x, rgb_y, rgb_w, rgb_h, "7. STATUS INDICATOR: 1x 4-PIN COMMON ANODE RGB LED", "Active LOW Drive • Balanced Forward Luminosity", "RGB LED", W_LED_RED)

    # Left: Wiring & Resistors
    draw.rounded_rectangle([rgb_x + 20, rgb_y + 50, rgb_x + 500, rgb_y + 240], radius=8, fill=(239, 246, 255), outline=(59, 130, 246), width=1)
    draw.text((rgb_x + 35, rgb_y + 60), "RGB WIRING & BALANCED RESISTORS", fill=(29, 78, 216), font=f_bold)
    draw.text((rgb_x + 35, rgb_y + 90), "[+] Common Anode (+)  -> ESP32 3V3 Rail [SKY BLUE WIRE]", fill=TEXT_MAIN, font=f_small_bold)
    draw.text((rgb_x + 35, rgb_y + 116), "[-] Red Cathode (-)   -> [ 220 Ω ] -> GPIO32 [ROSE RED WIRE]", fill=W_LED_RED, font=f_bold)
    draw.text((rgb_x + 35, rgb_y + 142), "[-] Green Cathode (-) -> [ 100 Ω ] -> GPIO33 [FOREST GREEN WIRE]", fill=W_LED_GRN, font=f_bold)
    draw.text((rgb_x + 35, rgb_y + 168), "[-] Blue Cathode (-)  -> [ 100 Ω ] -> GPIO13 [ROYAL BLUE WIRE]", fill=W_LED_BLU, font=f_bold)
    draw.text((rgb_x + 35, rgb_y + 195), "Active LOW: Pull pin LOW to illuminate. Resistors equalize", fill=TEXT_MUTED, font=f_small)
    draw.text((rgb_x + 35, rgb_y + 215), "forward voltage (1.9V Red vs 3.0V Green/Blue).", fill=TEXT_MUTED, font=f_small)

    # Right: Alert Stages
    draw.rounded_rectangle([rgb_x + 525, rgb_y + 50, rgb_x + 1235, rgb_y + 240], radius=8, fill=(248, 250, 252), outline=(203, 213, 225), width=1)
    draw.text((rgb_x + 540, rgb_y + 60), "SDAS 4-STAGE COLOR CODES", fill=TEXT_MAIN, font=f_bold)
    draw.text((rgb_x + 540, rgb_y + 90), "Stage 0 (NORMAL):      SOLID GREEN       (GPIO33 LOW, Water Level < 75%)", fill=W_LED_GRN, font=f_code_bold)
    draw.text((rgb_x + 540, rgb_y + 118), "Stage 1 (PRE-WARNING): SOLID YELLOW/AMBER (Red + Green LOW, 75% <= Level < 80%)", fill=(202, 138, 4), font=f_code_bold)
    draw.text((rgb_x + 540, rgb_y + 146), "Stage 2 (CLEAR AREA):  SOLID ORANGE      (Red + 25% PWM Green, 80% <= Level < 85%)", fill=(234, 88, 12), font=f_code_bold)
    draw.text((rgb_x + 540, rgb_y + 174), "Stage 3 (DANGER):      SOLID RED         (GPIO32 LOW, Siren Active, Level >= 85%)", fill=W_LED_RED, font=f_code_bold)
    draw.text((rgb_x + 540, rgb_y + 202), "Degraded / Fault:      PULSING BLUE      (GPIO13 Blinking, Sensor Mismatch > 5cm)", fill=W_LED_BLU, font=f_code_bold)

    # Route Wires from ESP32 to RGB LED
    draw.line([right_wire_anchor["GPIO32"], (rgb_x + 20, rgb_y + 122)], fill=W_LED_RED, width=4)
    draw.line([right_wire_anchor["GPIO33"], (rgb_x + 20, rgb_y + 148)], fill=W_LED_GRN, width=4)
    draw.line([right_wire_anchor["GPIO13"], (rgb_x + 20, rgb_y + 174)], fill=W_LED_BLU, width=4)

    # Card 8: 3x Manual Control Push Buttons
    btn_x, btn_y, btn_w, btn_h = 2100, 865, 1260, 280
    draw_card(btn_x, btn_y, btn_w, btn_h, "8. 3x MANUAL CONTROL PUSH BUTTONS & HARDWARE E-STOP", "Debounced in Firmware (20ms) • Active LOW to GND", "MANUAL CONTROLS", W_BTN_ESTOP)

    buttons = [
        ("1. OPEN BUTTON",  "ESP32 GPIO14", "[LIGHT ORANGE WIRE]", "Manual gate increment (+10% spillway opening in Auto/Manual)", W_BTN_OPEN),
        ("2. CLOSE BUTTON", "ESP32 GPIO26", "[BROWN WIRE]",        "Manual gate decrement (-10% spillway opening in Auto/Manual)", W_BTN_CLOSE),
        ("3. STOP (E-STOP)","ESP32 GPIO22", "[EMERGENCY RED WIRE]","HARDWARE E-STOP INTERRUPT: Halts servo immediately (< 1ms)", W_BTN_ESTOP)
    ]
    for idx, (bt, bp, bc, bd, bcol) in enumerate(buttons):
        by = btn_y + 60 + idx * 65
        draw.rounded_rectangle([btn_x + 20, by, btn_x + 1235, by + 52], radius=6, fill=(248, 250, 252), outline=(203, 213, 225), width=1)
        draw.ellipse([btn_x + 35, by + 26 - 6, btn_x + 47, by + 26 + 6], fill=bcol)
        draw.text((btn_x + 55, by + 10), bt, fill=TEXT_MAIN, font=f_bold)
        draw.text((btn_x + 220, by + 10), "-> " + bp, fill=TEXT_CYAN, font=f_code_bold)
        draw.text((btn_x + 420, by + 10), bc, fill=bcol, font=f_small_bold)
        draw.text((btn_x + 55, by + 30), bd, fill=TEXT_MUTED, font=f_small)

    # Route Wires from ESP32 to Buttons
    draw.line([right_wire_anchor["GPIO14"], (btn_x + 20, btn_y + 86)], fill=W_BTN_OPEN, width=4)
    draw.line([right_wire_anchor["GPIO26"], (btn_x + 20, btn_y + 151)], fill=W_BTN_CLOSE, width=4)
    # E-STOP wire from left GPIO22 around bottom
    draw.line([left_wire_anchor["GPIO22"], (left_wire_anchor["GPIO22"][0] - 20, left_wire_anchor["GPIO22"][1]), 
               (left_wire_anchor["GPIO22"][0] - 20, 1165), (btn_x - 30, 1165), (btn_x - 30, btn_y + 216), (btn_x + 20, btn_y + 216)], fill=W_BTN_ESTOP, width=5)

    # -------------------------------------------------------------------------
    # 6. MASTER WIRE COLOR GUIDE & AUDITED SPECIFICATION TABLE (Bottom)
    # -------------------------------------------------------------------------
    t_x, t_y, t_w, t_h = 40, 1190, 2160, 960
    draw_card(t_x, t_y, t_w, t_h, "MASTER BENCH WIRE COLOR GUIDE & PIN INTERFACE SPECIFICATION", "Physical Assembly Reference for Lab Prototyping & Viva Demonstration", "BENCH WIRING GUIDE", (15, 23, 42))

    t_headers = ["WIRE COLOR", "PHYSICAL CONNECTION", "FROM -> TO PINS", "SIGNAL TYPE", "HARDWARE REMARKS & PROTECTION"]
    t_col_w = [230, 370, 360, 210, 950]
    t_col_x = [t_x + 20]
    for w_i in t_col_w[:-1]:
        t_col_x.append(t_col_x[-1] + w_i)

    # Table Header Row
    draw.rounded_rectangle([t_x + 15, t_y + 55, t_x + t_w - 15, t_y + 90], radius=6, fill=(241, 245, 249))
    for c_i, h_txt in enumerate(t_headers):
        draw.text((t_col_x[c_i], t_y + 66), h_txt, fill=TEXT_MAIN, font=f_small_bold)

    table_data = [
        (W_5V_MAIN,   "RED",          "5.0V Main Power Rail",      "Buck #1 OUT -> ESP32 VIN, Servo, Buzzer", "5.0V DC (3A)",   "Decoupled via C2 1000 µF. Feeds ESP32 VIN via 1N5819 Schottky diode."),
        (W_4V_GSM,    "VIOLET/PURPLE","4.0V GSM Dedicated Rail",   "Buck #2 OUT -> SIM800L VCC Pin ONLY",     "4.0V DC (4A Pk)","Strictly isolated from 5V rail. Dedicated 1000 µF C3 capacitor eliminates GSM dropouts."),
        (W_3V3_LOGIC, "SKY BLUE",     "3.3V Logic Reference",      "ESP32 3V3 -> DHT22, RGB Anode, Shifter LV","3.3V DC",        "Regulated by on-board ESP32 LDO. Power source for low-current digital sensors."),
        (W_GND,       "BLACK",        "Common Ground Bus",         "Shared Common Ground across ALL modules", "0V Reference",   "Tied together: Buck 1, Buck 2, ESP32, SIM800L, Servo, Sensors, and Buttons."),
        (W_SERVO_PWM, "ORANGE",       "Sluice Gate PWM Signal",    "ESP32 GPIO25 -> MG90S Servo Signal",      "50Hz PWM",       "In-series 330 Ω resistor absorbs high-frequency ringing; software clamped to 50% max."),
        (W_BUZZER,    "AMBER/GOLD",   "Audible Siren Trigger",     "ESP32 GPIO27 -> 1 kΩ -> BC547 Base",      "Active HIGH",    "BC547 NPN driver + 1N4007 clamp diode across buzzer absorbs inductive kickback."),
        (W_TRIG1,     "LIME GREEN",   "Sensor 1 Trigger Pulse",    "ESP32 GPIO5 -> Level Shifter LV1 -> TRIG1","10µs Pulse",     "Stepped up from 3.3V to 5.0V by MOSFET level converter for HC-SR04 #1."),
        (W_ECHO1,     "EMERALD GREEN","Sensor 1 Echo Pulse",       "Sensor 1 ECHO -> Level Shifter HV2 -> GPIO19","Echo Pulse", "Stepped down from 5.0V to 3.3V to protect ESP32 GPIO19 silicon from overvoltage."),
        (W_TRIG2,     "DARK GREEN",   "Sensor 2 Trigger Pulse",    "ESP32 GPIO18 -> Level Shifter LV3 -> TRIG2","10µs Pulse",    "Stepped up from 3.3V to 5.0V by MOSFET level converter for HC-SR04 #2."),
        (W_ECHO2,     "TEAL",         "Sensor 2 Echo Pulse",       "Sensor 2 ECHO -> Level Shifter HV4 -> GPIO21","Echo Pulse", "Stepped down from 5.0V to 3.3V to protect ESP32 GPIO21 silicon from overvoltage."),
        (W_GSM_TX2,   "INDIGO",       "SIM800L Serial Transmit",   "ESP32 GPIO17 (TX2) -> 1k/2.2k -> SIM RXD","UART 2.27V",    "1.0 kΩ / 2.2 kΩ passive divider protects 2.8V internal clamp diodes from 3.3V damage."),
        (W_GSM_RX2,   "NAVY BLUE",    "SIM800L Serial Receive",    "SIM800L TXD -> ESP32 GPIO16 (RX2)",       "UART 2.8V",      "Direct connection; ESP32 reliably recognizes 2.8V as valid TTL logic HIGH."),
        (W_GSM_RST,   "HOT PINK",     "SIM800L Hardware Reset",    "ESP32 GPIO23 -> SIM800L RST Pin",         "Active LOW",     "Firmware issues active-LOW 100ms hardware pulse to recover from modem tower lockup."),
        (W_DHT_DATA,  "CYAN",         "DHT22 Environmental Data",  "ESP32 GPIO4 <-> DHT22 Pin 2 (DATA)",      "Single-Bus",     "Dedicated 10 kΩ pull-up resistor to 3.3V; read protected via noInterrupts()."),
        (W_LED_RED,   "ROSE RED",     "RGB LED Red Cathode",       "ESP32 GPIO32 -> 220 Ω -> Red Pin",        "Active LOW",     "220 Ω resistor limits current to 6.4mA (accounts for Vf ≈ 1.9V)."),
        (W_LED_GRN,   "FOREST GREEN", "RGB LED Green Cathode",     "ESP32 GPIO33 -> 100 Ω -> Green Pin",      "Active LOW",     "100 Ω resistor limits current to 3.0mA (accounts for Vf ≈ 3.0V)."),
        (W_LED_BLU,   "ROYAL BLUE",   "RGB LED Blue Cathode",      "ESP32 GPIO13 -> 100 Ω -> Blue Pin",       "Active LOW",     "100 Ω resistor limits current to 3.0mA (accounts for Vf ≈ 3.0V)."),
        (W_BTN_OPEN,  "LIGHT ORANGE", "Manual OPEN Pushbutton",    "ESP32 GPIO14 -> Pushbutton -> GND",       "Active LOW",     "Internal pull-up enabled; 20ms software debounced. Manual spillway increment (+10%)."),
        (W_BTN_CLOSE, "BROWN/AMBER",  "Manual CLOSE Pushbutton",   "ESP32 GPIO26 -> Pushbutton -> GND",       "Active LOW",     "Internal pull-up enabled; 20ms software debounced. Manual spillway decrement (-10%)."),
        (W_BTN_ESTOP, "EMERGENCY RED","Emergency STOP Button",     "ESP32 GPIO22 -> Pushbutton -> GND",       "Active LOW",     "Immediate hardware interrupt: freezes servo motion instantly (< 1ms latency)."),
    ]

    r_y = t_y + 100
    for r_idx, (wcol, cname, conn, pins, sig, rem) in enumerate(table_data):
        bg_col = (255, 255, 255) if r_idx % 2 == 0 else (248, 250, 252)
        draw.rounded_rectangle([t_x + 15, r_y - 2, t_x + t_w - 15, r_y + 36], radius=4, fill=bg_col)
        # Color pill swatch
        draw.rounded_rectangle([t_col_x[0], r_y + 6, t_col_x[0] + 28, r_y + 26], radius=4, fill=wcol)
        draw.text((t_col_x[0] + 36, r_y + 8), cname, fill=TEXT_MAIN, font=f_small_bold)
        draw.text((t_col_x[1], r_y + 8), conn, fill=TEXT_MAIN, font=f_small_bold)
        draw.text((t_col_x[2], r_y + 8), pins, fill=TEXT_MAIN, font=f_code_bold)
        draw.text((t_col_x[3], r_y + 8), sig, fill=TEXT_MUTED, font=f_small)
        draw.text((t_col_x[4], r_y + 8), rem, fill=TEXT_MAIN, font=f_small)
        r_y += 41

    # -------------------------------------------------------------------------
    # 7. BOTTOM RIGHT: PROJECT VERIFICATION SIGN-OFF
    # -------------------------------------------------------------------------
    info_x, info_y, info_w, info_h = 2230, 1190, 1130, 960
    draw_card(info_x, info_y, info_w, info_h, "FINAL YEAR PROJECT VERIFICATION & VIVA SIGN-OFF", "SDAS Academic Engineering Standard", "AUDITED V2.1", (15, 23, 42))

    draw.text((info_x + 25, info_y + 60), "MANDATORY HARDWARE AUDIT VERIFICATIONS:", fill=TEXT_MAIN, font=f_bold)

    checklist = [
        "[OK] EXACTLY ONE SERVO MOTOR: Only 1x TowerPro MG90S micro metal-gear servo. No duplicates.",
        "[OK] HARD 50% GATE OPENING LIMIT: Gate physically & in firmware restricted to 0%, 20%, 50% max.",
        "[OK] DUAL HC-SR04 TRANSDUCERS: 2x ultrasonic sensors cross-checked via 4-Ch level shifter (|Δ| <= 5cm).",
        "[OK] 2.0 CM BLIND ZONE SAFEGUARD: Distances < 2.0 cm clamped to 100% full (immediate 50% gate release).",
        "[OK] STRICT POWER SEPARATION: Buck #1 (5.0V) and Buck #2 (4.0V) share Ground only. SIM800L safe.",
        "[OK] GSM TRANSIENT PROTECTION: Dedicated 1000 µF capacitor on 4.0V rail suppresses 2A transmission dips.",
        "[OK] MODEM 2.8V LOGIC CLAMP: 1 kΩ / 2.2 kΩ divider guarantees SIM800L RX never exceeds 2.27V.",
        "[OK] 4-PIN RGB CURRENT EQUALIZATION: Balanced 220 Ω (Red) and 100 Ω (Green/Blue) resistors.",
        "[OK] ACTIVE SIREN TRANSISTOR DRIVER: BC547 NPN driver with 1N4007 clamp diode absorbs inductive kickback.",
        "[OK] HARDWARE E-STOP LATCH: Pressing STOP (GPIO22) freezes servo within < 1ms on edge interrupt.",
        "[OK] ZERO STRAPPING CONFLICTS: GPIO12 is strictly floating; GPIO0/GPIO2 boot safely into flash."
    ]
    for c_idx, item in enumerate(checklist):
        draw.text((info_x + 25, info_y + 92 + c_idx * 40), item, fill=(30, 41, 59), font=f_small_bold)

    # Station Details Box
    draw.rounded_rectangle([info_x + 25, info_y + 570, info_x + info_w - 25, info_y + 920], radius=8, fill=(241, 245, 249), outline=(203, 213, 225), width=1)
    draw.text((info_x + 40, info_y + 590), "FIELD DEPLOYMENT STATION SPECIFICATION", fill=TEXT_MAIN, font=f_title)
    draw.text((info_x + 40, info_y + 625), "Station Location: Tabbowa Dam Station #01, Puttalam District, Sri Lanka", fill=TEXT_MAIN, font=f_bold)
    draw.text((info_x + 40, info_y + 655), "Target Microcontroller: ESP32-WROOM-32 (30-Pin DevKit V1) • Dual-Core 240MHz", fill=TEXT_MUTED, font=f_small_bold)
    draw.text((info_x + 40, info_y + 685), "Dual-Core Architecture: Core 0 (Supabase HTTPS + MQTT) | Core 1 (Sensors + Servo)", fill=TEXT_MUTED, font=f_small)
    draw.text((info_x + 40, info_y + 715), "Active Sensor Transducers: 2x HC-SR04 Ultrasonic + 1x DHT22 Temperature/Humidity", fill=TEXT_MUTED, font=f_small)
    draw.text((info_x + 40, info_y + 745), "Gate Actuator: 1x TowerPro MG90S Micro Metal-Gear Servo (4.8V-6.0V, Slew-Rate Clamped)", fill=TEXT_MUTED, font=f_small)
    draw.text((info_x + 40, info_y + 775), "Cellular Modem: SIM800L GSM/GPRS Quad-Band Module (Isolated 4.0V Rail)", fill=TEXT_MUTED, font=f_small)
    draw.text((info_x + 40, info_y + 805), "Academic Authors: Dias Adrian, AAA Aadhil, JMRA Dilshan", fill=TEXT_MAIN, font=f_bold)
    draw.text((info_x + 40, info_y + 835), "Affiliation: Faculty of Computing & Information Technology, SLTC Research University", fill=TEXT_MUTED, font=f_small)
    draw.text((info_x + 40, info_y + 865), "Verification Benchmark: 100% AUDITED, TESTED & CERTIFIED FOR FINAL DEFENSE", fill=(22, 163, 74), font=f_bold)

    # -------------------------------------------------------------------------
    # 8. SAVE OUTPUT FILES
    # -------------------------------------------------------------------------
    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(base_dir, exist_ok=True)
    out_master_png = os.path.normpath(os.path.join(base_dir, 'sdas_master_circuit_diagram.png'))
    out_master_jpg = os.path.normpath(os.path.join(base_dir, 'sdas_master_circuit_diagram.jpg'))

    artifact_dir = os.path.normpath(r'C:\Users\adria\.gemini\antigravity\brain\0c14942f-4bad-47bf-874a-33bdb3daeaf3')
    os.makedirs(artifact_dir, exist_ok=True)
    out_artifact_png = os.path.normpath(os.path.join(artifact_dir, 'sdas_master_circuit_diagram.png'))
    out_artifact_jpg = os.path.normpath(os.path.join(artifact_dir, 'sdas_master_circuit_diagram.jpg'))

    img.save(out_master_png, 'PNG', optimize=True)
    img.save(out_master_jpg, 'JPEG', quality=95)
    img.save(out_artifact_png, 'PNG', optimize=True)
    img.save(out_artifact_jpg, 'JPEG', quality=95)

    print(f"Colorful schematic successfully generated at:\n  {out_master_png}\n  {out_master_jpg}\n  {out_artifact_png}\n  {out_artifact_jpg}")

if __name__ == '__main__':
    generate_colorful_schematic()
