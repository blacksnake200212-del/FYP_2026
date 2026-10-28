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
  chartSvg: document.getElementById('chart-svg')
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
  const now = Date.now();
  const packetAgeMs = state.lastPacketTime ? (now - state.lastPacketTime.getTime()) : Infinity;
  const isOnline = state.hasRealData && packetAgeMs <= 30000; // Real hardware active within last 30s
  const timeStr = state.lastPacketTime
    ? state.lastPacketTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Waiting';

  // 1. Sync Status Badge (Strictly checks real hardware presence)
  if (isOnline) {
    el.syncBadge.className = 'status-badge live';
    el.syncText.textContent = `🟢 LIVE: ${timeStr}`;
  } else {
    const ageSec = Math.round(packetAgeMs / 1000);
    const ageStr = ageSec < 60 ? `${ageSec}s ago` : `${Math.round(ageSec / 60)}m ago`;
    el.syncBadge.className = 'status-badge offline';
    el.syncText.textContent = state.hasRealData ? `🔴 OFFLINE (${ageStr})` : `🔴 DISCONNECTED (Awaiting Node)`;
  }

  // 2. Alert Banner State
  if (!isOnline) {
    el.alertBanner.className = 'alert-banner pre-warning';
    el.alertIcon.textContent = '🔌';
    el.alertTitle.textContent = 'HARDWARE NODE DISCONNECTED';
    el.alertSubtitle.textContent = state.hasRealData
      ? `Node SDAS-NODE-01 is currently offline (last packet at ${timeStr}). Power on ESP32 & connect hotspot to resume live feed.`
      : 'Waiting for initial telemetry packet from SDAS-NODE-01...';
  } else {
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
  }

  // 3. Circular Gauge
  el.gaugePct.textContent = `${state.waterLevelPct.toFixed(1)}%`;
  
  // Circumference = 2 * PI * 90 = ~565.48
  const strokeOffset = 565 - (565 * state.waterLevelPct) / 100;
  el.gaugeBar.style.strokeDashoffset = strokeOffset;
  
  let gaugeColor = '#0284C7';
  if (!isOnline) gaugeColor = '#64748B';
  else if (state.alertState === 'DANGER') gaugeColor = '#EF4444';
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
  el.tankPctLabel.textContent = isOnline
    ? `${state.waterLevelPct.toFixed(1)}% Elevation`
    : `${state.waterLevelPct.toFixed(1)}% (Offline Snapshot)`;

  // 5. Actuator & Sluice Gate
  el.gatePercentVal.textContent = `${state.gatePercent}%`;
  el.gateProgressFill.style.width = `${state.gatePercent}%`;
  // Servo travel: 0% = 0 deg, 50% = 90 deg max safety clamp
  const servoAngle = Math.round((state.gatePercent / 100.0) * 180);
  el.gateAngleVal.textContent = `${servoAngle}° (${state.gatePercent <= 50 ? 'Safe Zone' : 'Over Limit'})`;
  el.gateModeVal.textContent = state.controlMode;
  el.gateFlowVal.textContent = state.gatePercent > 0 ? `Active Relief (${state.gatePercent}%)` : 'Closed';

  // 6. Sensor 1 (HC-SR04 Primary)
  const s1Ok = isOnline && state.sensor1Dist > 0;
  el.s1Card.className = s1Ok ? 'sensor-card active' : 'sensor-card fault';
  el.s1Dist.textContent = state.sensor1Dist > 0 ? state.sensor1Dist.toFixed(1) : '--';
  el.s1Status.className = s1Ok ? 'sensor-state-pill ok' : 'sensor-state-pill fault';
  el.s1Status.textContent = isOnline ? (state.sensor1Dist > 0 ? 'ECHO OK' : 'TIMEOUT') : 'OFFLINE';
  el.s1Quality.textContent = isOnline ? (state.sensor1Dist > 0 ? '100% Pulse Return' : 'Acoustic Lost (-1.0cm)') : 'Hardware Not Connected';

  // 7. Sensor 2 (HC-SR04 Redundant)
  const s2Ok = isOnline && state.sensor2Dist > 0;
  el.s2Card.className = s2Ok ? 'sensor-card active' : 'sensor-card fault';
  el.s2Dist.textContent = state.sensor2Dist > 0 ? state.sensor2Dist.toFixed(1) : '--';
  el.s2Status.className = s2Ok ? 'sensor-state-pill ok' : 'sensor-state-pill fault';
  el.s2Status.textContent = isOnline ? (state.sensor2Dist > 0 ? 'ECHO OK' : 'TIMEOUT') : 'OFFLINE';
  el.s2Agreement.textContent = isOnline ? (state.sensorsAgreed ? 'Dual-Sensor Verified' : 'Echo Disagreement') : 'Hardware Not Connected';

  // 8. DHT22 Microclimate Sensor
  const dhtOk = isOnline && (state.temperatureC > 0 || state.humidityPct > 0);
  el.dhtCard.className = dhtOk ? 'sensor-card active' : 'sensor-card fault';
  el.dhtTemp.textContent = state.temperatureC > 0 ? `${state.temperatureC.toFixed(1)}°C` : '--';
  el.dhtHum.textContent = state.humidityPct > 0 ? `${state.humidityPct.toFixed(1)}%` : '--';
  el.dhtSpeed.textContent = `${state.speedOfSound} m/s`;
  el.dhtStatus.className = dhtOk ? 'sensor-state-pill ok' : 'sensor-state-pill fault';
  el.dhtStatus.textContent = isOnline ? 'ONLINE' : 'OFFLINE';

  // 9. Node Health & Packets
  el.nodePackets.textContent = `${packetCount} Packets`;
  const ageSec = Math.round(packetAgeMs / 1000);
  el.nodeLatency.textContent = isOnline ? `${Math.max(1, ageSec)}s ago` : `Offline (${ageSec}s ago)`;
  el.nodeCard.className = isOnline ? 'sensor-card active' : 'sensor-card fault';

  // 10. Raw JSON Inspector
  const rawDisplay = {
    hardware_status: isOnline ? 'CONNECTED_STREAMING' : 'OFFLINE_DISCONNECTED',
    hardware_node: 'SDAS-NODE-01',
    packet_age_seconds: isFinite(ageSec) ? ageSec : null,
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

// Watchdog timer running every second to catch hardware disconnect immediately
function updateHardwareWatchdog() {
  if (!state.lastPacketTime) return;
  const now = Date.now();
  const packetAgeMs = now - state.lastPacketTime.getTime();
  const isOnline = state.hasRealData && packetAgeMs <= 30000;
  const timeStr = state.lastPacketTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (!isOnline) {
    const ageSec = Math.round(packetAgeMs / 1000);
    const ageStr = ageSec < 60 ? `${ageSec}s ago` : `${Math.round(ageSec / 60)}m ago`;
    el.syncBadge.className = 'status-badge offline';
    el.syncText.textContent = `🔴 OFFLINE (${ageStr})`;
    el.nodeLatency.textContent = `Offline (${ageStr})`;

    el.s1Status.className = 'sensor-state-pill fault';
    el.s1Status.textContent = 'OFFLINE';
    el.s1Card.className = 'sensor-card fault';

    el.s2Status.className = 'sensor-state-pill fault';
    el.s2Status.textContent = 'OFFLINE';
    el.s2Card.className = 'sensor-card fault';

    el.dhtStatus.className = 'sensor-state-pill fault';
    el.dhtStatus.textContent = 'OFFLINE';
    el.dhtCard.className = 'sensor-card fault';

    el.nodeCard.className = 'sensor-card fault';

    el.alertBanner.className = 'alert-banner pre-warning';
    el.alertIcon.textContent = '🔌';
    el.alertTitle.textContent = 'HARDWARE NODE DISCONNECTED';
    el.alertSubtitle.textContent = `Node SDAS-NODE-01 last transmitted telemetry at ${timeStr} (${ageStr}). Power on ESP32 & connect hotspot.`;
  }
}

// Draw Real-Time Telemetry SVG Stream
function drawChart() {
  const points = state.recentHistory;
  const areaPath = document.getElementById('chart-area-path');
  const linePath = document.getElementById('chart-line-path');
  const activePoint = document.getElementById('chart-point-active');
  const emptyText = document.getElementById('chart-empty-text');

  if (!areaPath || !linePath) return;

  if (points.length < 2) {
    if (emptyText) {
      emptyText.style.display = 'block';
      emptyText.textContent = state.hasRealData
        ? `Hardware telemetry recorded (${state.waterLevelPct.toFixed(1)}%). Waiting for next packet...`
        : 'Connecting to real-time hardware telemetry stream...';
    }
    areaPath.setAttribute('d', '');
    linePath.setAttribute('d', '');
    if (activePoint) activePoint.setAttribute('cx', '-20');
    return;
  }

  if (emptyText) emptyText.style.display = 'none';

  const svgWidth = 700;
  const svgHeight = 220;
  const startX = 60;
  const endX = svgWidth - 25;
  const startY = svgHeight - 35; // 0% baseline
  const endY = 20; // 100% line
  const chartHeight = startY - endY;

  const getX = (i) => startX + (i / (points.length - 1)) * (endX - startX);
  const getY = (val) => startY - (Math.max(0, Math.min(100, val)) / 100.0) * chartHeight;

  let pathD = '';
  points.forEach((pt, idx) => {
    const x = getX(idx).toFixed(1);
    const y = getY(pt.level).toFixed(1);
    if (idx === 0) {
      pathD += `M ${x} ${y}`;
    } else {
      pathD += ` L ${x} ${y}`;
    }
  });

  linePath.setAttribute('d', pathD);

  // Area path: start at first point, go along line, down to 0% baseline, back to start
  const firstX = getX(0).toFixed(1);
  const lastX = getX(points.length - 1).toFixed(1);
  const areaD = `${pathD} L ${lastX} ${startY} L ${firstX} ${startY} Z`;
  areaPath.setAttribute('d', areaD);

  // Update active point marker on latest point
  if (activePoint) {
    const latestPt = points[points.length - 1];
    activePoint.setAttribute('cx', lastX);
    activePoint.setAttribute('cy', getY(latestPt.level).toFixed(1));
  }
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

  // Watchdog timer checking hardware freshness every second
  setInterval(updateHardwareWatchdog, 1000);

  // Polling fallback every 3 seconds to guarantee telemetry freshness
  setInterval(fetchLatestHardwareReading, 3000);

  // Resize canvas on window change
  window.addEventListener('resize', drawChart);
});
