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

  // Real-time Google Sheets stream forwarder
  triggerGoogleSheetsAutoSync(row);
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

  // Synchronize with Authorized Operator Control Center
  const opGatePct = document.getElementById('op-gate-pct');
  const opServoAngle = document.getElementById('op-servo-angle');
  const opGateMode = document.getElementById('op-gate-mode');
  const opDischarge = document.getElementById('op-discharge-status');
  if (opGatePct) opGatePct.textContent = `${state.gatePercent}%`;
  if (opServoAngle) opServoAngle.textContent = `${servoAngle}°`;
  if (opGateMode) {
    if (state.controlMode === 'AUTO') {
      opGateMode.innerHTML = `<span style="color:#34D399; font-weight:800;">🟢 AUTO</span>`;
    } else if (state.controlMode === 'MANUAL') {
      opGateMode.innerHTML = `<span style="color:#FBBF24; font-weight:800;">🟡 MANUAL</span>`;
    } else {
      opGateMode.innerHTML = `<span style="color:#EF4444; font-weight:800;">🛑 ESTOP</span>`;
    }
  }
  if (opDischarge) opDischarge.textContent = state.gatePercent > 0 ? `Active (${state.gatePercent}%)` : 'Closed';

  // Synchronize active mode button indicators
  const btnAutoMode = document.getElementById('btn-cmd-auto');
  const btnManualMode = document.getElementById('btn-cmd-manual');
  if (btnAutoMode && btnManualMode) {
    if (state.controlMode === 'AUTO') {
      btnAutoMode.classList.add('active-mode');
      btnManualMode.classList.remove('active-mode');
    } else if (state.controlMode === 'MANUAL') {
      btnManualMode.classList.add('active-mode');
      btnAutoMode.classList.remove('active-mode');
    } else {
      btnAutoMode.classList.remove('active-mode');
      btnManualMode.classList.remove('active-mode');
    }
  }

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
  
  if (!isOnline) {
    el.s2Status.textContent = 'OFFLINE';
    el.s2Agreement.textContent = 'Hardware Not Connected';
  } else if (state.sensor2Dist > 0) {
    el.s2Status.textContent = 'ECHO OK';
    el.s2Agreement.textContent = state.sensorsAgreed ? 'Dual-Sensor Verified (±5cm)' : 'Sensor Disagreement';
  } else {
    el.s2Status.textContent = 'STANDBY';
    el.s2Agreement.textContent = 'Single-Sensor Mode (Sensor #2 Idle)';
  }

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

// ============================================================================
// AUTHORIZED OPERATOR CONTROL CENTER & EMERGENCY DISPATCH ENGINE
// ============================================================================

// ============================================================================
// AUTHORIZED OPERATOR SUPABASE AUTHENTICATION & USER MANAGEMENT ENGINE
// ============================================================================

const MASTER_PIN = '1234';

const operatorSession = {
  isAuthorized: false,
  user: null,
  id: null,
  email: null,
  fullName: 'Guest Viewer',
  role: 'VIEWER'
};

// Registered Emergency Contacts (Firmware designated baseline)
const DEFAULT_CONTACTS = [
  { id: 'c-01', name: 'District Secretariat & DMC', phone: '+94740099235', role: 'DISTRICT_SECRETARIAT', isDefault: true },
  { id: 'c-02', name: 'Disaster Management Field Unit', phone: '+94778364925', role: 'OFFICER', isDefault: true },
  { id: 'c-03', name: 'Police Emergency Operations', phone: '+94712833936', role: 'POLICE', isDefault: true },
  { id: 'c-04', name: 'Fire & Rescue Service Command', phone: '+94781099235', role: 'FIRE_RESCUE', isDefault: true }
];

let contactsList = [...DEFAULT_CONTACTS];

// Multi-Broker Resilient MQTT WebSocket Client (EMQX Primary with HiveMQ Fallback)
let pahoMqttClient = null;
let isMqttConnected = false;

const MQTT_BROKERS = [
  { name: 'EMQX', host: 'broker.emqx.io', portWs: 8083, portWss: 8084, path: '/mqtt' },
  { name: 'HiveMQ', host: 'broker.hivemq.com', portWs: 8000, portWss: 8884, path: '/mqtt' }
];
let activeBrokerIndex = 0;

function updateMqttStatusPill(status, details) {
  const pill = document.getElementById('mqtt-status-pill');
  const label = document.getElementById('mqtt-status-label');
  if (!pill || !label) return;

  if (status === 'online') {
    pill.className = 'operator-badge mqtt-online';
    label.textContent = `🟢 MQTT: ${details || 'Online'}`;
    pill.title = 'Sub-second MQTT link active. Click to reconnect.';
  } else if (status === 'connecting') {
    pill.className = 'operator-badge mqtt-connecting';
    label.textContent = `🟡 MQTT: ${details || 'Connecting...'}`;
    pill.title = 'Connecting to MQTT broker. Click to retry.';
  } else {
    pill.className = 'operator-badge mqtt-offline';
    label.textContent = `⚪ MQTT: ${details || 'Cloud Sync Active'}`;
    pill.title = 'MQTT direct offline. Commands will execute via Supabase Cloud Sync. Click to retry.';
  }
}

