"""
SDAS Rule-Based Decision Support Engine
=======================================

Replaces the earlier machine-learning models (MLP forecaster, autoencoder, random forest),
as advised by the project supervisors. Every result comes from fixed, explainable rules that
use the same numbers as the ESP32 firmware (config.h), so the advice can be checked by hand.

It is ADVISORY ONLY: the ESP32 always controls the gate with its own thresholds.

Pure Python (no NumPy / scikit-learn / TensorFlow), so it can be unit-tested anywhere.
"""

from typing import Dict, List, Optional

# --- Same values as firmware/SDAS_ESP32_Firmware/config.h -----------------------------------
SENSOR_MOUNT_HEIGHT_CM = 50.0   # sensor face to tank floor
TANK_MAX_DEPTH_CM = 40.0        # usable depth (100 %)
SENSOR_BLIND_ZONE_CM = 2.0      # HC-SR04 cannot measure closer than this
SENSOR_MAX_DELTA_CM = 5.0       # two sensors must agree within this
THRESH_PREWARN_PCT = 60.0
THRESH_CLEARAREA_PCT = 80.0
THRESH_DANGER_PCT = 85.0
HYSTERESIS_PCT = 3.0

# --- Rule-engine settings (explainable, tunable) ---------------------------------------------
FORECAST_HORIZON_MIN = 60
STABLE_RATE_PCT_PER_MIN = 0.02      # |rate| below this = "STABLE" (about 1.2 % per hour)
FAST_RISE_PCT_PER_MIN = 0.5         # 30 % per hour = unusually fast for the scale model
MAX_STEP_JUMP_CM = 5.0              # one reading jumping more than this = spike / glitch
EARLY_WARNING_MARGIN_PCT = 5.0      # "approaching" = within 5 % of the next threshold
FORECAST_MIN_POINTS = 5             # fewer history points -> no trend, hold current level

STAGES = ["NORMAL", "PRE_WARNING", "CLEAR_AREA", "DANGER"]


def stage_for_level(level_pct: float) -> str:
    """Entry thresholds, the same as the ESP32 state machine (without hysteresis memory)."""
    if level_pct >= THRESH_DANGER_PCT:
        return "DANGER"
    if level_pct >= THRESH_CLEARAREA_PCT:
        return "CLEAR_AREA"
    if level_pct >= THRESH_PREWARN_PCT:
        return "PRE_WARNING"
    return "NORMAL"


def next_threshold(level_pct: float) -> Optional[float]:
    for t in (THRESH_PREWARN_PCT, THRESH_CLEARAREA_PCT, THRESH_DANGER_PCT):
        if level_pct < t:
            return t
    return None


def distance_to_level_pct(distance_cm: float) -> float:
    depth = SENSOR_MOUNT_HEIGHT_CM - distance_cm
    return max(0.0, min(100.0, depth / TANK_MAX_DEPTH_CM * 100.0))


def linear_slope(values: List[float]) -> float:
    """Least-squares slope per sample (samples assumed 1 minute apart)."""
    n = len(values)
    if n < 2:
        return 0.0
    mean_x = (n - 1) / 2.0
    mean_y = sum(values) / n
    num = sum((i - mean_x) * (v - mean_y) for i, v in enumerate(values))
    den = sum((i - mean_x) ** 2 for i in range(n))
    return num / den if den else 0.0


