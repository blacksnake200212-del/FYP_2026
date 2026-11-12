/**
 * SDAS Telemetry to Google Sheets Synchronizer & Exporter
 * Sheet: https://docs.google.com/spreadsheets/d/1Qx9yU15Ht66sRxXjezvFSamN4StEV8ylWi5XWCFwSFw
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = "https://gpxakbveqnzqqpxvtkgf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdweGFrYnZlcW56cXFweHZ0a2dmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MzAwNjcsImV4cCI6MjEwNzQwNjA2N30.dv_53Z7HzHIl8e-5BhVBx1OYYbE2L5GhyZZkbzTvEgU";

// Optional: Paste your Google Apps Script Web App URL here after deploying:
// Example: "https://script.google.com/macros/s/AKfycby.../exec"
const GOOGLE_APPS_SCRIPT_URL = process.env.GOOGLE_SHEETS_WEBHOOK_URL || "";

async function fetchSupabaseReadings(limit = 100) {
  return new Promise((resolve, reject) => {
    const url = `${SUPABASE_URL}/rest/v1/readings?select=*&order=created_at.desc&limit=${limit}`;
    https.get(url, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // FIX: a 401/404 error body used to be turned into an empty list ("No readings found")
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`Supabase HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          return;
        }
        try {
          const json = JSON.parse(data);
          resolve(Array.isArray(json) ? json : []);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function exportCsv(readings) {
  const headers = [
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

  const rows = readings.map(r => {
    const utc = r.created_at || new Date().toISOString();
    const local = new Date(utc).toLocaleString("en-US", { timeZone: "Asia/Colombo" });
    const level = r.level_pct !== undefined ? Number(r.level_pct) : 0;
    const depthNum = (level / 100) * 3.0;
    const depth = depthNum.toFixed(2);
    const freeboard = Math.max(0, 3.0 - depthNum).toFixed(2); // FIX: no string arithmetic
    // FIX: null values from the database printed as empty cells; use ?? so null -> -1 / 0
    const s1 = r.distance_1 ?? -1;
    const s2 = r.distance_2 ?? -1;
    // FIX: "YES" was written even when both sensors had failed (-1 cm)
    const agree = (Number(s1) <= 0 && Number(s2) <= 0) ? "NO (BOTH SENSORS FAILED)" : (r.sensors_agreed ? "YES" : "NO");
    const temp = Number(r.temperature ?? 0);
    const hum = Number(r.humidity ?? 0);
    const soundSpeed = (331.4 + 0.606 * temp).toFixed(1);
    const gate = Number(r.gate_percent ?? 0);
    const angle = Math.round((gate / 100) * 180);
    // FIX: any missing/unknown mode used to be written as "ESTOP"
    const modes = ["AUTO", "MANUAL", "ESTOP"];
    const mode = modes[r.control_mode] || "UNKNOWN";
    const stages = ["NORMAL", "PRE_WARNING", "CLEAR_AREA", "DANGER", "MAINTENANCE"];
    // FIX: unknown alert codes used to be written as "NORMAL" (unsafe default)
    const alertStage = stages[r.alert_state] || "UNKNOWN";

    return [
      `"${utc}"`,
      `"${local}"`,
      `"SDAS-NODE-01"`,
      level,
      depth,
      freeboard,
      s1,
      s2,
      `"${agree}"`,
      temp,
      hum,
      soundSpeed,
      gate,
      angle,
      `"${alertStage}"`,
      `"${mode}"`,
      `"Supabase Cloud Archive"`
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const exportPath = path.join(__dirname, 'sdas_telemetry_google_sheet_export.csv');
  fs.writeFileSync(exportPath, csvContent, 'utf8');
  console.log(`\n✅ Generated CSV for Google Sheet: ${exportPath}`);
  console.log(`👉 You can drag & drop this file directly into your Google Sheet (File > Import > Upload)!\n`);
  return exportPath;
}

// FIX: this function was an empty stub and was never called, so the webhook URL did nothing.
async function postToGoogleSheets(readings, webhookUrl) {
  if (!webhookUrl) return;
  console.log(`📡 Posting ${readings.length} readings to Google Sheets Webhook...`);
  const stages = ["NORMAL", "PRE_WARNING", "CLEAR_AREA", "DANGER", "MAINTENANCE"];
  const modes = ["AUTO", "MANUAL", "EMERGENCY_STOP"];
  // Same row shape the web dashboard sends, oldest first
  const rows = readings.slice().reverse().map(r => {
    const level = Number(r.level_pct ?? 0);
    const depth = (level / 100) * 3.0;
    return {
      created_at: r.created_at,
      node_id: r.device_id || "SDAS-NODE-01",
      water_level_pct: level,
      depth_m: Number(depth.toFixed(2)),
      freeboard_m: Number(Math.max(0, 3.0 - depth).toFixed(2)),
      sensor_1_dist: r.distance_1 ?? -1,
      sensor_2_dist: r.distance_2 ?? -1,
      sensors_agreed: Boolean(r.sensors_agreed),
      temperature_c: r.temperature ?? 0,
      humidity_pct: r.humidity ?? 0,
      gate_percent: r.gate_percent ?? 0,
      alert_stage: stages[r.alert_state] || "UNKNOWN",
      control_mode: modes[r.control_mode] || "UNKNOWN",
      source: "Node Sync Script"
    };
  });
  // Node 18+ has fetch built in. Apps Script replies with a 302 redirect, which fetch follows.
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(rows)
  });
  if (!res.ok) throw new Error(`Google Sheets webhook HTTP ${res.status}`);
  console.log(`✅ Google Sheets webhook accepted ${rows.length} rows.`);
}

async function main() {
  console.log("======================================================");
  console.log("🌊 SDAS to Google Sheets Real-Time Synchronizer");
  console.log("📊 Sheet: https://docs.google.com/spreadsheets/d/1Qx9yU15Ht66sRxXjezvFSamN4StEV8ylWi5XWCFwSFw");
  console.log("======================================================\n");

  try {
    const readings = await fetchSupabaseReadings(100);
    console.log(`📥 Fetched ${readings.length} real hardware packets from Supabase.`);
    
    if (readings.length > 0) {
      exportCsv(readings);
      await postToGoogleSheets(readings, GOOGLE_APPS_SCRIPT_URL);
    } else {
      console.log("ℹ️ No readings found yet in Supabase readings table.");
    }
  } catch (err) {
    console.error("❌ Sync Error:", err.message);
    process.exitCode = 1;
  }
}

main();