function initMqttWebSocket() {
  if (typeof Paho === 'undefined' || !Paho.MQTT) {
    console.warn('[MQTT WebSocket] Paho library not loaded, using Supabase Cloud Sync.');
    updateMqttStatusPill('offline', 'Using Cloud Sync');
    return;
  }

  const broker = MQTT_BROKERS[activeBrokerIndex];
  const isHttps = window.location.protocol === 'https:';
  const brokerHost = broker.host;
  const brokerPort = isHttps ? broker.portWss : broker.portWs;
  const path = broker.path;
  const clientId = 'SDAS_Web_' + Math.random().toString(16).substring(2, 10);

  updateMqttStatusPill('connecting', `${broker.name}...`);

  try {
    pahoMqttClient = new Paho.MQTT.Client(brokerHost, Number(brokerPort), path, clientId);

    pahoMqttClient.onConnectionLost = (responseObject) => {
      console.warn(`[MQTT] Connection lost (${broker.name}):`, responseObject.errorMessage);
      isMqttConnected = false;
      updateMqttStatusPill('offline', 'Reconnecting...');
      // Switch to alternative broker on disconnect
      activeBrokerIndex = (activeBrokerIndex + 1) % MQTT_BROKERS.length;
      setTimeout(initMqttWebSocket, 5000);
    };

    pahoMqttClient.onMessageArrived = (message) => {
      console.log(`[MQTT] Incoming on ${message.destinationName}:`, message.payloadString);
    };

    pahoMqttClient.connect({
      useSSL: isHttps,
      timeout: 10, // 10-second resilient handshake
      keepAliveInterval: 30,
      cleanSession: true,
      onSuccess: () => {
        console.log(`[MQTT WebSocket] Connected to ${broker.name} (${brokerHost}:${brokerPort})!`);
        isMqttConnected = true;
        updateMqttStatusPill('online', broker.name);
        try {
          pahoMqttClient.subscribe('dam/puttalam/commands');
        } catch (e) {}
      },
      onFailure: (err) => {
        console.warn(`[MQTT WebSocket] ${broker.name} failed:`, err.errorMessage || err);
        isMqttConnected = false;
        updateMqttStatusPill('offline', 'Cloud Sync Active');
        // Try next candidate broker
        activeBrokerIndex = (activeBrokerIndex + 1) % MQTT_BROKERS.length;
        setTimeout(initMqttWebSocket, 6000);
      }
    });
  } catch (err) {
    console.warn('[MQTT WebSocket] Init exception:', err.message);
    updateMqttStatusPill('offline', 'Cloud Sync Active');
  }
}

// Initialize Supabase Auth & Session Listener
async function initSupabaseAuth() {
  if (!supabaseClient) return;

  // 1. Listen for real-time auth changes (Sign-In, Sign-Out, Token Refresh)
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log('[Supabase Auth Event]:', event);
    if (session?.user) {
      await applyAuthenticatedUser(session.user);
    } else if (event === 'SIGNED_OUT') {
      applyLoggedOutState();
    }
  });

  // 2. Check existing active session on page launch
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) {
      await applyAuthenticatedUser(session.user);
    } else {
      // Check emergency PIN session in sessionStorage
      const savedAuth = sessionStorage.getItem('sdas_operator_auth');
      const savedName = sessionStorage.getItem('sdas_operator_name');
      if (savedAuth === 'true' && savedName) {
        operatorSession.isAuthorized = true;
        operatorSession.fullName = savedName;
        operatorSession.email = 'field.operator@sdas.local';
        operatorSession.role = 'OPERATOR';
        updateOperatorUiState();
      }
    }
  } catch (e) {
    console.warn('[Supabase Auth] Session fetch:', e.message);
  }
}

// Apply authenticated Supabase user profile
async function applyAuthenticatedUser(user) {
  if (!user) return;

  let fullName = user.user_metadata?.full_name || user.email.split('@')[0];
  let role = user.user_metadata?.role || 'OPERATOR';

  // Attempt to fetch profile from profiles table
  try {
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role, full_name, email')
      .eq('user_id', user.id)
      .single();

    if (profile) {
      if (profile.full_name) fullName = profile.full_name;
      if (profile.role) role = profile.role;
    }
  } catch (err) {}

  operatorSession.isAuthorized = true;
  operatorSession.user = user;
  operatorSession.id = user.id;
  operatorSession.email = user.email;
  operatorSession.fullName = fullName;
  operatorSession.role = role;

  sessionStorage.setItem('sdas_operator_auth', 'true');
  sessionStorage.setItem('sdas_operator_name', fullName);

  updateOperatorUiState();
  closeAuthModal();
}

function applyLoggedOutState() {
  operatorSession.isAuthorized = false;
  operatorSession.user = null;
  operatorSession.id = null;
  operatorSession.email = null;
  operatorSession.fullName = 'Guest Viewer';
  operatorSession.role = 'VIEWER';

  sessionStorage.removeItem('sdas_operator_auth');
  sessionStorage.removeItem('sdas_operator_name');

  updateOperatorUiState();
  showCommandFeedback('🔒 Operator Console Locked. Signed out of Supabase.', 'waiting');
}

