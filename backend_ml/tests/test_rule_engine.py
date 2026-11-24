"""
Unit tests for the rule-based decision support engine.
Run from the project folder:  python -m pytest backend_ml/tests -q
(or without pytest:            python backend_ml/tests/test_rule_engine.py)
"""
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "app")))
from rule_engine import RuleEngine, stage_for_level, distance_to_level_pct, linear_slope  # noqa: E402

eng = RuleEngine()


def test_stage_thresholds_match_firmware():
    assert stage_for_level(59.9) == "NORMAL"
    assert stage_for_level(60.0) == "PRE_WARNING"
    assert stage_for_level(79.9) == "PRE_WARNING"
    assert stage_for_level(80.0) == "CLEAR_AREA"
    assert stage_for_level(84.9) == "CLEAR_AREA"
    assert stage_for_level(85.0) == "DANGER"


def test_distance_to_level_uses_50cm_mount():
    assert distance_to_level_pct(40) == 25.0
    assert distance_to_level_pct(22) == 70.0
    assert distance_to_level_pct(13) == 92.5
    assert distance_to_level_pct(60) == 0.0      # below floor -> clamped
    assert distance_to_level_pct(5) == 100.0     # above full -> clamped


def test_slope():
    assert abs(linear_slope([1, 2, 3, 4, 5]) - 1.0) < 1e-9
    assert linear_slope([7]) == 0.0


def test_forecast_rising_trend():
    hist = [65.0 + 0.15 * i for i in range(60)]          # +0.15 % per minute
    r = eng.forecast(hist[-1], hist)
    assert r["trend"] == "RISING"
    assert abs(r["rate_pct_per_min"] - 0.15) < 1e-6
    assert abs(r["forecast_1h_level_pct"] - (hist[-1] + 9.0)) < 0.01
    assert r["projected_hazard_state"] == "CLEAR_AREA"   # 73.85 + 9 = 82.85
    assert r["next_threshold_pct"] == 80.0
    assert 40 < r["minutes_to_next_threshold"] < 42      # (80 - 73.85) / 0.15 = 41
    assert r["method"] == "RULE_BASED_LINEAR_TREND"


def test_forecast_stable_and_clamped():
    r = eng.forecast(50.0, [50.0] * 30)
    assert r["trend"] == "STABLE" and r["forecast_1h_level_pct"] == 50.0
    r = eng.forecast(98.0, [80 + i for i in range(19)])  # very fast rise
    assert r["forecast_1h_level_pct"] == 100.0
    assert r["trend"] == "RISING_FAST"


def test_forecast_needs_history():
    r = eng.forecast(70.0, [69.0, 70.0])
    assert r["forecast_1h_level_pct"] == 70.0 and r["history_points_used"] == 2
    assert any("not calculated" in n for n in r["notes"])


def test_sensor_rules():
    ok = eng.check_sensors(19.2, 19.25, previous_level_cm=30.78)
    assert ok["is_anomaly"] is False and ok["anomaly_verdict"] == "NORMAL"

    dis = eng.check_sensors(32.0, 46.5)
    assert dis["is_anomaly"] and dis["anomaly_verdict"] == "SENSOR_DISAGREEMENT" and "R2" in dis["rules_fired"]

    both = eng.check_sensors(-1, -1)
    assert both["anomaly_verdict"] == "SENSOR_FAULT_BOTH"

    one = eng.check_sensors(-1, 30.0)
    assert one["anomaly_verdict"] == "SENSOR_FAULT_S1"

    spike = eng.check_sensors(20.0, 20.5, previous_level_cm=18.0)   # depth 30 vs 18 = 12 cm jump
    assert spike["anomaly_verdict"] == "SPIKE" and "R3" in spike["rules_fired"]


def test_risk_advice_early_warning():
    r = eng.classify_risk(57.0, rate_cm_per_min=0.2)      # 3 % below 60 and rising
    assert r["hazard_label"] == "NORMAL"
    assert r["advisory_stage"] == "PRE_WARNING" and r["approaching_next_stage"]

    r = eng.classify_risk(57.0, rate_cm_per_min=0.0)      # close but not rising
    assert r["advisory_stage"] == "NORMAL" and not r["approaching_next_stage"]

    r = eng.classify_risk(90.0, rate_cm_per_min=1.0)
    assert r["hazard_label"] == "DANGER" and r["advisory_stage"] == "DANGER"
    assert r["method"] == "RULE_BASED_THRESHOLDS"


if __name__ == "__main__":
    n = 0
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            n += 1
            print(f"[PASS] {name}")
    print(f"{n} rule-engine tests passed")
