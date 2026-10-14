import os
from PIL import Image, ImageDraw, ImageFont

def fix_schematic():
    # Load pristine original schematic
    os.system('git checkout hardware_docs/sdas_corrected_circuit_schematic.jpg')
    img_path = 'hardware_docs/sdas_corrected_circuit_schematic.jpg'
    img = Image.open(img_path).convert('RGB')
    draw = ImageDraw.Draw(img)

    # Fonts
    font_bold = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 13)
    font_title = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 15)
    font_small_bold = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 11)
    font_small = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 10)

    # ----------------------------------------------------
    # 1. FIX "3.3V Feltage" -> "3.3V Voltage" in Legend Box
    # ----------------------------------------------------
    # "3.3V Feltage" is at x: 1035..1135, y: 78..95
    draw.rectangle([1035, 78, 1135, 96], fill=(255, 255, 255))
    draw.text((1038, 79), "3.3V Voltage", fill=(0, 0, 0), font=font_small_bold)

    # ----------------------------------------------------
    # 2. EXTRACT CLEAN SERVO MOTOR ICON BEFORE OVERWRITE
    # ----------------------------------------------------
    servo_icon = img.crop((1015, 600, 1145, 715))

    # ----------------------------------------------------
    # 3. FIX TOP-RIGHT: MG996R SERVO MOTOR
    # ----------------------------------------------------
    # Clear entire top-right under the legends down to y: 310
    draw.rectangle([880, 125, 1370, 310], fill=(255, 255, 255))

    # Re-draw title
    draw.text((1150, 135), "MG996R SERVO MOTOR", fill=(0, 0, 0), font=font_title)
    draw.text((1185, 153), "(Sluice Gate)", fill=(80, 80, 80), font=font_small_bold)

    # Paste Servo Motor Icon at top right: x: 1175, y: 180
    servo_x = 1175
    servo_y = 180
    img.paste(servo_icon, (servo_x, servo_y))

    # Connect the 3 proper wires into the MG996R Servo:
    # Wire 1: +5V Rail (Red, coming from 5V rail at y: 195)
    vcc_y = 200
    draw.line([(870, vcc_y), (servo_x, vcc_y)], fill=(190, 40, 40), width=3)
    draw.text((servo_x - 68, vcc_y - 15), "VCC (+5V)", fill=(190, 40, 40), font=font_small_bold)

    # Wire 2: Signal (Orange, coming from ESP32 GPIO25 at y: 228)
    sig_y = 228
    draw.line([(870, sig_y), (980, sig_y)], fill=(215, 115, 20), width=3)
    # Resistor 330 ohm
    r_pts = [(980, sig_y), (985, sig_y - 5), (990, sig_y + 5), (995, sig_y - 5), (1000, sig_y + 5), (1005, sig_y)]
    draw.line(r_pts, fill=(0, 0, 0), width=2)
    draw.line([(1005, sig_y), (servo_x, sig_y)], fill=(215, 115, 20), width=3)
    draw.text((982, sig_y - 17), "330Ω", fill=(0, 0, 0), font=font_small)
    draw.text((servo_x - 88, sig_y + 3), "Signal (GPIO25)", fill=(215, 115, 20), font=font_small_bold)

    # Wire 3: GND (Black, to ground at y: 258)
    gnd_y = 258
    draw.line([(servo_x, gnd_y), (1070, gnd_y)], fill=(0, 0, 0), width=3)
    draw.line([(1070, gnd_y), (1070, 285)], fill=(0, 0, 0), width=3)
    # Ground symbol
    draw.line([(1060, 285), (1080, 285)], fill=(0, 0, 0), width=3)
    draw.line([(1063, 290), (1077, 290)], fill=(0, 0, 0), width=2)
    draw.line([(1067, 295), (1073, 295)], fill=(0, 0, 0), width=1)
    draw.text((1078, gnd_y - 14), "GND", fill=(0, 0, 0), font=font_small_bold)

    # ----------------------------------------------------
    # 4. FIX BOTTOM-RIGHT: RGB LED MODULE (REMOVE 2ND SERVO)
    # ----------------------------------------------------
    # Clear the duplicate servo, messy lines, and old duplicate texts
    draw.rectangle([940, 465, 1214, 765], fill=(255, 255, 255))
    draw.rectangle([1140, 620, 1375, 765], fill=(255, 255, 255))

    # The RGB LED Module icon sits at x: 1215
    led_x = 1215

    # Connect the 4 clean lines from the resistors on the left straight into the RGB LED Module:
    # 1. 3.3V Anode (+) - Cyan/Light blue (Pin 1)
    anode_y = 515
    draw.line([(870, anode_y), (led_x, anode_y)], fill=(50, 160, 220), width=3)
    draw.text((led_x - 90, anode_y - 15), "3.3V (Anode +)", fill=(20, 120, 180), font=font_small_bold)

    # 2. Red (-) - GPIO32 with 220 ohm resistor (Pin 2)
    red_y = 545
    draw.line([(870, 620), (1000, 620)], fill=(190, 30, 30), width=3)
    draw.line([(1000, 620), (1030, red_y)], fill=(190, 30, 30), width=3)
    draw.line([(1030, red_y), (led_x, red_y)], fill=(190, 30, 30), width=3)
    draw.text((led_x - 85, red_y - 14), "Red (GPIO32)", fill=(180, 20, 20), font=font_small_bold)

    # 3. Green (-) - GPIO33 with 100 ohm resistor (Pin 3)
    green_y = 575
    draw.line([(870, 665), (1020, 665)], fill=(30, 140, 50), width=3)
    draw.line([(1020, 665), (1050, green_y)], fill=(30, 140, 50), width=3)
    draw.line([(1050, green_y), (led_x, green_y)], fill=(30, 140, 50), width=3)
    draw.text((led_x - 95, green_y - 14), "Green (GPIO33)", fill=(20, 120, 40), font=font_small_bold)

    # 4. Blue (-) - GPIO13 with 100 ohm resistor (Pin 4)
    blue_y = 605
    draw.line([(870, 710), (1040, 710)], fill=(30, 70, 190), width=3)
    draw.line([(1040, 710), (1070, blue_y)], fill=(30, 70, 190), width=3)
    draw.line([(1070, blue_y), (led_x, blue_y)], fill=(30, 70, 190), width=3)
    draw.text((led_x - 90, blue_y - 14), "Blue (GPIO13)", fill=(20, 50, 160), font=font_small_bold)

    # Clean Legend Card in bottom-right corner
    leg_x = 1145
    leg_y = 625
    leg_w = 220
    leg_h = 135
    draw.rounded_rectangle([leg_x, leg_y, leg_x + leg_w, leg_y + leg_h], radius=8, fill=(252, 253, 255), outline=(160, 175, 195), width=2)

    draw.text((leg_x + 10, leg_y + 8), "RGB STATUS LED (1 Total)", fill=(15, 23, 42), font=font_small_bold)
    draw.line([(leg_x + 10, leg_y + 24), (leg_x + leg_w - 10, leg_y + 24)], fill=(210, 220, 230), width=1)
    draw.text((leg_x + 10, leg_y + 28), "Type: 4-Pin Common Anode (+)", fill=(70, 70, 70), font=font_small)
    draw.text((leg_x + 10, leg_y + 44), "● Anode (+) -> 3.3V Rail", fill=(20, 120, 180), font=font_small_bold)
    draw.text((leg_x + 10, leg_y + 60), "● Red (-) -> GPIO32 (220 Ω)", fill=(180, 20, 20), font=font_small_bold)
    draw.text((leg_x + 10, leg_y + 76), "● Green (-) -> GPIO33 (100 Ω)", fill=(20, 120, 40), font=font_small_bold)
    draw.text((leg_x + 10, leg_y + 92), "● Blue (-) -> GPIO13 (100 Ω)", fill=(20, 50, 160), font=font_small_bold)
    draw.text((leg_x + 10, leg_y + 112), "Note: Active LOW Logic Control", fill=(80, 80, 80), font=font_small)

    # Save outputs
    out_jpg = 'hardware_docs/sdas_corrected_circuit_schematic.jpg'
    out_png = 'hardware_docs/sdas_corrected_circuit_schematic.png'
    out_brain = 'C:/Users/adria/.gemini/antigravity/brain/0c14942f-4bad-47bf-874a-33bdb3daeaf3/sdas_circuit_diagram_1791839333607.jpg'

    img.save(out_jpg, 'JPEG', quality=98)
    img.save(out_png, 'PNG')
    img.save(out_brain, 'JPEG', quality=98)

    print("Schematic successfully fixed and saved to:", out_jpg, out_png, out_brain)

if __name__ == '__main__':
    fix_schematic()