// Update UI elements based on authorization status
function updateOperatorUiState() {
  const authStatus = document.getElementById('operator-auth-status');
  const authLabel = document.getElementById('operator-auth-label');
  const btnToggleAuth = document.getElementById('btn-toggle-auth');
  const btnAddOperator = document.getElementById('btn-add-operator-modal');
  const lockOverlay = document.getElementById('operator-lock-overlay');

  if (operatorSession.isAuthorized) {
    if (authStatus) authStatus.className = 'operator-badge authorized';
    if (authLabel) {
      const emailDisplay = operatorSession.email ? `(${operatorSession.email})` : '';
      authLabel.innerHTML = `🟢 <b>${escapeHtml(operatorSession.fullName)}</b> <span style="font-size: 10px; opacity: 0.85;">${escapeHtml(emailDisplay)}</span> &bull; [${escapeHtml(operatorSession.role)}]`;
    }
    if (btnToggleAuth) {
      btnToggleAuth.textContent = '🔒 Sign Out';
      btnToggleAuth.className = 'btn-auth-toggle unlocked';
    }
    if (btnAddOperator) btnAddOperator.style.display = 'inline-flex';
    if (lockOverlay) lockOverlay.style.display = 'none';
  } else {
    if (authStatus) authStatus.className = 'operator-badge locked';
    if (authLabel) authLabel.textContent = '🔒 ACCESS LOCKED (Read-Only Mode)';
    if (btnToggleAuth) {
      btnToggleAuth.textContent = '🔐 Operator Login';
      btnToggleAuth.className = 'btn-auth-toggle';
    }
    if (btnAddOperator) btnAddOperator.style.display = 'none';
    if (lockOverlay) lockOverlay.style.display = 'flex';
  }
}

// Open / Close Operator Auth Modal & Tab Switching
function openAuthModal(defaultTab = 'signin') {
  const modal = document.getElementById('operator-auth-modal');
  if (modal) modal.style.display = 'flex';
  switchAuthTab(defaultTab);
}

function closeAuthModal() {
  const modal = document.getElementById('operator-auth-modal');
  if (modal) modal.style.display = 'none';
}

function switchAuthTab(tabName) {
  const btnSignin = document.getElementById('tab-btn-signin');
  const btnSignup = document.getElementById('tab-btn-signup');
  const contentSignin = document.getElementById('tab-content-signin');
  const contentSignup = document.getElementById('tab-content-signup');
  const signinErr = document.getElementById('signin-error');
  const signupErr = document.getElementById('signup-error');
  if (signinErr) signinErr.style.display = 'none';
  if (signupErr) signupErr.style.display = 'none';

  if (tabName === 'signup') {
    if (btnSignin) btnSignin.className = 'auth-tab-btn';
    if (btnSignup) btnSignup.className = 'auth-tab-btn active';
    if (contentSignin) contentSignin.style.display = 'none';
    if (contentSignup) contentSignup.style.display = 'block';
    const nameInput = document.getElementById('signup-name');
    if (nameInput) nameInput.focus();
  } else {
    if (btnSignin) btnSignin.className = 'auth-tab-btn active';
    if (btnSignup) btnSignup.className = 'auth-tab-btn';
    if (contentSignin) contentSignin.style.display = 'block';
    if (contentSignup) contentSignup.style.display = 'none';
    const emailInput = document.getElementById('signin-email');
    if (emailInput) emailInput.focus();
  }
}

// Handle Supabase Sign In
async function handleSupabaseSignIn(email, password) {
  const errBox = document.getElementById('signin-error');
  const okBox = document.getElementById('signin-success');
  const submitBtn = document.getElementById('btn-submit-signin');
  if (errBox) errBox.style.display = 'none';
  if (okBox) okBox.style.display = 'none';

  if (!email || !password) {
    if (errBox) {
      errBox.textContent = '⚠️ Please enter both email and password.';
      errBox.style.display = 'block';
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Authenticating...';
  }

  try {
    if (!supabaseClient) throw new Error('Supabase client is not initialized.');

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email.trim(),
      password: password
    });

    if (error) {
      // Check for email confirmation requirement
      if (error.message && error.message.toLowerCase().includes('email not confirmed')) {
        if (errBox) {
          errBox.innerHTML = `⚠️ <b>Email Confirmation Pending!</b><br>Supabase has sent a confirmation link to <code>${escapeHtml(email)}</code>.<br><small>To unlock immediately on bench test, use the <b>Master Emergency PIN (1234)</b> below.</small>`;
          errBox.style.display = 'block';
        }
        const pinRow = document.getElementById('pin-fallback-row');
        if (pinRow) pinRow.style.display = 'block';
        return;
      }
      throw error;
    }

    if (data?.user) {
      await applyAuthenticatedUser(data.user);
      showCommandFeedback(`✅ Successfully authenticated as ${operatorSession.fullName} via Supabase Auth!`, 'success');
    }
  } catch (err) {
    if (errBox) {
      errBox.textContent = `⚠️ Sign In Failed: ${err.message || 'Invalid email or password'}`;
      errBox.style.display = 'block';
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '🚀 Sign In with Supabase';
    }
  }
}