class RuleEngine:
    method = "RULE_BASED"

    # ---------------------------------------------------------------- 1. level trend forecast
    def forecast(self, current_level_pct: float, history_levels: List[float],
                 history_rain: Optional[List[float]] = None, gate_percent: int = 0) -> Dict:
        """
        Rule: fit a straight line to the last 60 one-minute readings and extend it 60 minutes.
        No trend is assumed when there are fewer than FORECAST_MIN_POINTS readings.
        Rain is not added as a number (the scale model has no rain inflow); it only raises
        the advice when it is falling and the level is rising.
        """
        levels = [float(v) for v in (history_levels or []) if v is not None][-60:]
        enough = len(levels) >= FORECAST_MIN_POINTS
        rate = linear_slope(levels) if enough else 0.0          # % per minute
        projected = max(0.0, min(100.0, current_level_pct + rate * FORECAST_HORIZON_MIN))

        if abs(rate) < STABLE_RATE_PCT_PER_MIN:
            trend = "STABLE"
        elif rate > 0:
            trend = "RISING_FAST" if rate >= FAST_RISE_PCT_PER_MIN else "RISING"
        else:
            trend = "FALLING"

        nt = next_threshold(current_level_pct)
        minutes_to_next = None
        if nt is not None and rate > STABLE_RATE_PCT_PER_MIN:
            minutes_to_next = round((nt - current_level_pct) / rate, 1)

        rain_now = sum(history_rain[-60:]) if history_rain else 0.0
        notes = []
        if not enough:
            notes.append(f"Only {len(levels)} readings: trend not calculated, level held.")
        if rain_now > 0 and rate > 0:
            notes.append(f"{rain_now:.1f} mm rain in the last hour while the level rises.")
        if gate_percent > 0 and rate > 0:
            notes.append(f"Level still rising with the gate {gate_percent}% open.")

        return {
            "current_level_pct": round(current_level_pct, 2),
            "forecast_1h_level_pct": round(projected, 2),
            "predicted_delta_pct": round(projected - current_level_pct, 2),
            "rate_pct_per_min": round(rate, 4),
            "trend": trend,
            "forecast_horizon_minutes": FORECAST_HORIZON_MIN,
            "projected_hazard_state": stage_for_level(projected),
            "next_threshold_pct": nt,
            "minutes_to_next_threshold": minutes_to_next,
            "history_points_used": len(levels),
            "method": "RULE_BASED_LINEAR_TREND",
            "notes": notes,
        }

    # ---------------------------------------------------------------- 2. sensor anomaly rules
    def check_sensors(self, s1_cm: float, s2_cm: float, previous_level_cm: Optional[float] = None) -> Dict:
        """
        Rules, checked in order (same limits as the firmware):
          R1 no echo / out of range  -> SENSOR_FAULT (one or both sensors)
          R2 |S1 - S2| > 5 cm        -> SENSOR_DISAGREEMENT (firmware uses the higher water level)
          R3 depth jumps > 5 cm from the previous reading -> SPIKE (likely glitch or splash)
          otherwise                  -> NORMAL
        """
        def valid(d):
            return d is not None and SENSOR_BLIND_ZONE_CM <= d <= SENSOR_MOUNT_HEIGHT_CM + 5.0

        v1, v2 = valid(s1_cm), valid(s2_cm)
        delta = round(abs(s1_cm - s2_cm), 2) if (v1 and v2) else None
        rules_fired = []

        if not v1 and not v2:
            verdict, anomaly = "SENSOR_FAULT_BOTH", True
            action = "Both sensors give no valid echo: check 5 V power, level shifter and wiring. Gate holds position."
            rules_fired.append("R1")
        elif not v1 or not v2:
            bad = "S1" if not v1 else "S2"
            verdict, anomaly = f"SENSOR_FAULT_{bad}", True
            action = f"{bad} gives no valid echo; system runs on one sensor (degraded mode). Inspect {bad}."
            rules_fired.append("R1")
        elif delta > SENSOR_MAX_DELTA_CM:
            verdict, anomaly = "SENSOR_DISAGREEMENT", True
            action = (f"Sensors differ by {delta} cm (> {SENSOR_MAX_DELTA_CM} cm). The higher water level is used "
                      "for safety. Check for debris, angle or a loose sensor.")
            rules_fired.append("R2")
        else:
            verdict, anomaly, action = "NORMAL", False, "Both sensors agree. No action needed."

        if v1 or v2:
            dists = [d for d, ok in ((s1_cm, v1), (s2_cm, v2)) if ok]
            depth_now = SENSOR_MOUNT_HEIGHT_CM - min(dists)
            if previous_level_cm is not None and abs(depth_now - previous_level_cm) > MAX_STEP_JUMP_CM:
                rules_fired.append("R3")
                if not anomaly:
                    verdict, anomaly = "SPIKE", True
                    action = (f"Water depth jumped {abs(depth_now - previous_level_cm):.1f} cm in one reading. "
                              "Likely a splash or echo glitch; confirm with the next readings.")
        return {
            "is_anomaly": anomaly,
            "anomaly_verdict": verdict,
            "sensor_delta_cm": delta,
            "max_allowed_delta_cm": SENSOR_MAX_DELTA_CM,
            "rules_fired": rules_fired,
            "recommended_action": action,
            "method": "RULE_BASED_CHECKS",
        }

    # ---------------------------------------------------------------- 3. risk advice
    def classify_risk(self, level_pct: float, rate_cm_per_min: float = 0.0, rain_30m_mm: float = 0.0,
                      gate_percent: int = 0, temperature_c: Optional[float] = None) -> Dict:
        """
        Stage = the firmware thresholds. The advice is raised one step early when the level is
        within 5 % of the next threshold AND rising (rate > 0), so operators get a warning
        before the ESP32 changes stage.
        """
        stage = stage_for_level(level_pct)
        rate_pct = rate_cm_per_min / TANK_MAX_DEPTH_CM * 100.0
        nt = next_threshold(level_pct)
        approaching = nt is not None and (nt - level_pct) <= EARLY_WARNING_MARGIN_PCT and rate_pct > STABLE_RATE_PCT_PER_MIN
        advice_stage = STAGES[min(STAGES.index(stage) + 1, 3)] if approaching else stage

        advice = {
            "NORMAL": "Normal level. Keep monitoring.",
            "PRE_WARNING": "Pre-warning: inform operators and registered contacts; gate stays closed.",
            "CLEAR_AREA": "Clear area: downstream people must leave the spillway zone; gate opens 20%.",
            "DANGER": "Danger: siren and danger SMS; gate opens to the 50% maximum.",
        }[advice_stage]
        if approaching:
            advice = f"Approaching {advice_stage.replace('_', ' ')} ({nt:.0f}%) and rising. " + advice
        if rain_30m_mm >= 10 and level_pct >= THRESH_PREWARN_PCT:
            advice += f" Heavy rain ({rain_30m_mm:.0f} mm in 30 min): expect a faster rise."

        return {
            "hazard_label": stage,
            "advisory_stage": advice_stage,
            "approaching_next_stage": approaching,
            "rate_pct_per_min": round(rate_pct, 4),
            "thresholds_pct": {"pre_warning": THRESH_PREWARN_PCT, "clear_area": THRESH_CLEARAREA_PCT,
                               "danger": THRESH_DANGER_PCT, "hysteresis": HYSTERESIS_PCT},
            "advisory_recommendation": advice,
            "method": "RULE_BASED_THRESHOLDS",
        }


rule_engine = RuleEngine()
