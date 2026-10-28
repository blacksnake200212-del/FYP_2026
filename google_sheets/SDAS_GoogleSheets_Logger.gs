/**
 * ============================================================================
 * Smart Dam Alerting System (SDAS) - Real-Time Telemetry Google Sheets Logger
 * Target Spreadsheet: https://docs.google.com/spreadsheets/d/1Qx9yU15Ht66sRxXjezvFSamN4StEV8ylWi5XWCFwSFw
 * Sheet ID: 1Qx9yU15Ht66sRxXjezvFSamN4StEV8ylWi5XWCFwSFw
 * ============================================================================
 * 
 * DEPLOYMENT INSTRUCTIONS (Takes ~60 seconds):
 * 1. Open your Google Sheet in browser:
 *    https://docs.google.com/spreadsheets/d/1Qx9yU15Ht66sRxXjezvFSamN4StEV8ylWi5XWCFwSFw/edit
 * 2. In the top menu, click "Extensions" > "Apps Script".
 * 3. Delete any default code in Code.gs, paste this entire file contents, and press Ctrl+S (Save).
 * 4. At the top right, click the blue "Deploy" button > "New deployment".
 * 5. Click the gear icon (⚙️) next to "Select type" and choose "Web app".
 * 6. Set:
 *    - Description: "SDAS Telemetry Logger"
 *    - Execute as: "Me"
 *    - Who has access: "Anyone" (crucial so the web dashboard and ESP32 can send data without OAuth keys).
 * 7. Click "Deploy", click "Authorize access" (choose your Google account > Advanced > Go to SDAS Logger).
 * 8. Copy the generated "Web App URL" (ends with /exec).
 * 9. Paste this Web App URL into the SDAS Web Dashboard or run tools/sync_readings_to_sheets.js!
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // Wait up to 10 seconds to handle concurrent writes safely

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Telemetry_Logs");
    
    // Create dedicated sheet tab if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet("Telemetry_Logs");
    }
    
    // Automatically construct headers if sheet is empty
    if (sheet.getLastRow() === 0) {
      var headers = [
        "Timestamp (UTC)",
        "Local Sri Lanka Time",
        "Node ID",
        "Water Level (%)",
        "Water Depth (m)",
        "Freeboard (m)",
        "Sensor 1 Dist (cm)",
        "Sensor 2 Dist (cm)",
        "Sensors Agreement",
        "Ambient Temp (°C)",
        "Relative Humidity (%)",
        "Speed of Sound (m/s)",
        "Gate Travel (%)",
        "Servo Angle (°)",
        "Alert Stage",
        "Control Mode",
        "Ingestion Source"
      ];
      
      sheet.appendRow(headers);
      
      // Blueprint styling for headers
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#0F172A");
      headerRange.setFontColor("#38BDF8");
      headerRange.setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
    }
    
    var data = {};
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      data = e.parameter;
    }
    
    // Support single packet or batch array of packets
    var records = Array.isArray(data) ? data : [data];
    var rowsToAppend = [];
    
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      var now = new Date();
      var utcTime = r.created_at || r.timestamp || now.toISOString();
      var localTime = new Date(utcTime).toLocaleString("en-US", { timeZone: "Asia/Colombo" });
      
      var levelPct = r.water_level_pct !== undefined ? Number(r.water_level_pct) : (r.level_pct !== undefined ? Number(r.level_pct) : 0);
      var depthM = r.depth_m !== undefined ? Number(r.depth_m) : Number(((levelPct / 100.0) * 3.0).toFixed(2));
      var freeboardM = r.freeboard_m !== undefined ? Number(r.freeboard_m) : Number(Math.max(0, 3.0 - depthM).toFixed(2));
      
      var s1 = r.sensor_1_dist !== undefined ? Number(r.sensor_1_dist) : (r.distance_1 !== undefined ? Number(r.distance_1) : -1);
      var s2 = r.sensor_2_dist !== undefined ? Number(r.sensor_2_dist) : (r.distance_2 !== undefined ? Number(r.distance_2) : -1);
      var agreement = r.sensors_agreed !== undefined ? (r.sensors_agreed ? "YES" : "NO") : (s1 > 0 && s2 > 0 && Math.abs(s1 - s2) <= 5.0 ? "YES" : "NO");
      
      var tempC = r.temperature_c !== undefined ? Number(r.temperature_c) : (r.temperature !== undefined ? Number(r.temperature) : 0);
      var humPct = r.humidity_pct !== undefined ? Number(r.humidity_pct) : (r.humidity !== undefined ? Number(r.humidity) : 0);
      var speedOfSound = Number((331.4 + 0.606 * tempC).toFixed(1));
      
      var gatePct = r.gate_percent !== undefined ? Number(r.gate_percent) : 0;
      var gateAngle = Math.round((gatePct / 100.0) * 180);
      
      var alertStage = r.alert_stage || r.alert_state || "NORMAL";
      var controlMode = r.control_mode || "AUTO";
      var source = r.source || "SDAS Hardware Node";
      
      rowsToAppend.push([
        utcTime,
        localTime,
        r.node_id || "SDAS-NODE-01",
        levelPct,
        depthM,
        freeboardM,
        s1,
        s2,
        agreement,
        tempC,
        humPct,
        speedOfSound,
        gatePct,
        gateAngle,
        alertStage,
        controlMode,
        source
      ]);
    }
    
    // Batch write to sheet
    if (rowsToAppend.length > 0) {
      var startRow = sheet.getLastRow() + 1;
      sheet.getRange(startRow, 1, rowsToAppend.length, rowsToAppend[0].length).setValues(rowsToAppend);
      
      // Auto-resize columns during initial records
      if (startRow <= 50) {
        for (var c = 1; c <= rowsToAppend[0].length; c++) {
          sheet.autoResizeColumn(c);
        }
      }
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      rows_added: rowsToAppend.length,
      total_rows: sheet.getLastRow(),
      spreadsheet_url: ss.getUrl()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Telemetry_Logs") || ss.getActiveSheet();
  var lastRow = sheet.getLastRow();
  
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    system: "SDAS Smart Dam Alerting System",
    sheet_id: "1Qx9yU15Ht66sRxXjezvFSamN4StEV8ylWi5XWCFwSFw",
    sheet_name: sheet.getName(),
    total_records: Math.max(0, lastRow - 1)
  })).setMimeType(ContentService.MimeType.JSON);
}
