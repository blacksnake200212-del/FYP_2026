import os
from PIL import Image, ImageDraw, ImageFont

def generate_xl4015_guide():
    W, H = 2600, 1920
    img = Image.new('RGB', (W, H), (248, 250, 252))
    draw = ImageDraw.Draw(img)

    # Palette
    BG_DARK     = (15, 23, 42)
    BG_CARD     = (255, 255, 255)
    BORDER_CARD = (226, 232, 240)
    TEXT_MAIN   = (15, 23, 42)
    TEXT_MUTED  = (71, 85, 105)
    TEXT_LIGHT  = (148, 163, 184)
    TEXT_CYAN   = (2, 132, 199)

    # Wire Colors
    W_12V_RAW   = (185, 28, 28)    # Deep Crimson (+12V IN)
    W_5V_MAIN   = (220, 38, 38)    # Bright Red (+5.0V Buck 1)
    W_4V_GSM    = (147, 51, 234)   # Vivid Purple (+4.0V Buck 2)
    W_GND       = (30, 41, 59)     # Dark Charcoal (GND)

    # Fonts
    font_paths = [
        "C:\\Windows\\Fonts\\segoeui.ttf",
        "C:\\Windows\\Fonts\\arial.ttf"
    ]
    bold_paths = [
        "C:\\Windows\\Fonts\\segoeuib.ttf",
        "C:\\Windows\\Fonts\\arialbd.ttf"
    ]
    mono_paths = [
        "C:\\Windows\\Fonts\\consola.ttf",
        "C:\\Windows\\Fonts\\cour.ttf"
    ]

    f_hero = ImageFont.load_default()
    f_title = ImageFont.load_default()
    f_bold = ImageFont.load_default()
    f_regular = ImageFont.load_default()
    f_small = ImageFont.load_default()
    f_small_bold = ImageFont.load_default()
    f_code = ImageFont.load_default()

    for p in bold_paths:
        if os.path.exists(p):
            f_hero = ImageFont.truetype(p, 42)
            f_title = ImageFont.truetype(p, 27)
            f_bold = ImageFont.truetype(p, 20)
            f_small_bold = ImageFont.truetype(p, 16)
            break

    for p in font_paths:
        if os.path.exists(p):
            f_regular = ImageFont.truetype(p, 18)
            f_small = ImageFont.truetype(p, 15)
            break

    for p in mono_paths:
        if os.path.exists(p):
            f_code = ImageFont.truetype(p, 16)
            break

    # 1. Header Banner
    draw.rectangle([0, 0, W, 100], fill=BG_DARK)
    draw.text((50, 18), "XL4015 DC-DC BUCK CONVERTER OUTPUT DISTRIBUTION & TERMINAL PINOUT", fill=(255, 255, 255), font=f_hero)
    draw.text((52, 65), "Smart Dam Alert System (SDAS) • Detailed Step-by-Step Power Routing Architecture & Bench Testing Reference", fill=TEXT_LIGHT, font=f_small)

    # 2. Main 12V DC Supply Input Block (Top Left)
    in_x, in_y, in_w, in_h = 50, 130, 520, 800
    draw.rounded_rectangle([in_x, in_y, in_x + in_w, in_y + in_h], radius=12, fill=BG_CARD, outline=BORDER_CARD, width=2)
    draw.rectangle([in_x, in_y, in_x + in_w, in_y + 45], fill=(241, 245, 249))
    draw.text((in_x + 20, in_y + 12), "12V 5A DC MAIN SUPPLY INPUT", fill=TEXT_MAIN, font=f_bold)

    draw.rounded_rectangle([in_x + 20, in_y + 65, in_x + in_w - 20, in_y + 160], radius=8, fill=(254, 242, 242), outline=W_12V_RAW, width=1)
    draw.text((in_x + 35, in_y + 75), "12V 5A DC Power Adapter / 3S Li-ion", fill=W_12V_RAW, font=f_bold)
    draw.text((in_x + 35, in_y + 102), "• Jack: 5.5mm x 2.1mm (Center Positive +12V)", fill=TEXT_MAIN, font=f_small)
    draw.text((in_x + 35, in_y + 124), "• Battery: 11.1V (Low 3S) - 12.6V (Full 3S BMS)", fill=TEXT_MUTED, font=f_small)

    stages = [
        ("FUSE 5A", "Fast-acting inline fuse protects from dead shorts"),
        ("1N5408 DIODE", "Series reverse-polarity blocking diode (3A rating)"),
        ("SMBJ15A TVS", "Transient Voltage Suppressor clamps spikes >15V"),
        ("SPST SWITCH", "Master DC power cutoff switch"),
        ("C1 CAPACITOR", "1000 µF / 25V bulk electrolytic storage capacitor"),
    ]
    cur_sy = in_y + 185
    for st_title, st_desc in stages:
        draw.rounded_rectangle([in_x + 20, cur_sy, in_x + in_w - 20, cur_sy + 48], radius=6, fill=(248, 250, 252), outline=(226, 232, 240), width=1)
        draw.text((in_x + 35, cur_sy + 8), "✔ " + st_title, fill=TEXT_MAIN, font=f_small_bold)
        draw.text((in_x + 35, cur_sy + 26), st_desc, fill=TEXT_MUTED, font=f_small)
        cur_sy += 58

    draw.rounded_rectangle([in_x + 20, in_y + 510, in_x + in_w - 20, in_y + 770], radius=8, fill=(238, 242, 255), outline=(199, 210, 254), width=1)
    draw.text((in_x + 35, in_y + 525), "PARALLEL BUCK TOPOLOGY RULE:", fill=(67, 56, 202), font=f_bold)
    rules_text = [
        "1. Both XL4015 modules are fed in parallel directly",
        "   from the 12V DC input bus rail.",
        "2. DO NOT cascade Buck #2 (4V) from Buck #1 (5V)!",
        "   The XL4015 needs at least 1.5V to 2.0V of headroom",
        "   between IN and OUT to regulate stably.",
        "   5.0V IN -> 4.0V OUT will drop out under 2A bursts.",
        "3. Feeding both from 12V provides ~7V-8V of headroom,",
        "   ensuring 92% efficiency and flawless regulation.",
    ]
    ry = in_y + 555
    for rt in rules_text:
        draw.text((in_x + 35, ry), rt, fill=TEXT_MAIN, font=f_small)
        ry += 24

    # -------------------------------------------------------------------------
    # 3. XL4015 MODULE 1 (5.0V MAIN POWER RAIL)
    # -------------------------------------------------------------------------
    b1_x, b1_y, b1_w, b1_h = 620, 130, 930, 800
    draw.rounded_rectangle([b1_x, b1_y, b1_x + b1_w, b1_y + b1_h], radius=14, fill=BG_CARD, outline=W_5V_MAIN, width=3)
    draw.rectangle([b1_x, b1_y, b1_x + b1_w, b1_y + 55], fill=(254, 242, 242))
    draw.text((b1_x + 25, b1_y + 14), "XL4015 BUCK #1 — 5.0V SYSTEM POWER RAIL", fill=W_5V_MAIN, font=f_title)
    draw.text((b1_x + b1_w - 250, b1_y + 18), "REGULATED +5.00V ± 0.05V", fill=W_5V_MAIN, font=f_bold)

    # Module Layout Simulation
    mod1_x, mod1_y, mod1_w, mod1_h = b1_x + 30, b1_y + 75, b1_w - 60, 200
    draw.rounded_rectangle([mod1_x, mod1_y, mod1_x + mod1_w, mod1_y + mod1_h], radius=10, fill=(30, 41, 59), outline=(71, 85, 105), width=2)

    # Screws on Left (IN+, IN-)
    draw.rounded_rectangle([mod1_x + 15, mod1_y + 25, mod1_x + 85, mod1_y + 85], radius=6, fill=(15, 23, 42), outline=(148, 163, 184), width=1)
    draw.text((mod1_x + 25, mod1_y + 36), "IN +", fill=W_12V_RAW, font=f_bold)
    draw.text((mod1_x + 22, mod1_y + 60), "(+12V)", fill=TEXT_LIGHT, font=f_small)

    draw.rounded_rectangle([mod1_x + 15, mod1_y + 115, mod1_x + 85, mod1_y + 175], radius=6, fill=(15, 23, 42), outline=(148, 163, 184), width=1)
    draw.text((mod1_x + 25, mod1_y + 126), "IN -", fill=(148, 163, 184), font=f_bold)
    draw.text((mod1_x + 22, mod1_y + 150), "(GND)", fill=TEXT_LIGHT, font=f_small)

    # Internal Components Graphic
    draw.rounded_rectangle([mod1_x + 130, mod1_y + 25, mod1_x + 330, mod1_y + 175], radius=6, fill=(15, 23, 42), outline=(100, 116, 139), width=1)
    draw.text((mod1_x + 160, mod1_y + 40), "XL4015 IC", fill=(255, 255, 255), font=f_bold)
    draw.text((mod1_x + 145, mod1_y + 65), "5A Step-Down DC-DC", fill=TEXT_CYAN, font=f_small)
    draw.text((mod1_x + 145, mod1_y + 95), "180 kHz Fixed Freq", fill=TEXT_LIGHT, font=f_small)
    draw.text((mod1_x + 145, mod1_y + 125), "Efficiency: ~92%", fill=(34, 197, 94), font=f_small_bold)

    # Inductor
    draw.ellipse([mod1_x + 360, mod1_y + 45, mod1_x + 460, mod1_y + 145], fill=(51, 65, 85), outline=(148, 163, 184), width=2)
    draw.text((mod1_x + 378, mod1_y + 80), "47µH", fill=(255, 255, 255), font=f_bold)
    draw.text((mod1_x + 372, mod1_y + 102), "Inductor", fill=TEXT_LIGHT, font=f_small)

    # Trimmer Pot
    draw.rounded_rectangle([mod1_x + 490, mod1_y + 35, mod1_x + 620, mod1_y + 115], radius=4, fill=(2, 132, 199), outline=(14, 165, 233), width=2)
    draw.ellipse([mod1_x + 580, mod1_y + 45, mod1_x + 605, mod1_y + 70], fill=(234, 179, 8), outline=(202, 138, 4), width=1)
    draw.line([(mod1_x + 585, mod1_y + 57), (mod1_x + 600, mod1_y + 57)], fill=(15, 23, 42), width=2)
    draw.text((mod1_x + 500, mod1_y + 50), "3296 W", fill=(255, 255, 255), font=f_bold)
    draw.text((mod1_x + 500, mod1_y + 75), "Brass Trimmer", fill=(255, 255, 255), font=f_small)
    draw.text((mod1_x + 480, mod1_y + 130), "Turn CCW to adjust", fill=(245, 158, 11), font=f_small_bold)
    draw.text((mod1_x + 480, mod1_y + 152), "Down to +5.00V", fill=(245, 158, 11), font=f_small_bold)

    # Screws on Right (OUT+, OUT-)
    out1_pos_x = mod1_x + mod1_w - 85
    draw.rounded_rectangle([out1_pos_x, mod1_y + 25, out1_pos_x + 70, mod1_y + 85], radius=6, fill=(15, 23, 42), outline=(148, 163, 184), width=1)
    draw.text((out1_pos_x + 8, mod1_y + 36), "OUT +", fill=W_5V_MAIN, font=f_bold)
    draw.text((out1_pos_x + 8, mod1_y + 60), "(+5V)", fill=W_5V_MAIN, font=f_small)

    draw.rounded_rectangle([out1_pos_x, mod1_y + 115, out1_pos_x + 70, mod1_y + 175], radius=6, fill=(15, 23, 42), outline=(148, 163, 184), width=1)
    draw.text((out1_pos_x + 8, mod1_y + 126), "OUT -", fill=(148, 163, 184), font=f_bold)
    draw.text((out1_pos_x + 8, mod1_y + 150), "(GND)", fill=TEXT_LIGHT, font=f_small)

    # 4. Buck #1 OUT+ Destination Branches (Detailed Cards)
    draw.text((b1_x + 30, b1_y + 295), "EXACT PHYSICAL DESTINATIONS OF BUCK #1 (OUT +5.0V):", fill=W_5V_MAIN, font=f_bold)

    destinations_b1 = [
        ("BRANCH 1: ESP32 DevKit V1 'VIN' Pin (via 1N5819 Schottky Diode)",
         "Feeds onboard 3.3V LDO regulator. 1N5819 diode prevents backfeeding into PC USB port while flashing code.",
         W_5V_MAIN),
        ("BRANCH 2: TowerPro MG90S Micro Metal-Gear Servo 'VCC' (Red Wire)",
         "Supplies motor current (up to 800mA stall). Local 470 µF buffer capacitor absorbs inductive spikes.",
         W_5V_MAIN),
        ("BRANCH 3: 5V Active Piezo Buzzer (+) Positive Terminal",
         "Feeds alarm siren. Negative pin is switched to GND via BC547 NPN transistor + 1N4007 clamp diode.",
         W_5V_MAIN),
        ("BRANCH 4: 4-Channel Logic Level Converter 'HV' High-Voltage Pin",
         "Powers the 5.0V side reference rail of the bidirectional MOSFET level shifter.",
         W_5V_MAIN),
        ("BRANCH 5: HC-SR04 Ultrasonic Sensor #1 'VCC' Pin",
         "Powers primary water level sensor. (HC-SR04 requires strictly 5.0V to emit reliable 40 kHz pulses).",
         W_5V_MAIN),
        ("BRANCH 6: HC-SR04 Ultrasonic Sensor #2 'VCC' Pin",
         "Powers redundant water level sensor. Receives clean 5.0V from the same parallel bus rail.",
         W_5V_MAIN),
    ]

    d_y = b1_y + 330
    for idx, (title, desc, col) in enumerate(destinations_b1):
        draw.rounded_rectangle([b1_x + 40, d_y, b1_x + b1_w - 30, d_y + 54], radius=6, fill=(255, 247, 237), outline=(254, 215, 170), width=1)
        draw.ellipse([b1_x + 55, d_y + 14, b1_x + 75, d_y + 34], fill=col)
        draw.text((b1_x + 88, d_y + 7), title, fill=TEXT_MAIN, font=f_small_bold)
        draw.text((b1_x + 88, d_y + 29), desc, fill=TEXT_MUTED, font=f_small)
        # Connecting red wire branch
        draw.line([(b1_x + 15, d_y + 27), (b1_x + 40, d_y + 27)], fill=W_5V_MAIN, width=3)
        draw.ellipse([b1_x + 12, d_y + 24, b1_x + 18, d_y + 30], fill=W_5V_MAIN)
        d_y += 64

    # Connect vertical distribution line for Buck 1
    draw.line([(out1_pos_x + 70, mod1_y + 55), (b1_x + b1_w - 15, mod1_y + 55), (b1_x + b1_w - 15, b1_y + 305), (b1_x + 15, b1_y + 305), (b1_x + 15, d_y - 37)], fill=W_5V_MAIN, width=4)

    # Ground Out for Buck 1
    draw.rounded_rectangle([b1_x + 30, b1_y + b1_h - 70, b1_x + b1_w - 30, b1_y + b1_h - 15], radius=6, fill=(241, 245, 249), outline=(203, 213, 225), width=1)
    draw.ellipse([b1_x + 45, b1_y + b1_h - 52, b1_x + 65, b1_y + b1_h - 32], fill=W_GND)
    draw.text((b1_x + 80, b1_y + b1_h - 56), "BUCK #1 (OUT - / GND): Connects directly to Common Ground Bus", fill=TEXT_MAIN, font=f_bold)
    draw.text((b1_x + 80, b1_y + b1_h - 32), "Ties together: ESP32 GND, Servo GND, Buzzer GND, Level Converter GND, Sensor GND, Button GND.", fill=TEXT_MUTED, font=f_small)

    # -------------------------------------------------------------------------
    # 4. XL4015 MODULE 2 (4.0V DEDICATED GSM RAIL)
    # -------------------------------------------------------------------------
    b2_x, b2_y, b2_w, b2_h = 1580, 130, 970, 800
    draw.rounded_rectangle([b2_x, b2_y, b2_x + b2_w, b2_y + b2_h], radius=14, fill=BG_CARD, outline=W_4V_GSM, width=3)
    draw.rectangle([b2_x, b2_y, b2_x + b2_w, b2_y + 55], fill=(250, 245, 255))
    draw.text((b2_x + 25, b2_y + 14), "XL4015 BUCK #2 — 4.0V DEDICATED GSM RAIL", fill=W_4V_GSM, font=f_title)
    draw.text((b2_x + b2_w - 250, b2_y + 18), "REGULATED +4.00V ± 0.05V", fill=W_4V_GSM, font=f_bold)

    # Module Layout Simulation
    mod2_x, mod2_y, mod2_w, mod2_h = b2_x + 30, b2_y + 75, b2_w - 60, 200
    draw.rounded_rectangle([mod2_x, mod2_y, mod2_x + mod2_w, mod2_y + mod2_h], radius=10, fill=(30, 41, 59), outline=(71, 85, 105), width=2)

    # Screws on Left (IN+, IN-)
    draw.rounded_rectangle([mod2_x + 15, mod2_y + 25, mod2_x + 85, mod2_y + 85], radius=6, fill=(15, 23, 42), outline=(148, 163, 184), width=1)
    draw.text((mod2_x + 25, mod2_y + 36), "IN +", fill=W_12V_RAW, font=f_bold)
    draw.text((mod2_x + 22, mod2_y + 60), "(+12V)", fill=TEXT_LIGHT, font=f_small)

    draw.rounded_rectangle([mod2_x + 15, mod2_y + 115, mod2_x + 85, mod2_y + 175], radius=6, fill=(15, 23, 42), outline=(148, 163, 184), width=1)
    draw.text((mod2_x + 25, mod2_y + 126), "IN -", fill=(148, 163, 184), font=f_bold)
    draw.text((mod2_x + 22, mod2_y + 150), "(GND)", fill=TEXT_LIGHT, font=f_small)

    # Internal Components Graphic
    draw.rounded_rectangle([mod2_x + 130, mod2_y + 25, mod2_x + 330, mod2_y + 175], radius=6, fill=(15, 23, 42), outline=(100, 116, 139), width=1)
    draw.text((mod2_x + 160, mod2_y + 40), "XL4015 IC", fill=(255, 255, 255), font=f_bold)
    draw.text((mod2_x + 145, mod2_y + 65), "Dedicated GSM Supply", fill=(192, 132, 252), font=f_small)
    draw.text((mod2_x + 145, mod2_y + 95), "Peak Current: 5A Surge", fill=TEXT_LIGHT, font=f_small)
    draw.text((mod2_x + 145, mod2_y + 125), "Zero Servo Interference", fill=(34, 197, 94), font=f_small_bold)

    # Inductor
    draw.ellipse([mod2_x + 360, mod2_y + 45, mod2_x + 460, mod2_y + 145], fill=(51, 65, 85), outline=(148, 163, 184), width=2)
    draw.text((mod2_x + 378, mod2_y + 80), "47µH", fill=(255, 255, 255), font=f_bold)
    draw.text((mod2_x + 372, mod2_y + 102), "Inductor", fill=TEXT_LIGHT, font=f_small)

    # Trimmer Pot
    draw.rounded_rectangle([mod2_x + 490, mod2_y + 35, mod2_x + 620, mod2_y + 115], radius=4, fill=(2, 132, 199), outline=(14, 165, 233), width=2)
    draw.ellipse([mod2_x + 580, mod2_y + 45, mod2_x + 605, mod2_y + 70], fill=(234, 179, 8), outline=(202, 138, 4), width=1)
    draw.line([(mod2_x + 585, mod2_y + 57), (mod2_x + 600, mod2_y + 57)], fill=(15, 23, 42), width=2)
    draw.text((mod2_x + 500, mod2_y + 50), "3296 W", fill=(255, 255, 255), font=f_bold)
    draw.text((mod2_x + 500, mod2_y + 75), "Brass Trimmer", fill=(255, 255, 255), font=f_small)
    draw.text((mod2_x + 480, mod2_y + 130), "Turn CCW to adjust", fill=(192, 132, 252), font=f_small_bold)
    draw.text((mod2_x + 480, mod2_y + 152), "Down to +4.00V", fill=(192, 132, 252), font=f_small_bold)

    # Screws on Right (OUT+, OUT-)
    out2_pos_x = mod2_x + mod2_w - 85
    draw.rounded_rectangle([out2_pos_x, mod2_y + 25, out2_pos_x + 70, mod2_y + 85], radius=6, fill=(15, 23, 42), outline=(148, 163, 184), width=1)
    draw.text((out2_pos_x + 8, mod2_y + 36), "OUT +", fill=W_4V_GSM, font=f_bold)
    draw.text((out2_pos_x + 8, mod2_y + 60), "(+4V)", fill=W_4V_GSM, font=f_small)

    draw.rounded_rectangle([out2_pos_x, mod2_y + 115, out2_pos_x + 70, mod2_y + 175], radius=6, fill=(15, 23, 42), outline=(148, 163, 184), width=1)
    draw.text((out2_pos_x + 8, mod2_y + 126), "OUT -", fill=(148, 163, 184), font=f_bold)
    draw.text((out2_pos_x + 8, mod2_y + 150), "(GND)", fill=TEXT_LIGHT, font=f_small)

    # 5. Buck #2 OUT+ Destination Details
    draw.text((b2_x + 30, b2_y + 295), "EXACT PHYSICAL DESTINATION OF BUCK #2 (OUT +4.0V):", fill=W_4V_GSM, font=f_bold)

    # Big SIM800L Destination Card
    draw.rounded_rectangle([b2_x + 30, b2_y + 330, b2_x + b2_w - 30, b2_y + 560], radius=10, fill=(250, 245, 255), outline=W_4V_GSM, width=2)
    draw.ellipse([b2_x + 50, b2_y + 355, b2_x + 76, b2_y + 381], fill=W_4V_GSM)
    draw.text((b2_x + 90, b2_y + 345), "EXCLUSIVELY TO SIM800L GSM MODULE 'VCC' PIN [PURPLE WIRE]", fill=W_4V_GSM, font=f_bold)
    draw.text((b2_x + 90, b2_y + 375), "• Operating Range: SIM800L requires 3.4V to 4.4V (Recommended sweet-spot: 4.00V).", fill=TEXT_MAIN, font=f_small)
    draw.text((b2_x + 90, b2_y + 400), "• NEVER CONNECT TO 5.0V: Supplying 5V to SIM800L will permanently destroy the RF PA!", fill=(220, 38, 38), font=f_small_bold)
    draw.text((b2_x + 90, b2_y + 425), "• NEVER CONNECT TO 3.3V: Causes Under-Voltage Lockout (UVLO) bootloops upon transmission.", fill=(220, 38, 38), font=f_small_bold)
    draw.text((b2_x + 90, b2_y + 450), "• ZERO SERVO INTERFERENCE: Complete power rail separation stops servo motor back-EMF noise.", fill=(22, 163, 74), font=f_small_bold)
    draw.text((b2_x + 90, b2_y + 475), "• WIRING: Run a dedicated pair of 20-22 AWG wires directly from Buck #2 to SIM800L header.", fill=TEXT_MAIN, font=f_small)
    draw.text((b2_x + 90, b2_y + 500), "• DO NOT ROUTE THROUGH BREADBOARD RAILS: High contact resistance drops voltage by 0.5V!", fill=(185, 28, 28), font=f_small_bold)

    # Route line from Buck 2 OUT+ to Card
    draw.line([(out2_pos_x + 70, mod2_y + 55), (b2_x + b2_w - 15, mod2_y + 55), (b2_x + b2_w - 15, b2_y + 345), (b2_x + b2_w - 30, b2_y + 345)], fill=W_4V_GSM, width=4)

    # Capacitor Callout Box
    draw.rounded_rectangle([b2_x + 30, b2_y + 580, b2_x + b2_w - 30, b2_y + 705], radius=8, fill=(240, 253, 244), outline=(34, 197, 94), width=1)
    draw.text((b2_x + 45, b2_y + 590), "MANDATORY BUFFER CAPACITOR AT SIM800L HEADER (C3):", fill=(21, 128, 61), font=f_bold)
    draw.text((b2_x + 45, b2_y + 616), "• Solder a 1000 µF to 2200 µF Low-ESR 10V electrolytic capacitor directly across SIM800L VCC & GND.", fill=TEXT_MAIN, font=f_small)
    draw.text((b2_x + 45, b2_y + 638), "• Place a 100 nF (0.1 µF) ceramic capacitor in parallel right next to it for RF noise decoupling.", fill=TEXT_MAIN, font=f_small)
    draw.text((b2_x + 45, b2_y + 660), "• Purpose: Absorbs 2.0A 2G RF transmission bursts (577 µs duration) without dropping rail below 3.4V.", fill=TEXT_MUTED, font=f_small)

    # Ground Out for Buck 2
    draw.rounded_rectangle([b2_x + 30, b2_y + b2_h - 70, b2_x + b2_w - 30, b2_y + b2_h - 15], radius=6, fill=(241, 245, 249), outline=(203, 213, 225), width=1)
    draw.ellipse([b2_x + 45, b2_y + b2_h - 52, b2_x + 65, b2_y + b2_h - 32], fill=W_GND)
    draw.text((b2_x + 80, b2_y + b2_h - 56), "BUCK #2 (OUT - / GND): Connects to SIM800L GND and Common Ground Bus", fill=TEXT_MAIN, font=f_bold)
    draw.text((b2_x + 80, b2_y + b2_h - 32), "Shares the common reference ground plane with ESP32 and Buck #1 so UART serial signals (TX/RX) align.", fill=TEXT_MUTED, font=f_small)

    # -------------------------------------------------------------------------
    # 5. BOTTOM SECTION: STEP-BY-STEP CALIBRATION & BREADBOARD WIRING
    # -------------------------------------------------------------------------
    bot_x, bot_y, bot_w, bot_h = 50, 960, W - 100, 910
    draw.rounded_rectangle([bot_x, bot_y, bot_x + bot_w, bot_y + bot_h], radius=14, fill=BG_CARD, outline=BORDER_CARD, width=2)
    draw.rectangle([bot_x, bot_y, bot_x + bot_w, bot_y + 55], fill=(241, 245, 249))
    draw.text((bot_x + 25, bot_y + 14), "STEP-BY-STEP BENCH CALIBRATION, SAFETY RULES & PHYSICAL WIRING HARNESS", fill=TEXT_MAIN, font=f_title)

    # Left Column: Calibration Steps
    draw.rounded_rectangle([bot_x + 30, bot_y + 75, bot_x + 1200, bot_y + bot_h - 25], radius=10, fill=(248, 250, 252), outline=(203, 213, 225), width=1)
    draw.text((bot_x + 50, bot_y + 90), "MANDATORY VOLTAGE TRIMMING PROCEDURE BEFORE CONNECTING COMPONENTS:", fill=(185, 28, 28), font=f_bold)

    calib_steps = [
        ("STEP 1: ISOLATE DOWNSTREAM BOARDS (ZERO LOAD)",
         "Do NOT plug in the ESP32, SIM800L, MG90S servo, or sensors yet! Factory buck converters often ship set to 12V or 18V output, which will instantly destroy the ESP32 and SIM800L if connected beforehand."),
        ("STEP 2: APPLY 12V INPUT POWER",
         "Connect your 12V 5A power supply to the IN+ and IN- terminals of both Buck #1 and Buck #2. Turn on the main SPST toggle switch. The onboard LEDs on both buck converters will turn ON."),
        ("STEP 3: CALIBRATE BUCK #1 TO EXACTLY 5.00V",
         "Place your Digital Multimeter (DMM) probes on Buck #1 OUT+ (Red probe) and OUT- (Black probe) in DC Voltage mode. Take a small flathead screwdriver and turn the brass screw on the blue trimmer counter-clockwise (typically 10-15 full turns) until the multimeter reads exactly 5.00V (acceptable range: 4.95V to 5.05V)."),
        ("STEP 4: CALIBRATE BUCK #2 TO EXACTLY 4.00V",
         "Move the multimeter probes to Buck #2 OUT+ (Red probe) and OUT- (Black probe). Turn the brass trimmer counter-clockwise until the meter reads exactly 4.00V (acceptable range: 3.95V to 4.05V). Do not set above 4.2V or below 3.8V."),
        ("STEP 5: POWER OFF & CONNECT WIRING",
         "Turn off the 12V power supply. Now wire the Buck #1 outputs to your 5V power bus, and Buck #2 output directly to the SIM800L VCC and GND pins with the 1000 µF capacitor. Double-check all polarities before powering on!"),
        ("STEP 6: VERIFY UNDER OPERATIONAL LOAD",
         "Power on the system. Re-check Buck #1 with DMM: it should remain between 4.90V and 5.05V while the servo moves. Re-check Buck #2 during SMS transmission: voltage should never drop below 3.6V."),
    ]

    c_sy = bot_y + 130
    for st_title, st_body in calib_steps:
        draw.text((bot_x + 50, c_sy), st_title, fill=TEXT_MAIN, font=f_small_bold)
        c_sy += 24
        words = st_body.split(' ')
        l1, l2 = "", ""
        for w in words:
            if len(l1 + w) < 95:
                l1 += w + " "
            else:
                l2 += w + " "
        draw.text((bot_x + 50, c_sy), l1, fill=TEXT_MUTED, font=f_small)
        c_sy += 20
        if l2:
            draw.text((bot_x + 50, c_sy), l2, fill=TEXT_MUTED, font=f_small)
            c_sy += 20
        c_sy += 14

    # Right Column: Visual Connection Table & Breadboard Layout
    r_col_x = bot_x + 1240
    draw.rounded_rectangle([r_col_x, bot_y + 75, bot_x + bot_w - 30, bot_y + bot_h - 25], radius=10, fill=(248, 250, 252), outline=(203, 213, 225), width=1)
    draw.text((r_col_x + 20, bot_y + 90), "RECOMMENDED BREADBOARD & TERMINAL POWER DISTRIBUTION:", fill=TEXT_MAIN, font=f_bold)

    breadboard_rules = [
        ("Top Breadboard Power Rail (+ Red)",     "Connect to Buck #1 OUT+ (+5.0V). Supplies Level Shifter HV, HC-SR04 VCC, Buzzer (+).", W_5V_MAIN),
        ("Top Breadboard Ground Rail (- Blue)",    "Connect to Buck #1 OUT- (Common GND). Ties ESP32, Sensors, and Buzzer GND together.", W_GND),
        ("Bottom Breadboard Power Rail (+ Red)",  "Connect to ESP32 3V3 Pin (+3.3V). Supplies DHT22 VCC, RGB Anode (+), Level Shifter LV.", (14, 165, 233)),
        ("Bottom Breadboard Ground Rail (- Blue)","Connect to Common GND. Ties DHT22, RGB cathode, and buttons to 0V ground.", W_GND),
        ("ISOLATED WIRE HARNESS (OFF-BOARD)",     "Buck #2 OUT+ (+4.0V) and OUT- (GND) DO NOT GO ON THE BREADBOARD RAILS! Run twisted pair directly to SIM800L pins.", W_4V_GSM),
        ("SERVO POWER CONNECTOR",                 "Plug the TowerPro MG90S Red wire to Buck #1 +5V and Brown wire to GND. Place 470 µF capacitor right at connector.", (234, 88, 12)),
    ]

    br_y = bot_y + 130
    for r_title, r_desc, r_col in breadboard_rules:
        draw.rounded_rectangle([r_col_x + 20, br_y, bot_x + bot_w - 50, br_y + 88], radius=6, fill=BG_CARD, outline=(226, 232, 240), width=1)
        draw.ellipse([r_col_x + 35, br_y + 18, r_col_x + 55, br_y + 38], fill=r_col)
        draw.text((r_col_x + 70, br_y + 14), r_title, fill=TEXT_MAIN, font=f_small_bold)
        words = r_desc.split(' ')
        l1, l2 = "", ""
        for w in words:
            if len(l1 + w) < 70:
                l1 += w + " "
            else:
                l2 += w + " "
        draw.text((r_col_x + 70, br_y + 38), l1, fill=TEXT_MUTED, font=f_small)
        if l2:
            draw.text((r_col_x + 70, br_y + 58), l2, fill=TEXT_MUTED, font=f_small)
        br_y += 100

    # Verification Badge
    draw.rounded_rectangle([r_col_x + 20, bot_y + bot_h - 110, bot_x + bot_w - 50, bot_y + bot_h - 45], radius=8, fill=(236, 253, 245), outline=(16, 185, 129), width=2)
    draw.text((r_col_x + 40, bot_y + bot_h - 95), "AUDITED & CERTIFIED FOR ACADEMIC FINAL DEFENSE — SLTC RESEARCH UNIVERSITY", fill=(6, 95, 70), font=f_bold)
    draw.text((r_col_x + 40, bot_y + bot_h - 68), "Authors: Dias Adrian, AAA Aadhil, JMRA Dilshan • Faculty of Computing & Information Technology", fill=(6, 95, 70), font=f_small)

    # 6. Save Outputs
    base_dir = os.path.dirname(os.path.abspath(__file__))
    os.makedirs(base_dir, exist_ok=True)
    out_png = os.path.normpath(os.path.join(base_dir, 'xl4015_power_routing_guide.png'))
    out_jpg = os.path.normpath(os.path.join(base_dir, 'xl4015_power_routing_guide.jpg'))

    artifact_dir = os.path.normpath(r'C:\Users\adria\.gemini\antigravity\brain\0c14942f-4bad-47bf-874a-33bdb3daeaf3')
    os.makedirs(artifact_dir, exist_ok=True)
    art_png = os.path.normpath(os.path.join(artifact_dir, 'xl4015_power_routing_guide.png'))
    art_jpg = os.path.normpath(os.path.join(artifact_dir, 'xl4015_power_routing_guide.jpg'))

    img.save(out_png, 'PNG', optimize=True)
    img.save(out_jpg, 'JPEG', quality=95)
    img.save(art_png, 'PNG', optimize=True)
    img.save(art_jpg, 'JPEG', quality=95)

    print(f"XL4015 Routing Guide successfully generated:\n  {out_png}\n  {out_jpg}\n  {art_png}\n  {art_jpg}")

if __name__ == '__main__':
    generate_xl4015_guide()
