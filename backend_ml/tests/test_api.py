"""
API tests for the rule-based decision support server (needs fastapi + httpx installed).
Run from the project folder:  python -m pytest backend_ml/tests -q
"""
import os
import sys
sys.path.insert(0, os.path.abspath("."))

from starlette.testclient import TestClient
from backend_ml.app.main import app

client = TestClient(app)


def test_root():
    data = client.get("/").json()
    assert data["status"] == "ONLINE"
    assert data["method"] == "RULE_BASED"


def test_forecast_endpoint():
    payload = {
        "current_water_level_pct": 73.85,
        "history_levels_60m": [65.0 + 0.15 * i for i in range(60)],
        "history_rainfall_60m": [0.0] * 60,
        "current_gate_percent": 0
    }
    r = client.post("/api/v1/forecast", json=payload)
    assert r.status_code == 200
    d = r.json()
    assert d["forecast_horizon_minutes"] == 60
    assert d["trend"] == "RISING"
    assert d["projected_hazard_state"] == "CLEAR_AREA"


def test_forecast_empty_history():
    payload = {"current_water_level_pct": 50.0, "history_levels_60m": [], "current_gate_percent": 0}
    r = client.post("/api/v1/forecast", json=payload)
    assert r.status_code == 200
    assert r.json()["forecast_1h_level_pct"] == 50.0


def test_anomaly_endpoint():
    ok = client.post("/api/v1/anomaly-check", json={"sensor_1_dist_cm": 19.2, "sensor_2_dist_cm": 19.25}).json()
    assert ok["is_anomaly"] is False
    bad = client.post("/api/v1/anomaly-check", json={"sensor_1_dist_cm": 32.0, "sensor_2_dist_cm": 46.5}).json()
    assert bad["anomaly_verdict"] == "SENSOR_DISAGREEMENT"
    dead = client.post("/api/v1/anomaly-check", json={"sensor_1_dist_cm": -1, "sensor_2_dist_cm": -1}).json()
    assert dead["anomaly_verdict"] == "SENSOR_FAULT_BOTH"


def test_risk_classification():
    payload = {"water_level_pct": 86.5, "level_rate_of_change_cm_min": 0.25, "rain_accum_30m": 0.0,
               "gate_percent": 50, "temperature_c": 28.5}
    d = client.post("/api/v1/classify-risk", json=payload).json()
    assert d["hazard_label"] == "DANGER"


def test_telemetry_hook():
    payload = {"sensor_1_dist_cm": 17.0, "sensor_2_dist_cm": 17.2, "water_level_pct": 82.5,
               "gate_percent": 20, "previous_level_cm": 32.8}
    d = client.post("/api/v1/telemetry-hook", json=payload).json()
    assert d["method"] == "RULE_BASED"
    assert d["sensor_check"]["anomaly_verdict"] == "NORMAL"
    assert d["risk_advice"]["hazard_label"] == "CLEAR_AREA"


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"[PASS] {name}")