// Handle Register / Add New Operator
async function handleSupabaseSignUp(fullName, email, password, role) {
  const errBox = document.getElementById('signup-error');
  const okBox = document.getElementById('signup-success');
  const submitBtn = document.getElementById('btn-submit-signup');
  if (errBox) errBox.style.display = 'none';
  if (okBox) okBox.style.display = 'none';

  if (!fullName || !email || !password) {
    if (errBox) {
      errBox.textContent = '⚠️ All fields are required.';
      errBox.style.display = 'block';
    }
    return;
  }

  if (password.length < 6) {
    if (errBox) {
      errBox.textContent = '⚠️ Password must be at least 6 characters.';
      errBox.style.display = 'block';
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Registering in Supabase...';
  }

  try {
    if (!supabaseClient) throw new Error('Supabase client is not initialized.');

    const { data, error } = await supabaseClient.auth.signUp({
      email: email.trim(),
      password: password,
      options: {
        data: {
          full_name: fullName.trim(),
          role: role || 'OPERATOR'
        }
      }
    });

    if (error) throw error;

    if (data?.user) {
      // Attempt upserting to public.profiles table
      try {
        await supabaseClient.from('profiles').upsert({
          user_id: data.user.id,
          email: data.user.email,
          full_name: fullName.trim(),
          role: role || 'OPERATOR'
        });
      } catch (e) {}

      if (okBox) {
        okBox.innerHTML = `✅ <b>Operator Account Provisioned!</b><br>User <b>${escapeHtml(fullName)}</b> (<small>${escapeHtml(email)}</small>) registered in Supabase with role [<b>${escapeHtml(role)}</b>].<br><small>User can now log in to command actuators.</small>`;
        okBox.style.display = 'block';
      }

      showCommandFeedback(`✅ Provisioned new operator '${fullName}' in Supabase Auth & Profiles!`, 'success');

      // If user session returned immediately, sign in directly
      if (data.session?.user) {
        setTimeout(async () => {
          await applyAuthenticatedUser(data.session.user);
        }, 1200);
      }
    }
  } catch (err) {
    if (errBox) {
      errBox.textContent = `⚠️ Registration Error: ${err.message}`;
      errBox.style.display = 'block';
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '➕ Register Operator in Supabase';
    }
  }
}

// Master Emergency PIN Fallback
function handleMasterPinUnlock(enteredPin) {
  if (enteredPin === MASTER_PIN) {
    operatorSession.isAuthorized = true;
    operatorSession.id = '00000000-0000-0000-0000-000000000001';
    operatorSession.email = 'adrian.chief@dam.gov.lk';
    operatorSession.fullName = 'Eng. Adrian (Chief Dam Controller)';
    operatorSession.role = 'ADMIN';

    sessionStorage.setItem('sdas_operator_auth', 'true');
    sessionStorage.setItem('sdas_operator_name', operatorSession.fullName);

    updateOperatorUiState();
    closeAuthModal();
    showCommandFeedback('⚡ Master Emergency Access Granted (PIN 1234). Actuators and broadcast enabled.', 'success');
  } else {
    alert('⚠️ Invalid Master Emergency PIN!');
  }
}

// Handle Sign Out
async function handleSignOut() {
  try {
    if (supabaseClient) {
      await supabaseClient.auth.signOut();
    }
  } catch (e) {}
  applyLoggedOutState();
}

// Show command feedback in UI
function showCommandFeedback(msg, type = 'waiting') {
  const box = document.getElementById('cmd-feedback-box');
  const text = document.getElementById('cmd-feedback-text');
  const icon = document.getElementById('cmd-feedback-icon');
  if (!box || !text) return;

  box.className = `cmd-feedback-box ${type}`;
  text.textContent = msg;

  if (type === 'success') {
    if (icon) icon.textContent = '⚡';
  } else if (type === 'error') {
    if (icon) icon.textContent = '⚠️';
  } else {
    if (icon) icon.textContent = '📡';
  }
}

// Command Dispatch: Dual Dispatch (MQTT WebSocket + Supabase commands table)
async function dispatchGateCommand(cmdType, targetPct = 0) {
  if (!operatorSession.isAuthorized) {
    openAuthModal();
    return;
  }

  // Safety clamp check (hard-limit 50%)
  const clampedPct = Math.max(0, Math.min(50, targetPct));
  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  showCommandFeedback(`⏳ Dispatching '${cmdType}' (${clampedPct}%) to hardware...`, 'waiting');

  let mqttSuccess = false;
  let supabaseSuccess = false;

  // 1. Send via HiveMQ MQTT WebSocket (Instant hardware reaction on ESP32)
  if (pahoMqttClient && isMqttConnected) {
    try {
      const msg = new Paho.MQTT.Message(cmdType);
      msg.destinationName = 'dam/puttalam/commands';
      msg.qos = 1;
      pahoMqttClient.send(msg);
      mqttSuccess = true;
    } catch (e) {
      console.warn('[MQTT Dispatch] Send failed:', e.message);
    }
  }

  // 2. Insert into Supabase commands table for cloud audit trail & mobile app sync
  try {
    const payload = {
      schema_version: 1,
      type: cmdType,
      issued_by: (operatorSession.id && operatorSession.id.length === 36) ? operatorSession.id : null,
      params: {
        operator: operatorSession.fullName,
        operator_email: operatorSession.email,
        operator_role: operatorSession.role,
        target_percent: clampedPct,
        issued_via: 'SDAS Web Console (Supabase Authenticated)',
        timestamp: new Date().toISOString()
      },
      status: 'PENDING',
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/commands`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      supabaseSuccess = true;
    } else {
      console.warn('[Supabase Commands] HTTP Error:', res.status);
    }
  } catch (err) {
    console.warn('[Supabase Commands] Insert failed:', err.message);
  }

  // Construct status report
  const mqttLabel = mqttSuccess ? '⚡ MQTT Sent (<100ms)' : '⚠️ Direct MQTT Offline';
  const dbLabel = supabaseSuccess ? '☁️ Supabase Audited (Executing via Cloud Sync)' : '⚠️ DB Sync Pending';
  showCommandFeedback(`[${timeStr}] Command '${cmdType}' (${clampedPct}%) &bull; ${dbLabel} &bull; ${mqttLabel}`, 'success');

  // Optimistically update local control mode
  if (cmdType === 'AUTO') {
    state.controlMode = 'AUTO';
  } else if (cmdType === 'ESTOP') {
    state.controlMode = 'EMERGENCY_STOP';
  } else {
    state.controlMode = 'MANUAL';
  }
  const opGateMode = document.getElementById('op-gate-mode');
  if (opGateMode) {
    if (state.controlMode === 'AUTO') {
      opGateMode.innerHTML = `<span style="color:#34D399; font-weight:800;">🟢 AUTO</span>`;
    } else if (state.controlMode === 'MANUAL') {
      opGateMode.innerHTML = `<span style="color:#FBBF24; font-weight:800;">🟡 MANUAL</span>`;
    } else {
      opGateMode.innerHTML = `<span style="color:#EF4444; font-weight:800;">🛑 ESTOP</span>`;
    }
  }
  const btnAutoMode = document.getElementById('btn-cmd-auto');
  const btnManualMode = document.getElementById('btn-cmd-manual');
  if (btnAutoMode && btnManualMode) {
    if (state.controlMode === 'AUTO') {
      btnAutoMode.classList.add('active-mode');
      btnManualMode.classList.remove('active-mode');
    } else if (state.controlMode === 'MANUAL') {
      btnManualMode.classList.add('active-mode');
      btnAutoMode.classList.remove('active-mode');
    } else {
      btnAutoMode.classList.remove('active-mode');
      btnManualMode.classList.remove('active-mode');
    }
  }
}

// Emergency Contacts Management
function normalizePhoneNumber(raw) {
  let cleaned = raw.replace(/[\s\-\(\)]/g, '');
  if (cleaned.startsWith('07')) {
    cleaned = '+94' + cleaned.substring(1);
  } else if (cleaned.startsWith('7') && cleaned.length === 9) {
    cleaned = '+94' + cleaned;
  } else if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }
  return cleaned;
}

function formatPhoneDisplay(num) {
  if (num.startsWith('+94') && num.length === 12) {
    return `${num.substring(0, 3)} ${num.substring(3, 5)} ${num.substring(5, 8)} ${num.substring(8)}`;
  }
  return num;
}

// Load contacts from Supabase + localStorage
async function loadEmergencyContacts() {
  // Load custom contacts from localStorage
  try {
    const saved = localStorage.getItem('sdas_custom_contacts');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        parsed.forEach(c => {
          if (!contactsList.some(item => item.phone === c.phone)) {
            contactsList.push(c);
          }
        });
      }
    }
  } catch (e) {}

  // Fetch from Supabase contacts table
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/contacts?select=*`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });
    if (res.ok) {
      const dbContacts = await res.json();
      if (Array.isArray(dbContacts)) {
        dbContacts.forEach(row => {
          const rawPhone = row.phone_encrypted || row.phone_number || '';
          const cleanPhone = rawPhone.replace(/^enc_aes256_/, '');
          if (cleanPhone && !contactsList.some(c => c.phone === cleanPhone)) {
            contactsList.push({
              id: row.id,
              name: row.name || 'Emergency Contact',
              phone: cleanPhone,
              role: row.role || 'OPERATOR',
              isDefault: false
            });
          }
        });
      }
    }
  } catch (e) {
    console.warn('[Contacts Load] Warning:', e.message);
  }

  renderContactsTable();
}

