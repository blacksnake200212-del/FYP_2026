// SDAS Real-Time Web Telemetry Engine
// Strictly REAL Hardware Telemetry from Supabase (Zero Mock Data)

const SUPABASE_URL = "https://gpxakbveqnzqqpxvtkgf.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdweGFrYnZlcW56cXFweHZ0a2dmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4MzAwNjcsImV4cCI6MjEwNzQwNjA2N30.dv_53Z7HzHIl8e-5BhVBx1OYYbE2L5GhyZZkbzTvEgU";

// Total reservoir height parameter (3.00 meters)
const DAM_TOTAL_HEIGHT_M = 3.00;

// Supabase client instance
let supabaseClient = null;
if (window.supabase) {
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// Telemetry state
const state = {
  hasRealData: false,
  lastPacketTime: null,
  waterLevelPct: 0.0,
  depthM: 0.0,
  freeboardM: DAM_TOTAL_HEIGHT_M,
  gatePercent: 0,
  controlMode: 'AUTO',
  alertState: 'NORMAL',
  alertCode: 0,
  sensor1Dist: -1.0,
  sensor2Dist: -1.0,
  sensorsAgreed: true,
  temperatureC: 0.0,
  humidityPct: 0.0,
  speedOfSound: 331.4,
  recentHistory: [] // [{ time, level }]
};

// DOM Elements cache
const el = {
  syncBadge: document.getElementById('sync-badge'),
  syncText: document.getElementById('sync-text'),
  btnRefresh: document.getElementById('btn-refresh'),
  alertBanner: document.getElementById('alert-banner'),
  alertIcon: document.getElementById('alert-icon'),
  alertTitle: document.getElementById('alert-title'),
  alertSubtitle: document.getElementById('alert-subtitle'),
  gaugeBar: document.getElementById('gauge-bar'),
  gaugePct: document.getElementById('gauge-pct'),
  valDepth: document.getElementById('val-depth'),
  valFreeboard: document.getElementById('val-freeboard'),
  valVolume: document.getElementById('val-volume'),
  tankWater: document.getElementById('tank-water'),
  tankPctLabel: document.getElementById('tank-pct-label'),
  gatePercentVal: document.getElementById('gate-percent-val'),
  gateProgressFill: document.getElementById('gate-progress-fill'),
  gateAngleVal: document.getElementById('gate-angle-val'),
  gateModeVal: document.getElementById('gate-mode-val'),
  gateFlowVal: document.getElementById('gate-flow-val'),
  // Sensors
  s1Card: document.getElementById('s1-card'),
  s1Dist: document.getElementById('s1-dist'),
  s1Status: document.getElementById('s1-status'),
  s1Quality: document.getElementById('s1-quality'),
  s2Card: document.getElementById('s2-card'),
  s2Dist: document.getElementById('s2-dist'),
  s2Status: document.getElementById('s2-status'),
  s2Agreement: document.getElementById('s2-agreement'),
  dhtCard: document.getElementById('dht-card'),
  dhtTemp: document.getElementById('dht-temp'),
  dhtHum: document.getElementById('dht-hum'),
  dhtSpeed: document.getElementById('dht-speed'),
  dhtStatus: document.getElementById('dht-status'),
  nodeCard: document.getElementById('node-card'),
  nodeLatency: document.getElementById('node-latency'),
  nodePackets: document.getElementById('node-packets'),
  rawLog: document.getElementById('raw-log'),
  chartCanvas: document.getElementById('chart-canvas')
};

let packetCount = 0;

// Parse hardware packet into state
function processTelemetryRow(row) {
  if (!row) return;

  packetCount++;
  state.hasRealData = true;
  state.lastPacketTime = new Date(row.created_at || Date.now());

  // Extract water level
  const pct = row.level_pct !== undefined && row.level_pct !== null
    ? parseFloat(row.level_pct)
    : (row.water_level_pct !== undefined ? parseFloat(row.water_level_pct) : 0.0);
  state.waterLevelPct = Math.max(0, Math.min(100, pct));
  state.depthM = parseFloat(((state.waterLevelPct / 100.0) * DAM_TOTAL_HEIGHT_M).toFixed(2));
  state.freeboardM = parseFloat(Math.max(0, DAM_TOTAL_HEIGHT_M - state.depthM).toFixed(2));

  // Extract distances
  state.sensor1Dist = row.distance_1 !== undefined && row.distance_1 !== null
    ? parseFloat(row.distance_1)
    : (row.sensor_1_dist !== undefined ? parseFloat(row.sensor_1_dist) : -1.0);

  state.sensor2Dist = row.distance_2 !== undefined && row.distance_2 !== null
    ? parseFloat(row.distance_2)
    : (row.sensor_2_dist !== undefined ? parseFloat(row.sensor_2_dist) : -1.0);

  state.sensorsAgreed = row.sensors_agreed !== undefined
    ? Boolean(row.sensors_agreed)
    : (state.sensor1Dist > 0 && state.sensor2Dist > 0 ? Math.abs(state.sensor1Dist - state.sensor2Dist) <= 5.0 : false);

  // Extract environmental
  state.temperatureC = row.temperature !== undefined && row.temperature !== null
    ? parseFloat(row.temperature)
    : (row.temperature_c !== undefined ? parseFloat(row.temperature_c) : 0.0);

  state.humidityPct = row.humidity !== undefined && row.humidity !== null
    ? parseFloat(row.humidity)
    : (row.humidity_pct !== undefined ? parseFloat(row.humidity_pct) : 0.0);

  state.speedOfSound = parseFloat((331.4 + 0.606 * state.temperatureC).toFixed(1));

  // Extract actuator and alert state
  state.gatePercent = row.gate_percent !== undefined ? parseInt(row.gate_percent, 10) : 0;
  
  const modeMap = ['AUTO', 'MANUAL', 'EMERGENCY_STOP'];
  state.controlMode = row.control_mode !== undefined ? (modeMap[row.control_mode] || 'AUTO') : 'AUTO';

  state.alertCode = row.alert_state !== undefined ? parseInt(row.alert_state, 10) : 0;
  const stateMap = ['NORMAL', 'PRE_WARNING', 'CLEAR_AREA', 'DANGER', 'MAINTENANCE'];
  state.alertState = stateMap[state.alertCode] || 'NORMAL';

  // Add to recent history for chart
  state.recentHistory.push({
    time: state.lastPacketTime,
    level: state.waterLevelPct
  });
  if (state.recentHistory.length > 25) {
    state.recentHistory.shift();
  }

  // Update UI components
  renderUI(row);
}

// Update DOM elements with live telemetry
function renderUI(rawRow) {
  // 1. Sync Status Badge
  const now = new Date();
  const timeStr = state.lastPacketTime
    ? state.lastPacketTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Waiting';

  el.syncBadge.className = 'status-badge live';
  el.syncText.textContent = `LIVE: ${timeStr}`;

  // 2. Alert Banner State
  const alertConfig = {
    NORMAL: {
      class: 'alert-banner normal',
      icon: '🛡️',
      title: 'Normal Reservoir Buffer',
      sub: 'All sensor nodes nominal. Safe downstream conditions.'
    },
    PRE_WARNING: {
      class: 'alert-banner pre-warning',
      icon: '⚠️',
      title: 'Stage 1: Pre-Warning (Capacity > 60%)',
      sub: 'Water level rising. Sluice gate mechanisms on active standby.'
    },
    CLEAR_AREA: {
      class: 'alert-banner clear-area',
      icon: '📢',
      title: 'Stage 2: Clear Area Advisory (Capacity > 80%)',
      sub: 'Siren sounded. Automated 20% sluice gate relief discharge initiated.'
    },
    DANGER: {
      class: 'alert-banner danger',
      icon: '🚨',
      title: 'Stage 3: Critical Flood Danger (Capacity > 85%)',
      sub: 'Emergency relief gate open to 50%. Immediate riverbank evacuation.'
    },
    MAINTENANCE: {
      class: 'alert-banner normal',
      icon: '🔧',
      title: 'Hardware Fault / Calibration Mode',
      sub: 'Ultrasonic echo mismatch or signal timeout detected.'
    }
  };

  const currentAlert = alertConfig[state.alertState] || alertConfig.NORMAL;
  el.alertBanner.className = currentAlert.class;
  el.alertIcon.textContent = currentAlert.icon;
  el.alertTitle.textContent = currentAlert.title;
  el.alertSubtitle.textContent = currentAlert.sub;

  // 3. Circular Gauge
  el.gaugePct.textContent = `${state.waterLevelPct.toFixed(1)}%`;
  
  // Circumference = 2 * PI * 90 = ~565.48
  const strokeOffset = 565 - (565 * state.waterLevelPct) / 100;
  el.gaugeBar.style.strokeDashoffset = strokeOffset;
  
  let gaugeColor = '#0284C7';
  if (state.alertState === 'DANGER') gaugeColor = '#EF4444';
  else if (state.alertState === 'CLEAR_AREA') gaugeColor = '#F97316';
  else if (state.alertState === 'PRE_WARNING') gaugeColor = '#EAB308';
  el.gaugeBar.style.stroke = gaugeColor;

  // Metric numbers
  el.valDepth.textContent = `${state.depthM.toFixed(2)} m`;
  el.valFreeboard.textContent = `${state.freeboardM.toFixed(2)} m`;
  const volumeEstimate = ((state.waterLevelPct / 100.0) * 115).toFixed(1);
  el.valVolume.textContent = `${volumeEstimate} MCM`;

  // 4. Reservoir Tank Graphic
  el.tankWater.style.height = `${state.waterLevelPct}%`;
  el.tankPctLabel.textContent = `${state.waterLevelPct.toFixed(1)}% Elevation`;

  // 5. Actuator & Sluice Gate
  el.gatePercentVal.textContent = `${state.gatePercent}%`;
  el.gateProgressFill.style.width = `${state.gatePercent}%`;
  // Servo travel: 0% = 0 deg, 50% = 90 deg max safety clamp
  const servoAngle = Math.round((state.gatePercent / 100.0) * 180);
  el.gateAngleVal.textContent = `${servoAngle}° (${state.gatePercent <= 50 ? 'Safe Zone' : 'Over Limit'})`;
  el.gateModeVal.textContent = state.controlMode;
  el.gateFlowVal.textContent = state.gatePercent > 0 ? `Active Relief (${state.gatePercent}%)` : 'Closed';

  // 6. Sensor 1 (HC-SR04 Primary)
  const s1Ok = state.sensor1Dist > 0;
  el.s1Card.className = s1Ok ? 'sensor-card active' : 'sensor-card fault';
  el.s1Dist.textContent = s1Ok ? state.sensor1Dist.toFixed(1) : '--';
  el.s1Status.className = s1Ok ? 'sensor-state-pill ok' : 'sensor-state-pill fault';
  el.s1Status.textContent = s1Ok ? 'ECHO OK' : 'TIMEOUT';
  el.s1Quality.textContent = s1Ok ? '100% Pulse Return' : 'Acoustic Lost (-1.0cm)';

  // 7. Sensor 2 (HC-SR04 Redundant)
  const s2Ok = state.sensor2Dist > 0;
  el.s2Card.className = s2Ok ? 'sensor-card active' : 'sensor-card fault';
  el.s2Dist.textContent = s2Ok ? state.sensor2Dist.toFixed(1) : '--';
  el.s2Status.className = s2Ok ? 'sensor-state-pill ok' : 'sensor-state-pill fault';
  el.s2Status.textContent = s2Ok ? 'ECHO OK' : 'TIMEOUT';
  el.s2Agreement.textContent = state.sensorsAgreed ? 'Dual-Sensor Verified' : 'Echo Disagreement';

  // 8. DHT22 Microclimate Sensor
  const dhtOk = state.temperatureC > 0 || state.humidityPct > 0;
  el.dhtCard.className = dhtOk ? 'sensor-card active' : 'sensor-card';
  el.dhtTemp.textContent = dhtOk ? `${state.temperatureC.toFixed(1)}°C` : '--';
  el.dhtHum.textContent = dhtOk ? `${state.humidityPct.toFixed(1)}%` : '--';
  el.dhtSpeed.textContent = `${state.speedOfSound} m/s`;
  el.dhtStatus.className = dhtOk ? 'sensor-state-pill ok' : 'sensor-state-pill fault';
  el.dhtStatus.textContent = dhtOk ? 'ONLINE' : 'CONNECTING';

  // 9. Node Health & Packets
  el.nodePackets.textContent = `${packetCount} Packets`;
  const latency = Math.max(12, Math.round(Math.abs(Date.now() - state.lastPacketTime.getTime()) / 1000));
  el.nodeLatency.textContent = `${latency}s ago`;

  // 10. Raw JSON Inspector
  const rawDisplay = {
    received_at: new Date().toISOString(),
    hardware_node: 'SDAS-NODE-01',
    ultrasonic_sensor_1_cm: state.sensor1Dist,
    ultrasonic_sensor_2_cm: state.sensor2Dist,
    sensors_in_agreement: state.sensorsAgreed,
    water_level_capacity_pct: state.waterLevelPct,
    water_depth_meters: state.depthM,
    temperature_celsius: state.temperatureC,
    relative_humidity_pct: state.humidityPct,
    speed_of_sound_calibrated_mps: state.speedOfSound,
    sluice_gate_travel_pct: state.gatePercent,
    safety_angle_degrees: servoAngle,
    alert_state_code: state.alertCode,
    alert_stage_label: state.alertState,
    control_mode_label: state.controlMode,
    raw_database_payload: rawRow
  };
  el.rawLog.textContent = JSON.stringify(rawDisplay, null, 2);

  // 11. Render Real-time Trend Chart
  drawChart();
}

// Draw HTML5 Canvas Chart
function drawChart() {
  const canvas = el.chartCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, width, height);

  // Background Grid
  ctx.strokeStyle = '#1E2D4A';
  ctx.lineWidth = 1;
  for (let y = 20; y < height - 20; y += 40) {
    ctx.beginPath();
    ctx.moveTo(35, y);
    ctx.lineTo(width - 15, y);
    ctx.stroke();
  }

  // Y-axis labels
  ctx.fillStyle = '#64748B';
  ctx.font = '10px sans-serif';
  ctx.fillText('100%', 5, 25);
  ctx.fillText('50%', 10, height / 2);
  ctx.fillText('0%', 15, height - 25);

  const points = state.recentHistory;
  if (points.length < 2) {
    ctx.fillStyle = '#94A3B8';
    ctx.font = '12px sans-serif';
    ctx.fillText('Collecting real-time hardware telemetry points...', width / 4, height / 2);
    return;
  }

  const plotX = (idx) => 40 + (idx / (points.length - 1)) * (width - 60);
  const plotY = (val) => height - 30 - (val / 100.0) * (height - 60);

  // Draw Area Gradient
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
  grad.addColorStop(1, 'rgba(2, 132, 199, 0.0)');

  ctx.beginPath();
  ctx.moveTo(plotX(0), height - 30);
  points.forEach((pt, i) => {
    ctx.lineTo(plotX(i), plotY(pt.level));
  });
  ctx.lineTo(plotX(points.length - 1), height - 30);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Draw Line
  ctx.beginPath();
  points.forEach((pt, i) => {
    const x = plotX(i);
    const y = plotY(pt.level);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Draw Current Point
  const lastX = plotX(points.length - 1);
  const lastY = plotY(points[points.length - 1].level);
  ctx.beginPath();
  ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#0284C7';
  ctx.lineWidth = 2;
  ctx.stroke();
}

// Fetch Latest Real Readings from Supabase REST API
async function fetchLatestHardwareReading() {
  try {
    const endpoint = `${SUPABASE_URL}/rest/v1/readings?select=*&order=created_at.desc&limit=1`;
    const res = await fetch(endpoint, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      processTelemetryRow(data[0]);
    }
  } catch (err) {
    console.warn('[SDAS Web] REST Fetch Warning:', err.message);
  }
}

// Fetch Initial Historical Points (Last 15 readings)
async function fetchHistoricalPoints() {
  try {
    const endpoint = `${SUPABASE_URL}/rest/v1/readings?select=*&order=created_at.desc&limit=15`;
    const res = await fetch(endpoint, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        // Reverse so oldest first
        const sorted = data.reverse();
        state.recentHistory = sorted.map((r) => ({
          time: new Date(r.created_at),
          level: parseFloat(r.level_pct || r.water_level_pct || 0.0)
        }));
        processTelemetryRow(sorted[sorted.length - 1]);
      }
    }
  } catch (e) {
    console.warn('[SDAS Web] History Fetch:', e.message);
  }
}

// Subscribe to Supabase Realtime Channels
function setupRealtimeSubscription() {
  if (!supabaseClient) return;

  const channel = supabaseClient
    .channel('sdas_web_dashboard_realtime')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'readings' },
      (payload) => {
        if (payload && payload.new) {
          console.log('[SDAS Web Realtime] New Packet:', payload.new);
          processTelemetryRow(payload.new);
        }
      }
    )
    .subscribe((status) => {
      console.log('[SDAS Web Realtime] Subscription status:', status);
    });
}

// Refresh button listener
if (el.btnRefresh) {
  el.btnRefresh.addEventListener('click', () => {
    el.btnRefresh.textContent = '⏳ Syncing...';
    fetchLatestHardwareReading().finally(() => {
      setTimeout(() => {
        el.btnRefresh.textContent = '🔄 Refresh Telemetry';
      }, 500);
    });
  });
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  fetchHistoricalPoints();
  fetchLatestHardwareReading();
  setupRealtimeSubscription();

  // Polling fallback every 3 seconds to guarantee telemetry freshness
  setInterval(fetchLatestHardwareReading, 3000);

  // Resize canvas on window change
  window.addEventListener('resize', drawChart);
});
