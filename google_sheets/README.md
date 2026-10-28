# SDAS Google Sheets Real-Time Telemetry Bridge

**Target Google Sheet:**  
[https://docs.google.com/spreadsheets/d/1Qx9yU15Ht66sRxXjezvFSamN4StEV8ylWi5XWCFwSFw/edit?usp=sharing](https://docs.google.com/spreadsheets/d/1Qx9yU15Ht66sRxXjezvFSamN4StEV8ylWi5XWCFwSFw/edit?usp=sharing)  
**Spreadsheet ID:** `1Qx9yU15Ht66sRxXjezvFSamN4StEV8ylWi5XWCFwSFw`

---

## ⚡ Option 1: Live Real-Time Streaming via Google Apps Script (60-Second Setup)

Every live reading from the ESP32 hardware and Supabase will automatically append as a new row in your Google Sheet in real time.

### Step 1: Open Apps Script in Your Sheet
1. Open your Google Sheet in your web browser:
   `https://docs.google.com/spreadsheets/d/1Qx9yU15Ht66sRxXjezvFSamN4StEV8ylWi5XWCFwSFw/edit`
2. Click **Extensions** in the top menu &rarr; **Apps Script**.

### Step 2: Paste the Logger Script
1. Delete any default placeholder code inside `Code.gs`.
2. Open [`google_sheets/SDAS_GoogleSheets_Logger.gs`](./SDAS_GoogleSheets_Logger.gs), copy the entire code, and paste it into the editor.
3. Press **Ctrl + S** (or click the Save floppy disk icon).

### Step 3: Deploy as a Web App
1. Click the blue **Deploy** button at the top right &rarr; **New deployment**.
2. Click the gear icon (⚙️) next to *Select type* and select **Web app**.
3. Configure the settings:
   * **Description:** `SDAS Telemetry Logger`
   * **Execute as:** `Me (your email)`
   * **Who has access:** `Anyone` *(Crucial: allows the Web Dashboard & ESP32 to post without complex OAuth tokens)*
4. Click **Deploy**.
5. Click **Authorize access** &rarr; select your Google account &rarr; click **Advanced** &rarr; click **Go to SDAS Logger (unsafe)** &rarr; click **Allow**.
6. Copy the generated **Web App URL** (looks like `https://script.google.com/macros/s/AKfycb.../exec`).

### Step 4: Paste into the SDAS Web Dashboard
1. Open your SDAS Web Dashboard (`http://localhost:3000` or on your Netlify URL).
2. Look at the **"Google Sheets Telemetry Sync"** card (under the Packet Inspector).
3. Paste the URL into the **"Google Apps Script Web App URL"** field and click **Save**.
4. That's it! Every live packet received will now instantly append to your Google Sheet!

---

## 📦 Option 2: Instant One-Click Historical Import (No Script Needed)

If you just want all the real historical sensor readings from Supabase loaded into your Google Sheet right now:

1. A pre-formatted CSV has been generated for you:
   `tools/sdas_telemetry_google_sheet_export.csv`
2. In your Google Sheet, click **File** &rarr; **Import** &rarr; **Upload**.
3. Drag and drop the file `tools/sdas_telemetry_google_sheet_export.csv`.
4. Select **"Replace current sheet"** (or **"Insert new sheet"**) and click **Import data**.
5. All 100 historical readings (timestamps, water level %, ultrasonic distances, temperature, humidity, gate travel, etc.) will populate immediately!

---

## 🛠️ Option 3: Terminal Batch Sync Script

You can also run the automated Node.js sync script at any time:

```bash
node tools/sync_readings_to_sheets.js
```
This fetches the latest telemetry records from Supabase REST and updates the export CSV.