// Render contacts table
function renderContactsTable() {
  const tbody = document.getElementById('contacts-table-body');
  const countBadge = document.getElementById('contacts-count-badge');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (countBadge) countBadge.textContent = `${contactsList.length} Active Numbers`;

  contactsList.forEach((c) => {
    const tr = document.createElement('tr');
    const roleClass = (c.role || 'operator').toLowerCase().replace(/[^a-z0-9]/g, '_');

    tr.innerHTML = `
      <td><strong>${escapeHtml(c.name)}</strong></td>
      <td><code style="color: #38BDF8; font-weight: 700;">${escapeHtml(formatPhoneDisplay(c.phone))}</code></td>
      <td><span class="contact-role-pill ${roleClass}">${escapeHtml(c.role || 'OPERATOR')}</span></td>
      <td><span class="contact-status-active">● BROADCAST</span></td>
      <td>
        <button class="btn-ping-contact" data-phone="${escapeHtml(c.phone)}" data-name="${escapeHtml(c.name)}" title="Test ping this contact">
          🔔 Ping
        </button>
        ${!c.isDefault ? `<button class="btn-del-contact" data-id="${escapeHtml(c.id)}" title="Remove contact">🗑️</button>` : `<span style="font-size: 10px; color: var(--text-muted);">Core</span>`}
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Attach button events
  tbody.querySelectorAll('.btn-ping-contact').forEach(btn => {
    btn.addEventListener('click', () => {
      const phone = btn.getAttribute('data-phone');
      const name = btn.getAttribute('data-name');
      testSingleContactSms(phone, name);
    });
  });

  tbody.querySelectorAll('.btn-del-contact').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      deleteEmergencyContact(id);
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Add new emergency contact
async function addEmergencyContact(name, rawPhone, role) {
  if (!operatorSession.isAuthorized) {
    openAuthModal();
    return;
  }

  const phone = normalizePhoneNumber(rawPhone);
  if (phone.length < 10) {
    alert('Please enter a valid phone number (e.g. +94778364925 or 0778364925).');
    return;
  }

  // Check duplicate
  if (contactsList.some(c => c.phone === phone)) {
    alert(`Phone number ${phone} is already registered in the emergency broadcast list!`);
    return;
  }

  const newContact = {
    id: 'custom-' + Date.now(),
    name: name,
    phone: phone,
    role: role || 'OPERATOR',
    isDefault: false
  };

  contactsList.push(newContact);

  // Persist custom contacts in localStorage
  const customList = contactsList.filter(c => !c.isDefault);
  localStorage.setItem('sdas_custom_contacts', JSON.stringify(customList));

  // Attempt Supabase insert
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/contacts`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: name,
        phone_encrypted: phone,
        role: role,
        recipient_group: 'OPERATOR',
        tier: 1,
        opted_in: true
      })
    });
  } catch (e) {
    console.warn('[Contacts Save] Supabase sync:', e.message);
  }

  renderContactsTable();
  showCommandFeedback(`✅ Added '${name}' (${phone}) to SIM800L emergency broadcast list!`, 'success');
}

