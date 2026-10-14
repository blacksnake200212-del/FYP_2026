import os
from PIL import Image, ImageDraw, ImageFont

def create_schematic():
    W, H = 2600, 1500
    img = Image.new('RGB', (W, H), (250, 252, 255))
    draw = ImageDraw.Draw(img)

    # Color Palette
    BG_CARD = (255, 255, 255)
    BORDER_CARD = (203, 213, 225)
    TEXT_MAIN = (15, 23, 42)
    TEXT_MUTED = (71, 85, 105)
    TEXT_CYAN = (2, 132, 199)
    
    # Wire Colors
    COLOR_12V = (185, 28, 28)       # Dark Red (12V)
    COLOR_5V = (234, 88, 12)        # Orange (5V)
    COLOR_4V = (147, 51, 234)       # Purple (4V Isolated)
    COLOR_3V3 = (14, 165, 233)      # Light Blue (3.3V)
    COLOR_GND = (30, 41, 59)        # Dark Slate (GND)
    COLOR_SIG = (16, 185, 129)      # Emerald Green (Signal)
    COLOR_PWM = (245, 158, 11)      # Amber (PWM)

    # Fonts
    try:
        f_hero = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 26)
        f_title = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 18)
        f_sub = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 13)
        f_bold = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 13)
        f_reg = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 11)
        f_small = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 10)
        f_small_bold = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 10)
        f_pin = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 11)
    except:
        f_hero = f_title = f_sub = f_bold = f_reg = f_small = f_small_bold = f_pin = ImageFont.load_default()

    # Helper: Card with shadow/border
    def draw_box(x, y, w, h, title="", subtitle="", color=BORDER_CARD, fill=BG_CARD):
        draw.rounded_rectangle([x, y, x + w, y + h], radius=10, fill=fill, outline=color, width=2)
        if title:
            draw.text((x + 14, y + 10), title, fill=TEXT_MAIN, font=f_title)
        if subtitle:
            draw.text((x + 14, y + 32), subtitle, fill=TEXT_MUTED, font=f_sub)

    # -------------------------------------------------------------------------
    # 1. HEADER & BANNER
    # -------------------------------------------------------------------------
    draw.rectangle([0, 0, W, 75], fill=(15, 23, 42))
    draw.text((36, 14), "SMART DAM ALERT SYSTEM (SDAS) - HARDWARE CIRCUIT SCHEMATIC", fill=(255, 255, 255), font=f_hero)
    draw.text((38, 46), "Automated Sluice Gate Control • Dual-Ultrasonic Redundancy • Dedicated GSM Power Rail • ESP32-WROOM-32", fill=(148, 163, 184), font=f_sub)

    # Legend Box in Header
    leg_x = W - 780
    draw.rounded_rectangle([leg_x, 10, W - 30, 65], radius=6, fill=(30, 41, 59), outline=(51, 65, 85), width=1)
    # Legend items
    draw.line([(leg_x + 15, 25), (leg_x + 35, 25)], fill=COLOR_12V, width=3)
    draw.text((leg_x + 42, 20), "12V Raw", fill=(255, 255, 255), font=f_small_bold)

    draw.line([(leg_x + 115, 25), (leg_x + 135, 25)], fill=COLOR_5V, width=3)
    draw.text((leg_x + 142, 20), "+5.0V Main", fill=(255, 255, 255), font=f_small_bold)

    draw.line([(leg_x + 235, 25), (leg_x + 255, 25)], fill=COLOR_4V, width=3)
    draw.text((leg_x + 262, 20), "+4.0V GSM", fill=(255, 255, 255), font=f_small_bold)

    draw.line([(leg_x + 355, 25), (leg_x + 375, 25)], fill=COLOR_3V3, width=3)
    draw.text((leg_x + 382, 20), "3.3V Logic", fill=(255, 255, 255), font=f_small_bold)

    draw.line([(leg_x + 475, 25), (leg_x + 495, 25)], fill=COLOR_SIG, width=3)
    draw.text((leg_x + 502, 20), "Digital Signal", fill=(255, 255, 255), font=f_small_bold)

    draw.line([(leg_x + 605, 25), (leg_x + 625, 25)], fill=COLOR_GND, width=3)
    draw.text((leg_x + 632, 20), "Common GND", fill=(255, 255, 255), font=f_small_bold)

    draw.text((leg_x + 15, 42), "Note: Strict Rail Isolation (Buck 1 & 2 share GND only. 4V rail dedicated to SIM800L).", fill=(203, 213, 225), font=f_small)

    # -------------------------------------------------------------------------
    # 2. POWER SUPPLY SECTION (Top Left)
    # -------------------------------------------------------------------------
    p_x, p_y, p_w, p_h = 36, 95, 780, 310
    draw_box(p_x, p_y, p_w, p_h, "1. DUAL-STAGE POWER SUPPLY & ISOLATED RAILS", "12V 5A Input with Dedicated Buck Regulation & TVS Protection", color=(185, 28, 28))

    # 12V Input Jack & Protection
    draw.rounded_rectangle([p_x + 20, p_y + 60, p_x + 155, p_y + 130], radius=8, fill=(241, 245, 249), outline=(148, 163, 184), width=1)
    draw.text((p_x + 28, p_y + 70), "12V 5A DC INPUT", fill=TEXT_MAIN, font=f_bold)
    draw.text((p_x + 28, p_y + 88), "Adapter / 3S Battery", fill=TEXT_MUTED, font=f_small)
    draw.text((p_x + 28, p_y + 104), "(11.1V - 12.6V BMS)", fill=TEXT_MUTED, font=f_small)

    # Fuse, Diode, Switch blocks
    draw.rectangle([p_x + 175, p_y + 80, p_x + 235, p_y + 110], fill=(254, 243, 199), outline=(217, 119, 6), width=1)
    draw.text((p_x + 182, p_y + 88), "FUSE 5A", fill=(180, 83, 9), font=f_small_bold)

    draw.rectangle([p_x + 250, p_y + 80, p_x + 315, p_y + 110], fill=(241, 245, 249), outline=(100, 116, 139), width=1)
    draw.text((p_x + 257, p_y + 88), "1N5408", fill=TEXT_MAIN, font=f_small_bold)

    draw.rectangle([p_x + 330, p_y + 80, p_x + 400, p_y + 110], fill=(241, 245, 249), outline=(100, 116, 139), width=1)
    draw.text((p_x + 337, p_y + 88), "SMBJ15A", fill=TEXT_MAIN, font=f_small_bold)

    draw.rectangle([p_x + 415, p_y + 80, p_x + 485, p_y + 110], fill=(241, 245, 249), outline=(100, 116, 139), width=1)
    draw.text((p_x + 423, p_y + 88), "SPST SW", fill=TEXT_MAIN, font=f_small_bold)

    # 12V wires
    draw.line([(p_x + 155, p_y + 95), (p_x + 175, p_y + 95)], fill=COLOR_12V, width=3)
    draw.line([(p_x + 235, p_y + 95), (p_x + 250, p_y + 95)], fill=COLOR_12V, width=3)
    draw.line([(p_x + 315, p_y + 95), (p_x + 330, p_y + 95)], fill=COLOR_12V, width=3)
    draw.line([(p_x + 400, p_y + 95), (p_x + 415, p_y + 95)], fill=COLOR_12V, width=3)
    draw.line([(p_x + 485, p_y + 95), (p_x + 510, p_y + 95)], fill=COLOR_12V, width=3)

    # Filter Cap C1
    draw.line([(p_x + 510, p_y + 95), (p_x + 510, p_y + 155)], fill=COLOR_12V, width=2)
    draw.rectangle([p_x + 490, p_y + 120, p_x + 530, p_y + 155], fill=(224, 242, 254), outline=(2, 132, 199), width=1)
    draw.text((p_x + 495, p_y + 126), "C1", fill=TEXT_MAIN, font=f_small_bold)
    draw.text((p_x + 493, p_y + 138), "1000uF", fill=TEXT_MUTED, font=f_small)

    # Parallel Split 12V to Buck #1 and Buck #2 (BOTH fed from 12V Raw Bus)
    draw.line([(p_x + 510, p_y + 95), (p_x + 540, p_y + 95)], fill=COLOR_12V, width=3)
    draw.line([(p_x + 540, p_y + 95), (p_x + 540, p_y + 70)], fill=COLOR_12V, width=3)
    draw.line([(p_x + 540, p_y + 70), (p_x + 555, p_y + 70)], fill=COLOR_12V, width=3)

    draw.line([(p_x + 540, p_y + 95), (p_x + 540, p_y + 200)], fill=COLOR_12V, width=3)
    draw.line([(p_x + 540, p_y + 200), (p_x + 555, p_y + 200)], fill=COLOR_12V, width=3)

    # Buck #1 Box: XL4015 5.0V (Powers System Core & Servo)
    b1_x, b1_y = p_x + 555, p_y + 50
    draw.rounded_rectangle([b1_x, b1_y, b1_x + 205, b1_y + 95], radius=6, fill=(255, 247, 237), outline=(234, 88, 12), width=2)
    draw.text((b1_x + 8, b1_y + 8), "BUCK #1: XL4015 (5.0V)", fill=(194, 65, 12), font=f_bold)
    draw.text((b1_x + 8, b1_y + 26), "12V IN -> +5.0V OUT (3A Continuous)", fill=TEXT_MAIN, font=f_small_bold)
    draw.text((b1_x + 8, b1_y + 42), "ESP32 VIN via 1N5819 Schottky Diode", fill=(2, 132, 199), font=f_small_bold)
    draw.text((b1_x + 8, b1_y + 58), "Decoupling: C2 1000uF / 16V Rail Cap", fill=TEXT_MUTED, font=f_small)
    draw.text((b1_x + 8, b1_y + 74), "Powers: Servo, ESP32, Buzzer, Sensors", fill=(194, 65, 12), font=f_small)

    # Buck #2 Box: XL4015 4.0V (DEDICATED EXCLUSIVELY to SIM800L)
    b2_x, b2_y = p_x + 555, p_y + 175
    draw.rounded_rectangle([b2_x, b2_y, b2_x + 205, b2_y + 95], radius=6, fill=(250, 245, 255), outline=(147, 51, 234), width=2)
    draw.text((b2_x + 8, b2_y + 8), "BUCK #2: XL4015 (4.0V)", fill=(126, 34, 206), font=f_bold)
    draw.text((b2_x + 8, b2_y + 26), "12V IN -> +4.0V OUT (4A Peak Capable)", fill=TEXT_MAIN, font=f_bold)
    draw.text((b2_x + 8, b2_y + 44), "Decoupling: C3 1000uF Low-ESR", fill=TEXT_MUTED, font=f_small)
    draw.text((b2_x + 8, b2_y + 60), "Dedicated EXCLUSIVELY to SIM800L", fill=(126, 34, 206), font=f_small_bold)
    draw.text((b2_x + 8, b2_y + 76), "Prevents 2A GSM burst brownouts", fill=TEXT_MUTED, font=f_small)

    # Outputs of Bucks
    # Buck 1 -> 5V bus
    draw.line([(b1_x + 205, b1_y + 40), (p_x + p_w, b1_y + 40)], fill=COLOR_5V, width=4)
    draw.text((p_x + p_w - 75, b1_y + 22), "+5.0V Rail", fill=COLOR_5V, font=f_bold)

    # Buck 2 -> 4V bus
    draw.line([(b2_x + 205, b2_y + 40), (p_x + p_w, b2_y + 40)], fill=COLOR_4V, width=4)
    draw.text((p_x + p_w - 75, b2_y + 22), "+4.0V Rail", fill=COLOR_4V, font=f_bold)

    # -------------------------------------------------------------------------
    # 3. CENTER: ESP32 DEVKIT V1 (30-Pin Node Core)
    # -------------------------------------------------------------------------
    esp_x, esp_y, esp_w, esp_h = 1000, 110, 560, 680
    draw.rounded_rectangle([esp_x, esp_y, esp_x + esp_w, esp_y + esp_h], radius=16, fill=(15, 23, 42), outline=(56, 189, 248), width=3)

    # ESP32 Chip Metal Shield
    draw.rounded_rectangle([esp_x + 140, esp_y + 140, esp_x + 420, esp_y + 420], radius=8, fill=(51, 65, 85), outline=(148, 163, 184), width=2)
    draw.text((esp_x + 200, esp_y + 230), "ESP32-WROOM-32", fill=(255, 255, 255), font=f_title)
    draw.text((esp_x + 215, esp_y + 265), "Xtensa 32-bit Dual Core", fill=(148, 163, 184), font=f_reg)
    draw.text((esp_x + 230, esp_y + 285), "Wi-Fi & Bluetooth LE", fill=(148, 163, 184), font=f_small)

    # USB Port at Bottom
    draw.rounded_rectangle([esp_x + 230, esp_y + esp_h - 35, esp_x + 330, esp_y + esp_h], radius=4, fill=(203, 213, 225), outline=(71, 85, 105), width=2)
    draw.text((esp_x + 248, esp_y + esp_h - 22), "MicroUSB", fill=(15, 23, 42), font=f_small_bold)

    # ESP32 Header Titles
    draw.text((esp_x + 180, esp_y + 25), "ESP32 DevKit V1 (30-Pin)", fill=(248, 250, 252), font=f_title)
    draw.text((esp_x + 205, esp_y + 55), "SDAS Core Controller", fill=TEXT_CYAN, font=f_bold)

    # Left Pins (15 pins)
    left_pins = [
        ("3V3", "3.3V LDO Output", COLOR_3V3),
        ("GND", "Ground Reference", COLOR_GND),
        ("GPIO15", "Reserved", (100, 116, 139)),
        ("GPIO2", "Internal LED / Strapping", (100, 116, 139)),
        ("GPIO4", "DHT22 DATA (10k Pullup)", COLOR_SIG),
        ("GPIO16", "RX2 <- SIM800L TXD", COLOR_SIG),
        ("GPIO17", "TX2 -> SIM800L RXD (Divider)", COLOR_SIG),
        ("GPIO5", "TRIG1 -> Level Shifter LV1", COLOR_SIG),
        ("GPIO18", "TRIG2 -> Level Shifter LV3", COLOR_SIG),
        ("GPIO19", "ECHO1 <- Level Shifter LV2", COLOR_SIG),
        ("GPIO21", "ECHO2 <- Level Shifter LV4", COLOR_SIG),
        ("GPIO3", "UART0 RX (Prog)", (100, 116, 139)),
        ("GPIO1", "UART0 TX (Prog)", (100, 116, 139)),
        ("GPIO22", "STOP Button (E-STOP)", COLOR_PWM),
        ("GPIO23", "SIM800L Hardware RST", COLOR_SIG),
    ]

    # Right Pins (15 pins)
    right_pins = [
        ("VIN", "5.0V Power Input", COLOR_5V),
        ("GND", "Ground Reference", COLOR_GND),
        ("GPIO13", "RGB LED Blue (100 Ω)", (59, 130, 246)),
        ("GPIO12", "STRAPPING PIN (LEAVE OPEN)", (239, 68, 68)),
        ("GPIO14", "OPEN Button (Manual)", COLOR_SIG),
        ("GPIO27", "Buzzer Driver (BC547)", COLOR_PWM),
        ("GPIO26", "CLOSE Button (Manual)", COLOR_SIG),
        ("GPIO25", "Servo Sluice PWM (330 Ω)", COLOR_PWM),
        ("GPIO33", "RGB LED Green (100 Ω)", (34, 197, 94)),
        ("GPIO32", "RGB LED Red (220 Ω)", (239, 68, 68)),
        ("GPIO35", "Input Only (ADC1_7)", (100, 116, 139)),
        ("GPIO34", "Tipping Bucket Rain Gauge", COLOR_SIG),
        ("VN", "ADC1_0", (100, 116, 139)),
        ("VP", "ADC1_3", (100, 116, 139)),
        ("EN", "Reset Button", (100, 116, 139)),
    ]

    pin_start_y = esp_y + 90
    pin_step_y = 36

    # Draw Left Pins
    for i, (pname, pdesc, pcol) in enumerate(left_pins):
        py = pin_start_y + i * pin_step_y
        draw.ellipse([esp_x + 8, py - 6, esp_x + 20, py + 6], fill=(203, 213, 225), outline=(100, 116, 139))
        draw.text((esp_x + 26, py - 6), pname, fill=(241, 245, 249), font=f_pin)
        # short trace out
        draw.line([(esp_x, py), (esp_x - 30, py)], fill=pcol, width=2)

    # Draw Right Pins
    for i, (pname, pdesc, pcol) in enumerate(right_pins):
        py = pin_start_y + i * pin_step_y
        draw.ellipse([esp_x + esp_w - 20, py - 6, esp_x + esp_w - 8, py + 6], fill=(203, 213, 225), outline=(100, 116, 139))
        draw.text((esp_x + esp_w - 75, py - 6), pname, fill=(241, 245, 249), font=f_pin)
        # short trace out
        draw.line([(esp_x + esp_w, py), (esp_x + esp_w + 30, py)], fill=pcol, width=2)

    # -------------------------------------------------------------------------
    # 4. LEFT PERIPHERALS: SENSORS & LEVEL CONVERTER
    # -------------------------------------------------------------------------
    # Logic Level Converter Box
    llc_x, llc_y, llc_w, llc_h = 580, 440, 360, 310
    draw_box(llc_x, llc_y, llc_w, llc_h, "4-CH BI-DIRECTIONAL LEVEL CONVERTER", "5V Sensors <-> 3.3V ESP32 Protection", color=(2, 132, 199))

    draw.rounded_rectangle([llc_x + 20, llc_y + 60, llc_x + 150, llc_y + 290], radius=6, fill=(239, 246, 255), outline=(59, 130, 246), width=1)
    draw.text((llc_x + 35, llc_y + 70), "HIGH VOLTAGE (5V)", fill=(29, 78, 216), font=f_small_bold)
    draw.text((llc_x + 30, llc_y + 100), "HV : +5.0V Rail\nGND: Common\nHV1: TRIG1 (5V)\nHV2: ECHO1 (5V)\nHV3: TRIG2 (5V)\nHV4: ECHO2 (5V)", fill=TEXT_MAIN, font=f_reg)

    draw.rounded_rectangle([llc_x + 200, llc_y + 60, llc_x + 330, llc_y + 290], radius=6, fill=(240, 253, 250), outline=(20, 184, 166), width=1)
    draw.text((llc_x + 215, llc_y + 70), "LOW VOLTAGE (3.3V)", fill=(15, 118, 110), font=f_small_bold)
    draw.text((llc_x + 210, llc_y + 100), "LV : 3.3V (ESP32)\nGND: Common\nLV1: GPIO5 (TRIG1)\nLV2: GPIO19 (ECHO1)\nLV3: GPIO18 (TRIG2)\nLV4: GPIO21 (ECHO2)", fill=TEXT_MAIN, font=f_reg)

    # Traces from ESP32 to Level Converter LV
    draw.line([(esp_x - 30, pin_start_y + 7 * pin_step_y), (llc_x + 330, llc_y + 160)], fill=COLOR_SIG, width=2) # GPIO5
    draw.line([(esp_x - 30, pin_start_y + 9 * pin_step_y), (llc_x + 330, llc_y + 185)], fill=COLOR_SIG, width=2) # GPIO19
    draw.line([(esp_x - 30, pin_start_y + 8 * pin_step_y), (llc_x + 330, llc_y + 210)], fill=COLOR_SIG, width=2) # GPIO18
    draw.line([(esp_x - 30, pin_start_y + 10 * pin_step_y), (llc_x + 330, llc_y + 235)], fill=COLOR_SIG, width=2) # GPIO21

    # Ultrasonic Sensor 1: JSN-SR04T #1
    s1_x, s1_y = 36, 440
    draw_box(s1_x, s1_y, 480, 140, "SENSOR 1: JSN-SR04T (PRIMARY)", "Waterproof Transducer • Tabbowa Reservoir Crest (75cm Height)", color=(2, 132, 199))
    draw.text((s1_x + 20, s1_y + 65), "Mount: 75.0 cm above floor (35cm clearance over 40cm crest)\nVCC  --> +5.0V Main Rail\nTRIG --> Level Shifter HV1 (5V In)\nECHO --> Level Shifter HV2 (5V Out -> 3.3V)\nGND  --> Common Ground", fill=TEXT_MAIN, font=f_reg)
    draw.line([(s1_x + 480, s1_y + 85), (llc_x + 20, llc_y + 130)], fill=COLOR_SIG, width=2)
    draw.line([(s1_x + 480, s1_y + 105), (llc_x + 20, llc_y + 155)], fill=COLOR_SIG, width=2)

    # Ultrasonic Sensor 2: JSN-SR04T #2
    s2_x, s2_y = 36, 610
    draw_box(s2_x, s2_y, 480, 140, "SENSOR 2: JSN-SR04T (REDUNDANT)", "Waterproof Transducer • Cross-Validation (Δ <= 5cm, 75cm Height)", color=(2, 132, 199))
    draw.text((s2_x + 20, s2_y + 65), "Mount: 75.0 cm above floor (35cm clearance over 40cm crest)\nVCC  --> +5.0V Main Rail\nTRIG --> Level Shifter HV3 (5V In)\nECHO --> Level Shifter HV4 (5V Out -> 3.3V)\nGND  --> Common Ground", fill=TEXT_MAIN, font=f_reg)
    draw.line([(s2_x + 480, s2_y + 85), (llc_x + 20, llc_y + 205)], fill=COLOR_SIG, width=2)
    draw.line([(s2_x + 480, s2_y + 105), (llc_x + 20, llc_y + 230)], fill=COLOR_SIG, width=2)

    # DHT22 Sensor
    dht_x, dht_y = 36, 780
    draw_box(dht_x, dht_y, 480, 140, "DHT22 SENSOR: TEMP & HUMIDITY", "Air Speed Sound Velocity Compensation", color=(16, 185, 129))
    draw.text((dht_x + 20, dht_y + 65), "Pin 1 (VCC)  --> 3.3V Logic Rail\nPin 2 (DATA) --> ESP32 GPIO4 (with 10 kΩ pullup to 3.3V)\nPin 4 (GND)  --> Common Ground", fill=TEXT_MAIN, font=f_reg)
    draw.line([(dht_x + 480, dht_y + 85), (esp_x - 30, pin_start_y + 4 * pin_step_y)], fill=COLOR_SIG, width=2)

    # 3x Push Buttons (Bottom Left)
    btn_x, btn_y = 36, 950
    draw_box(btn_x, btn_y, 680, 140, "3x MANUAL CONTROL PUSH BUTTONS", "Debounced in Firmware (20ms) • Active LOW to GND", color=(217, 119, 6))
    draw.text((btn_x + 20, btn_y + 65), "1. OPEN BUTTON  --> ESP32 GPIO14 (Internal Pull-Up) -> Button -> GND\n2. CLOSE BUTTON --> ESP32 GPIO26 (Internal Pull-Up) -> Button -> GND\n3. STOP BUTTON  --> ESP32 GPIO22 (HARDWARE E-STOP INTERRUPT) -> GND", fill=TEXT_MAIN, font=f_bold)

    # -------------------------------------------------------------------------
    # 5. RIGHT PERIPHERALS: SERVO, GSM, BUZZER, RGB LED
    # -------------------------------------------------------------------------
    # ACTUATOR 1: MG90S SERVO MOTOR (EXACTLY 1 SERVO MOTOR IN THE PROJECT)
    srv_x, srv_y, srv_w, srv_h = 1660, 95, 880, 180
    draw_box(srv_x, srv_y, srv_w, srv_h, "ACTUATOR: 1x MG90S MICRO SERVO (SLUICE GATE)", "Metal Gear Micro Actuator (9g) • ONLY 1 SERVO IN PROJECT", color=(234, 88, 12))

    draw.rounded_rectangle([srv_x + 20, srv_y + 60, srv_x + 320, srv_y + 160], radius=8, fill=(255, 247, 237), outline=(234, 88, 12), width=2)
    draw.text((srv_x + 35, srv_y + 70), "MG90S 3-WIRE CONNECTION", fill=(194, 65, 12), font=f_bold)
    draw.text((srv_x + 35, srv_y + 92), "1. VCC (Red)    --> +5.0V Buck #1 Rail (C4 470uF at plug)\n2. GND (Brown)  --> Common Ground\n3. PWM (Orange) --> ESP32 GPIO25 (via 330 Ω)", fill=TEXT_MAIN, font=f_bold)

    draw.rounded_rectangle([srv_x + 360, srv_y + 60, srv_x + 850, srv_y + 160], radius=8, fill=(248, 250, 252), outline=(148, 163, 184), width=1)
    draw.text((srv_x + 375, srv_y + 70), "MANDATORY SLUICE GATE OPERATIONAL PRESETS", fill=TEXT_MAIN, font=f_bold)
    draw.text((srv_x + 375, srv_y + 92), "● 0% Preset (Closed): Sluice gate sealed, 0 discharge\n● 20% Preset (Clear Area Stage): Controlled base spillway\n● 50% Preset (CRITICAL DANGER): Maximum allowed flood relief (100% prohibited)", fill=(15, 23, 42), font=f_reg)

    # Wire from ESP32 GPIO25 to Servo PWM
    draw.line([(esp_x + esp_w + 30, pin_start_y + 7 * pin_step_y), (srv_x + 20, srv_y + 135)], fill=COLOR_PWM, width=3)

    # CELLULAR MODEM: SIM800L GSM MODULE
    gsm_x, gsm_y, gsm_w, gsm_h = 1660, 305, 880, 230
    draw_box(gsm_x, gsm_y, gsm_w, gsm_h, "CELLULAR MODEM: SIM800L GSM/GPRS GATEWAY", "Staged Emergency Cellular SMS Broadcast • Dedicated 4.0V Rail", color=(147, 51, 234))

    draw.rounded_rectangle([gsm_x + 20, gsm_y + 60, gsm_x + 380, gsm_y + 210], radius=8, fill=(250, 245, 255), outline=(147, 51, 234), width=1)
    draw.text((gsm_x + 35, gsm_y + 70), "SIM800L INTERFACE PINMAP", fill=(126, 34, 206), font=f_bold)
    draw.text((gsm_x + 35, gsm_y + 92), "VCC  --> Dedicated +4.0V Rail (Buck #2 ONLY)\nGND  --> Common Ground\nTXD  --> ESP32 GPIO16 (RX2) Direct (2.8V -> 3.3V)\nRXD  --> ESP32 GPIO17 (TX2) via 1k/2.2k Divider\nRST  --> ESP32 GPIO23 (Hardware Unfreeze Pulse)\nRING --> Unused", fill=TEXT_MAIN, font=f_bold)

    # Passive Divider Schematic inside GSM box
    draw.rounded_rectangle([gsm_x + 410, gsm_y + 60, gsm_x + 850, gsm_y + 210], radius=8, fill=(241, 245, 249), outline=(100, 116, 139), width=1)
    draw.text((gsm_x + 425, gsm_y + 70), "RXD VOLTAGE DIVIDER PROTECTION (3.3V -> 2.27V)", fill=TEXT_MAIN, font=f_bold)
    draw.text((gsm_x + 425, gsm_y + 95), "ESP32 GPIO17 (3.3V) ────[ 1.0 kΩ ]────┬────> SIM800L RXD (~2.27V)\n                                        │\n                                     [ 2.2 kΩ ]\n                                        │\n                                       GND\nProtects modem 2.8V internal clamp silicon from 3.3V damage.", fill=(30, 41, 59), font=f_pin)

    # Wires from ESP32 to SIM800L
    draw.line([(esp_x - 30, pin_start_y + 5 * pin_step_y), (esp_x - 50, pin_start_y + 5 * pin_step_y), (esp_x - 50, 390), (gsm_x + 20, 390)], fill=COLOR_SIG, width=2) # GPIO16 RX2
    draw.line([(esp_x - 30, pin_start_y + 6 * pin_step_y), (esp_x - 70, pin_start_y + 6 * pin_step_y), (esp_x - 70, 420), (gsm_x + 20, 420)], fill=COLOR_SIG, width=2) # GPIO17 TX2
    draw.line([(esp_x - 30, pin_start_y + 14 * pin_step_y), (esp_x - 90, pin_start_y + 14 * pin_step_y), (esp_x - 90, 450), (gsm_x + 20, 450)], fill=COLOR_SIG, width=2) # GPIO23 RST

    # ALARM SIREN: 5V ACTIVE BUZZER & DRIVER
    buz_x, buz_y, buz_w, buz_h = 1660, 560, 880, 180
    draw_box(buz_x, buz_y, buz_w, buz_h, "ALARM SIREN: 5V ACTIVE PIEZO BUZZER & DRIVER", "NPN Transistor Switch with 1N4007 Flyback Suppression", color=(239, 68, 68))

    draw.rounded_rectangle([buz_x + 20, buz_y + 60, buz_x + 850, buz_y + 160], radius=8, fill=(254, 242, 242), outline=(239, 68, 68), width=1)
    draw.text((buz_x + 35, buz_y + 70), "TRANSISTOR SWITCH SCHEMATIC (BC547 / 2N2222 NPN)", fill=(185, 28, 28), font=f_bold)
    draw.text((buz_x + 35, buz_y + 95), "ESP32 GPIO27 ────[ 1.0 kΩ ]────> Base (B)\n                                  Collector (C) ────> Buzzer (−) ──┬──[ 1N4007 ]──┬──> +5.0V Rail\n                                  Emitter (E)   ────> Common GND    └─(Anode)──────┴─(Cathode)\nDiode absorbs inductive kickback voltage spikes when buzzer turns off.", fill=(15, 23, 42), font=f_pin)

    # Wire from GPIO27 to Buzzer Driver
    draw.line([(esp_x + esp_w + 30, pin_start_y + 5 * pin_step_y), (buz_x + 20, buz_y + 105)], fill=COLOR_PWM, width=2)

    # VISUAL STATUS INDICATOR: 4-PIN COMMON ANODE RGB LED (EXACTLY 1 RGB LED IN PROJECT)
    rgb_x, rgb_y, rgb_w, rgb_h = 1660, 765, 880, 240
    draw_box(rgb_x, rgb_y, rgb_w, rgb_h, "STATUS INDICATOR: 1x 4-PIN RGB LED MODULE", "Common Anode (3.3V) • Active LOW Control • Balanced Luminosity", color=(59, 130, 246))

    draw.rounded_rectangle([rgb_x + 20, rgb_y + 60, rgb_x + 400, rgb_y + 220], radius=8, fill=(239, 246, 255), outline=(59, 130, 246), width=1)
    draw.text((rgb_x + 35, rgb_y + 70), "RGB LED WIRING & BALANCED RESISTORS", fill=(29, 78, 216), font=f_bold)
    draw.text((rgb_x + 35, rgb_y + 95), "● Common Anode (+) ──> ESP32 3V3 Logic Rail\n● Red Cathode (−)   ──> [ 220 Ω ] ──> ESP32 GPIO32\n● Green Cathode (−) ──> [ 100 Ω ] ──> ESP32 GPIO33\n● Blue Cathode (−)  ──> [ 100 Ω ] ──> ESP32 GPIO13", fill=TEXT_MAIN, font=f_bold)
    draw.text((rgb_x + 35, rgb_y + 175), "Active LOW: Pull GPIO LOW to illuminate color.\nResistors balance Red (1.9V) vs Green/Blue (3.0V).", fill=TEXT_MUTED, font=f_small)

    draw.rounded_rectangle([rgb_x + 430, rgb_y + 60, rgb_x + 850, rgb_y + 220], radius=8, fill=(248, 250, 252), outline=(148, 163, 184), width=1)
    draw.text((rgb_x + 445, rgb_y + 70), "SDAS 4-STAGE COLOR ALERT CODES", fill=TEXT_MAIN, font=f_bold)
    draw.text((rgb_x + 445, rgb_y + 95), "Stage 0 (NORMAL):       GREEN ONLY (GPIO33 LOW, Level < 75%)\nStage 1 (PRE-WARNING):  YELLOW / AMBER (Red+Green LOW, 75% <= Level < 80%)\nStage 2 (CLEAR AREA):   ORANGE (Red+Dim Green LOW, 80% <= Level < 85%)\nStage 3 (DANGER):       RED ONLY (GPIO32 LOW, Level >= 85%)\nFault / Mismatch:       PULSING BLUE (GPIO13 LOW)", fill=TEXT_MAIN, font=f_pin)

    # Wires from ESP32 to RGB LED
    draw.line([(esp_x + esp_w + 30, pin_start_y + 9 * pin_step_y), (rgb_x + 20, rgb_y + 120)], fill=(239, 68, 68), width=2) # GPIO32 (Red)
    draw.line([(esp_x + esp_w + 30, pin_start_y + 8 * pin_step_y), (rgb_x + 20, rgb_y + 140)], fill=(34, 197, 94), width=2) # GPIO33 (Green)
    draw.line([(esp_x + esp_w + 30, pin_start_y + 2 * pin_step_y), (rgb_x + 20, rgb_y + 160)], fill=(59, 130, 246), width=2) # GPIO13 (Blue)

    # -------------------------------------------------------------------------
    # 6. MASTER SYSTEM AUDIT TABLE (Bottom)
    # -------------------------------------------------------------------------
    t_x, t_y, t_w, t_h = 36, 1115, 1530, 345
    draw_box(t_x, t_y, t_w, t_h, "MASTER HARDWARE SPECIFICATION & AUDITED PIN MAPPING TABLE", "Final Year Project Verification Benchmark (Zero Strapping Pin Conflicts)", color=(15, 23, 42))

    headers = ["PERIPHERAL / MODULE", "ESP32 PIN", "I/O MODE", "OPERATING VOLTAGE", "CIRCUIT PROTECTION / REMARKS"]
    col_w = [340, 160, 180, 240, 560]
    col_x = [t_x + 20]
    for w_i in col_w[:-1]:
        col_x.append(col_x[-1] + w_i)

    # Draw Table Header
    draw.rectangle([t_x + 15, t_y + 55, t_x + t_w - 15, t_y + 85], fill=(241, 245, 249))
    for c_i, h_txt in enumerate(headers):
        draw.text((col_x[c_i], t_y + 62), h_txt, fill=TEXT_MAIN, font=f_small_bold)

    table_rows = [
        ("JSN-SR04T #1 (Primary Ultrasonic)", "GPIO5 (TRIG), GPIO19 (ECHO)", "Output / Input", "5V (HV Level Shifter)", "LV1/LV2 <-> HV1/HV2 bi-directional level conversion"),
        ("JSN-SR04T #2 (Redundant Ultrasonic)", "GPIO18 (TRIG), GPIO21 (ECHO)", "Output / Input", "5V (HV Level Shifter)", "LV3/LV4 <-> HV3/HV4 cross-validation redundancy"),
        ("DHT22 Air Temperature & Humidity", "GPIO4", "Bi-directional", "3.3V Logic Rail", "Dedicated 10 kΩ pull-up resistor to 3.3V"),
        ("SIM800L GSM Cellular Modem", "GPIO16 (RX2), GPIO17 (TX2)", "UART2 Serial", "4.0V Isolated Rail", "1 kΩ / 2.2 kΩ divider protects 2.8V RXD; C3 1000uF sink"),
        ("SIM800L Hardware Reset", "GPIO23", "Output", "3.3V Logic", "Active LOW 100ms hardware unfreeze pulse"),
        ("MG90S Sluice Gate Micro Servo (1 Total)", "GPIO25 (PWM)", "Output (LEDC)", "5.0V Buck #1 Rail", "330 Ω series resistor absorbs high-frequency ringing"),
        ("5V Active Emergency Siren / Buzzer", "GPIO27", "Output", "5.0V Rail (Transistor)", "BC547 NPN driver + 1N4007 flyback suppression diode"),
        ("RGB Status LED (Common Anode)", "GPIO32 (R), GPIO33 (G), GPIO13 (B)", "Output (Active LOW)", "3.3V Logic Rail", "220 Ω on Red, 100 Ω on Green & Blue balance forward Vf"),
        ("3x Manual Push Buttons", "GPIO14 (Open), GPIO26 (Close), GPIO22 (Stop)", "Input (Pull-Up)", "3.3V -> GND", "20ms software debounced; GPIO22 highest priority interrupt"),
    ]

    r_y = t_y + 90
    for r_idx, row in enumerate(table_rows):
        bg_col = (255, 255, 255) if r_idx % 2 == 0 else (248, 250, 252)
        draw.rectangle([t_x + 15, r_y - 2, t_x + t_w - 15, r_y + 22], fill=bg_col)
        for c_i, val in enumerate(row):
            font_used = f_pin if c_i in [1, 2] else f_small
            draw.text((col_x[c_i], r_y + 2), val, fill=TEXT_MAIN, font=font_used)
        r_y += 24

    # Bottom Right Project Info Card
    info_x, info_y, info_w, info_h = 1660, 1115, 880, 345
    draw_box(info_x, info_y, info_w, info_h, "FINAL YEAR PROJECT VERIFICATION SIGN-OFF", "Smart Dam Alert System (SDAS) Engineering Standard", color=(15, 23, 42))

    draw.text((info_x + 25, info_y + 65), "KEY AUDIT CONFIRMATIONS FOR SUBMISSION & VIVA:", fill=TEXT_MAIN, font=f_bold)
    draw.text((info_x + 25, info_y + 95), "✓ EXACTLY 1 SERVO MOTOR: Only 1x MG90S micro metal-gear servo on the sluice gate. No duplicate motors.\n✓ EXACTLY 1 RGB LED MODULE: 4-pin Common Anode with 220 Ω and 100 Ω balanced resistors.\n✓ POWER ISOLATION: Buck #1 (5V) and Buck #2 (4V) share Ground only. SIM800L cannot burn from 5V.\n✓ TELEMETRY SENSORS: Ultrasonic level sensors cross-checked via 4-Ch level converter.\n✓ VOLTAGE DIVIDER: 1k / 2.2k divider guarantees SIM800L RX never exceeds 2.3V.\n✓ STRAPPING PIN INTEGRITY: GPIO12 is left unconnected; GPIO0/GPIO2 boots safely into flash.\n✓ E-STOP HARDWARE LATCH: Pressing STOP (GPIO22) halts servo motion immediately.", fill=(30, 41, 59), font=f_reg)

    draw.rounded_rectangle([info_x + 25, info_y + 265, info_x + info_w - 25, info_y + 325], radius=6, fill=(241, 245, 249), outline=(203, 213, 225), width=1)
    draw.text((info_x + 40, info_y + 278), "Station Location: Tabbowa Dam Station #01, Puttalam District, Sri Lanka", fill=TEXT_MAIN, font=f_bold)
    draw.text((info_x + 40, info_y + 298), "Target Microcontroller: ESP32-WROOM-32 (30-Pin DevKit V1) • Firmware: SDAS_V2.0", fill=TEXT_MUTED, font=f_small)

    # Save to disk
    out_master_png = 'hardware_docs/sdas_master_circuit_diagram.png'
    out_master_jpg = 'hardware_docs/sdas_master_circuit_diagram.jpg'
    out_artifact = 'C:/Users/adria/.gemini/antigravity/brain/0c14942f-4bad-47bf-874a-33bdb3daeaf3/sdas_master_circuit_diagram.png'

    img.save(out_master_png, 'PNG')
    img.save(out_master_jpg, 'JPEG', quality=98)
    img.save(out_artifact, 'PNG')

    print("Master schematic successfully generated:", out_master_png, out_master_jpg)

if __name__ == '__main__':
    create_schematic()
