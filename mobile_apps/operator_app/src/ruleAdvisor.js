// SDAS rule-based advice (same rules as backend_ml/app/rule_engine.py, web_dashboard/rule_advisor.js
// and the ESP32 config.h). ADVISORY ONLY: the ESP32 always controls the gate.
export const R = {
  MOUNT_CM: 50, DEPTH_CM: 40, BLIND_CM: 2, MAX_DELTA_CM: 5,
  PRE: 60, CLEAR: 80, DANGER: 85,
  STABLE_RATE: 0.02,     // % per minute
  FAST_RATE: 0.5,        // % per minute
  EARLY_MARGIN: 5,       // % below next threshold counts as "approaching"
  MIN_POINTS: 5, MIN_SPAN_MIN: 5
};

export function stageFor(level) {
  if (level >= R.DANGER) return 'DANGER';
  if (level >= R.CLEAR) return 'CLEAR_AREA';
  if (level >= R.PRE) return 'PRE_WARNING';
  return 'NORMAL';
}

export function nextThreshold(level) {
  for (const t of [R.PRE, R.CLEAR, R.DANGER]) if (level < t) return t;
  return null;
}

// points: [{ t: Date|number (ms), level: number }] oldest first
export function trend(points, currentLevel) {
  const pts = (points || []).filter((p) => Number.isFinite(p.level) && p.t);
  const span = pts.length > 1 ? (+pts[pts.length - 1].t - +pts[0].t) / 60000 : 0;
  if (pts.length < R.MIN_POINTS || span < R.MIN_SPAN_MIN) {
    return { ok: false, reason: `Need at least ${R.MIN_SPAN_MIN} min of readings (have ${span.toFixed(1)} min).` };
  }
  const t0 = +pts[0].t;
  const xs = pts.map((p) => (+p.t - t0) / 60000);
  const ys = pts.map((p) => p.level);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  const rate = den ? num / den : 0;                       // % per minute
  const projected = Math.max(0, Math.min(100, currentLevel + rate * 60));
  const label = Math.abs(rate) < R.STABLE_RATE ? 'STABLE' : rate > 0 ? (rate >= R.FAST_RATE ? 'RISING FAST' : 'RISING') : 'FALLING';
  const nt = nextThreshold(currentLevel);
  const minutesToNext = nt !== null && rate > R.STABLE_RATE ? (nt - currentLevel) / rate : null;
  return { ok: true, rate, projected, label, projectedStage: stageFor(projected), nextThreshold: nt, minutesToNext, spanMin: span, points: pts.length };
}

export function sensorCheck(d1, d2) {
  const valid = (d) => Number.isFinite(d) && d >= R.BLIND_CM && d <= R.MOUNT_CM + 5;
  const v1 = valid(d1), v2 = valid(d2);
  if (!v1 && !v2) return { verdict: 'BOTH SENSORS FAULT', level: 'bad', text: 'No valid echo from either sensor. Check 5 V power, level shifter and wiring.' };
  if (!v1 || !v2) { const b = !v1 ? 'S1' : 'S2'; return { verdict: `${b} FAULT`, level: 'warn', text: `${b} gives no valid echo; running on one sensor.` }; }
  const delta = Math.abs(d1 - d2);
  if (delta > R.MAX_DELTA_CM) return { verdict: 'SENSORS DISAGREE', level: 'warn', text: `Sensors differ by ${delta.toFixed(1)} cm (limit ${R.MAX_DELTA_CM} cm). Higher water level is used.` };
  return { verdict: 'SENSORS OK', level: 'ok', text: `Both sensors agree (difference ${delta.toFixed(1)} cm).` };
}

export function advice(level, tr) {
  const stage = stageFor(level);
  const nt = nextThreshold(level);
  const rising = tr && tr.ok && tr.rate > R.STABLE_RATE;
  const approaching = nt !== null && nt - level <= R.EARLY_MARGIN && rising;
  const order = ['NORMAL', 'PRE_WARNING', 'CLEAR_AREA', 'DANGER'];
  const adv = approaching ? order[Math.min(order.indexOf(stage) + 1, 3)] : stage;
  const text = {
    NORMAL: 'Normal level. Keep monitoring.',
    PRE_WARNING: 'Pre-warning: inform operators and contacts; gate stays closed.',
    CLEAR_AREA: 'Clear area: downstream people leave the spillway zone; gate opens 20%.',
    DANGER: 'Danger: siren and danger SMS; gate opens to the 50% maximum.'
  }[adv];
  return { stage, adviceStage: adv, approaching, text: approaching ? `Approaching ${nt}% and rising. ${text}` : text };
}