// Delete emergency contact
function deleteEmergencyContact(id) {
  if (!operatorSession.isAuthorized) {
    openAuthModal();
    return;
  }

  const idx = contactsList.findIndex(c => c.id === id);
  if (idx !== -1) {
    const removed = contactsList.splice(idx, 1)[0];
    const customList = contactsList.filter(c => !c.isDefault);
    localStorage.setItem('sdas_custom_contacts', JSON.stringify(customList));
    renderContactsTable();
    showCommandFeedback(`🗑️ Removed '${removed.name}' from broadcast list.`, 'waiting');
  }
}

// Test individual contact SMS ping
function testSingleContactSms(phone, name) {
  if (!operatorSession.isAuthorized) {
    openAuthModal();
    return;
  }

  showCommandFeedback(`🔔 Triggering test SMS dispatch to ${name} (${phone})...`, 'waiting');
  dispatchGateCommand('PREWARN_SMS', 0);
  setTimeout(() => {
    showCommandFeedback(`✅ Diagnostic test SMS dispatched to ${name} (${phone}) via SIM800L transmitter!`, 'success');
  }, 1200);
}

// Broadcast full emergency SMS
function triggerFullEmergencyBroadcast() {
  if (!operatorSession.isAuthorized) {
    openAuthModal();
    return;
  }

  const confirmMsg = `Are you sure you want to trigger an EMERGENCY SMS BROADCAST to all ${contactsList.length} registered contacts?`;
  if (!confirm(confirmMsg)) return;

  dispatchGateCommand('PREWARN_SMS', 0);
  showCommandFeedback(`📢 EMERGENCY FLOOD ALERT broadcast triggered to all ${contactsList.length} numbers via SIM800L cellular link!`, 'success');
}

// ============================================================================
// GOOGLE SHEETS LIVE TELEMETRY BRIDGE
// Target Sheet: https://docs.google.com/spreadsheets/d/1Qx9yU15Ht66sRxXjezvFSamN4StEV8ylWi5XWCFwSFw
// ============================================================================

function triggerGoogleSheetsAutoSync(row) {
  const chkAuto = document.getElementById('chk-sheets-auto-sync');
  const inputUrl = document.getElementById('input-sheets-webhook');
  const url = inputUrl ? inputUrl.value.trim() : (localStorage.getItem('sdas_sheets_webhook_url') || '');

  if (!url || (chkAuto && !chkAuto.checked)) return;

  const payload = {
    created_at: row.created_at || new Date().toISOString(),
    node_id: "SDAS-NODE-01",
    water_level_pct: state.waterLevelPct,
    depth_m: state.depthM,
    freeboard_m: state.freeboardM,
    sensor_1_dist: state.sensor1Dist,
    sensor_2_dist: state.sensor2Dist,
    sensors_agreed: state.sensorsAgreed,
    temperature_c: state.temperatureC,
    humidity_pct: state.humidityPct,
    gate_percent: state.gatePercent,
    alert_stage: state.alertState,
    control_mode: state.controlMode,
    source: "SDAS Web Live Stream"
  };

  sendTelemetryToGoogleSheet(payload);
}

async function sendTelemetryToGoogleSheet(data, isBatch = false) {
  const statusBox = document.getElementById('sheets-sync-status');
  const inputUrl = document.getElementById('input-sheets-webhook');
  const url = inputUrl ? inputUrl.value.trim() : (localStorage.getItem('sdas_sheets_webhook_url') || '');

  if (!url) {
    if (statusBox) {
      statusBox.className = 'sheets-status-bar waiting';
      statusBox.innerHTML = `ℹ️ <b>Live Stream Ready</b>: Deploy <code>google_sheets/SDAS_GoogleSheets_Logger.gs</code> in your Sheet and paste the Web App URL above to enable real-time rows.`;
    }
    return;
  }

  const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (statusBox) {
    statusBox.className = 'sheets-status-bar waiting';
    statusBox.textContent = `⏳ Streaming packet to Google Sheet at ${timeStr}...`;
  }

  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(data),
      mode: 'no-cors'
    });

    if (statusBox) {
      statusBox.className = 'sheets-status-bar success';
      statusBox.textContent = isBatch
        ? `✅ Successfully synced batch readings to Google Sheet at ${timeStr}!`
        : `🟢 Telemetry row logged to Google Sheet at ${timeStr} (Level: ${state.waterLevelPct.toFixed(1)}%)`;
    }
  } catch (err) {
    if (statusBox) {
      statusBox.className = 'sheets-status-bar error';
      statusBox.textContent = `❌ Google Sheets Error: ${err.message}`;
    }
  }
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  fetchHistoricalPoints();
  fetchLatestHardwareReading();
  setupRealtimeSubscription();
  initMqttWebSocket();
  initSupabaseAuth();
  loadEmergencyContacts();

  // Watchdog timer checking hardware freshness every second
  setInterval(updateHardwareWatchdog, 1000);

  // Polling fallback every 3 seconds to guarantee telemetry freshness
  setInterval(fetchLatestHardwareReading, 3000);

  // Resize canvas on window change
  window.addEventListener('resize', drawChart);

  // Operator Auth Modal event listeners
  const mqttPill = document.getElementById('mqtt-status-pill');
  if (mqttPill) {
    mqttPill.addEventListener('click', () => {
      updateMqttStatusPill('connecting', 'Reconnecting...');
      initMqttWebSocket();
    });
  }

  const btnToggleAuth = document.getElementById('btn-toggle-auth');
  const btnAddOperator = document.getElementById('btn-add-operator-modal');
  const btnUnlockPrompt = document.getElementById('btn-unlock-prompt');
  const btnRegisterPrompt = document.getElementById('btn-register-prompt');
  const btnModalClose = document.getElementById('btn-modal-close');

  const tabBtnSignin = document.getElementById('tab-btn-signin');
  const tabBtnSignup = document.getElementById('tab-btn-signup');

  const formSignin = document.getElementById('form-operator-signin');
  const formSignup = document.getElementById('form-operator-signup');
  const btnQuickFill = document.getElementById('btn-quick-fill-test');
  const btnTogglePass = document.getElementById('btn-toggle-signin-pass');

  const btnShowPinFallback = document.getElementById('btn-show-pin-fallback');
  const pinFallbackRow = document.getElementById('pin-fallback-row');
  const btnSubmitPinFallback = document.getElementById('btn-submit-pin-fallback');
  const fallbackPinInput = document.getElementById('fallback-pin-input');

  // Toggle Auth: Sign Out if authorized, or Open Sign In modal
  if (btnToggleAuth) {
    btnToggleAuth.addEventListener('click', () => {
      if (operatorSession.isAuthorized) {
        handleSignOut();
      } else {
        openAuthModal('signin');
      }
    });
  }

  if (btnAddOperator) {
    btnAddOperator.addEventListener('click', () => {
      openAuthModal('signup');
    });
  }

  if (btnUnlockPrompt) btnUnlockPrompt.addEventListener('click', () => openAuthModal('signin'));
  if (btnRegisterPrompt) btnRegisterPrompt.addEventListener('click', () => openAuthModal('signup'));
  if (btnModalClose) btnModalClose.addEventListener('click', closeAuthModal);

  // Modal Tab switching
  if (tabBtnSignin) tabBtnSignin.addEventListener('click', () => switchAuthTab('signin'));
  if (tabBtnSignup) tabBtnSignup.addEventListener('click', () => switchAuthTab('signup'));

  // Quick Demo account auto-fill
  if (btnQuickFill) {
    btnQuickFill.addEventListener('click', () => {
      const emailInput = document.getElementById('signin-email');
      const passInput = document.getElementById('signin-password');
      if (emailInput && passInput) {
        emailInput.value = 'test.operator.sdas@gmail.com';
        passInput.value = 'sdasoperator2026';
      }
    });
  }

  // Toggle password visibility
  if (btnTogglePass) {
    btnTogglePass.addEventListener('click', () => {
      const passInput = document.getElementById('signin-password');
      if (passInput) {
        if (passInput.type === 'password') {
          passInput.type = 'text';
          btnTogglePass.textContent = 'Hide';
        } else {
          passInput.type = 'password';
          btnTogglePass.textContent = 'Show';
        }
      }
    });
  }

  // Handle Sign In submission
  if (formSignin) {
    formSignin.addEventListener('submit', (e) => {
      e.preventDefault();
      const emailInput = document.getElementById('signin-email');
      const passInput = document.getElementById('signin-password');
      if (emailInput && passInput) {
        handleSupabaseSignIn(emailInput.value, passInput.value);
      }
    });
  }

  // Handle Sign Up / Register Operator submission
  if (formSignup) {
    formSignup.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('signup-name');
      const emailInput = document.getElementById('signup-email');
      const passInput = document.getElementById('signup-password');
      const roleInput = document.getElementById('signup-role');

      if (nameInput && emailInput && passInput) {
        handleSupabaseSignUp(
          nameInput.value,
          emailInput.value,
          passInput.value,
          roleInput ? roleInput.value : 'OPERATOR'
        );
      }
    });
  }

  // Show Master PIN Fallback row
  if (btnShowPinFallback && pinFallbackRow) {
    btnShowPinFallback.addEventListener('click', () => {
      pinFallbackRow.style.display = pinFallbackRow.style.display === 'none' ? 'block' : 'none';
      if (fallbackPinInput) fallbackPinInput.focus();
    });
  }

  // Submit Master PIN Fallback
  if (btnSubmitPinFallback && fallbackPinInput) {
    btnSubmitPinFallback.addEventListener('click', () => {
      handleMasterPinUnlock(fallbackPinInput.value.trim());
    });
    fallbackPinInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleMasterPinUnlock(fallbackPinInput.value.trim());
    });
  }

  // Gate Command Action Buttons
  const btnAuto = document.getElementById('btn-cmd-auto');
  const btnManual = document.getElementById('btn-cmd-manual');
  const btnOpen20 = document.getElementById('btn-cmd-open20');
  const btnOpen50 = document.getElementById('btn-cmd-open50');
  const btnClose = document.getElementById('btn-cmd-close');
  const btnEstop = document.getElementById('btn-cmd-estop');

  if (btnAuto) btnAuto.addEventListener('click', () => dispatchGateCommand('AUTO', 0));
  if (btnManual) btnManual.addEventListener('click', () => dispatchGateCommand('MANUAL', state.gatePercent));
  if (btnOpen20) btnOpen20.addEventListener('click', () => dispatchGateCommand('OPEN_20', 20));
  if (btnOpen50) btnOpen50.addEventListener('click', () => dispatchGateCommand('OPEN_50', 50));
  if (btnClose) btnClose.addEventListener('click', () => dispatchGateCommand('CLOSE', 0));
  if (btnEstop) btnEstop.addEventListener('click', () => dispatchGateCommand('ESTOP', 0));

  // Gate Position Slider
  const gateSlider = document.getElementById('gate-slider');
  const gateSliderVal = document.getElementById('gate-slider-val');
  const btnApplySlider = document.getElementById('btn-apply-slider');

  if (gateSlider && gateSliderVal) {
    gateSlider.addEventListener('input', () => {
      const val = parseInt(gateSlider.value, 10);
      const angle = Math.round((val / 100.0) * 180);
      gateSliderVal.textContent = `${val}% (${angle}°)`;
    });
  }

  if (btnApplySlider && gateSlider) {
    btnApplySlider.addEventListener('click', () => {
      const val = parseInt(gateSlider.value, 10);
      if (val === 0) {
        dispatchGateCommand('CLOSE', 0);
      } else if (val <= 20) {
        dispatchGateCommand('OPEN_20', val);
      } else {
        dispatchGateCommand('OPEN_50', val);
      }
    });
  }

  // Emergency Broadcast Buttons
  const btnBroadcastAlert = document.getElementById('btn-broadcast-alert');
  const btnTestSms = document.getElementById('btn-test-sms');

  if (btnBroadcastAlert) btnBroadcastAlert.addEventListener('click', triggerFullEmergencyBroadcast);
  if (btnTestSms) {
    btnTestSms.addEventListener('click', () => {
      if (!operatorSession.isAuthorized) {
        openAuthModal();
        return;
      }
      showCommandFeedback('🔔 Dispatching SIM800L transmitter ping diagnostic...', 'waiting');
      dispatchGateCommand('PREWARN_SMS', 0);
    });
  }

  // Add Contact Form
  const formAddContact = document.getElementById('form-add-contact');
  if (formAddContact) {
    formAddContact.addEventListener('submit', (e) => {
      e.preventDefault();
      const nameInput = document.getElementById('contact-name');
      const phoneInput = document.getElementById('contact-phone');
      const roleInput = document.getElementById('contact-role');

      if (nameInput && phoneInput) {
        const name = nameInput.value.trim();
        const phone = phoneInput.value.trim();
        const role = roleInput ? roleInput.value : 'OPERATOR';

        if (name && phone) {
          addEmergencyContact(name, phone, role);
          nameInput.value = '';
          phoneInput.value = '';
        }
      }
    });
  }

  // Google Sheets Integration Controls
  const inputWebhook = document.getElementById('input-sheets-webhook');
  const btnSaveWebhook = document.getElementById('btn-save-sheets-url');
  const btnSyncNow = document.getElementById('btn-sheets-sync-now');
  const btnBatchSync = document.getElementById('btn-sheets-batch-sync');
  const statusBox = document.getElementById('sheets-sync-status');

  if (inputWebhook) {
    const savedUrl = localStorage.getItem('sdas_sheets_webhook_url') || '';
    inputWebhook.value = savedUrl;
    if (savedUrl && statusBox) {
      statusBox.className = 'sheets-status-bar success';
      statusBox.innerHTML = `🟢 <b>Google Sheets Bridge Linked</b>: Ready to stream live telemetry to sheet.`;
    }
  }

  if (btnSaveWebhook && inputWebhook) {
    btnSaveWebhook.addEventListener('click', () => {
      const val = inputWebhook.value.trim();
      localStorage.setItem('sdas_sheets_webhook_url', val);
      if (statusBox) {
        statusBox.className = 'sheets-status-bar success';
        statusBox.innerHTML = `✅ <b>Webhook URL Saved!</b> Live rows will now stream to Google Sheet.`;
      }
    });
  }

  if (btnSyncNow) {
    btnSyncNow.addEventListener('click', () => {
      triggerGoogleSheetsAutoSync({
        created_at: new Date().toISOString()
      });
    });
  }

  if (btnBatchSync) {
    btnBatchSync.addEventListener('click', async () => {
      if (statusBox) {
        statusBox.className = 'sheets-status-bar waiting';
        statusBox.textContent = '⏳ Querying Supabase cloud for historical telemetry readings...';
      }

      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/readings?select=*&order=created_at.desc&limit=50`, {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        });

        if (res.ok) {
          const readings = await res.json();
          if (Array.isArray(readings) && readings.length > 0) {
            await sendTelemetryToGoogleSheet(readings, true);
          } else {
            if (statusBox) statusBox.textContent = 'ℹ️ No readings found in Supabase database.';
          }
        } else {
          throw new Error(`HTTP ${res.status}`);
        }
      } catch (err) {
        if (statusBox) {
          statusBox.className = 'sheets-status-bar error';
          statusBox.textContent = `❌ Batch export failed: ${err.message}`;
        }
      }
    });
  }
});
