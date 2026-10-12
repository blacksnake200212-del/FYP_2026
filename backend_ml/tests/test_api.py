import os
import sys
sys.path.insert(0, os.path.abspath("."))

from starlette.testclient import TestClient
from backend_ml.app.main import app

client = TestClient(app)

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ONLINE"
    assert data["models_loaded"]["forecaster"] is True
    assert data["models_loaded"]["autoencoder"] is True
    assert data["models_loaded"]["random_forest"] is True
    print("[TEST-PASS] Root health & model discovery endpoint")

def test_forecast_endpoint():
    payload = {
        "current_water_level_pct": 74.5,
        "history_levels_60m": [65.0 + 0.15 * i for i in range(60)],
        "history_rainfall_60m": [0.2] * 60,
        "current_gate_percent": 0
    }
    response = client.post("/api/v1/forecast", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "forecast_1h_level_pct" in data
    assert "projected_hazard_state" in data
    assert data["forecast_horizon_minutes"] == 60
    print(f"[TEST-PASS] Forecast Endpoint: Current: {data['current_level_pct']}% -> 1h Forecast: {data['forecast_1h_level_pct']}% (Projected: {data['projected_hazard_state']})")

def test_anomaly_endpoint():
    # Test 1: Nominal agreement (matching typical mean level and rate)
    nominal_payload = {
        "sensor_1_dist_cm": 34.2,
        "sensor_2_dist_cm": 34.25,
        "previous_level_cm": 30.78 # Rate ~ 0.015 cm/min
    }
    res_nom = client.post("/api/v1/anomaly-check", json=nominal_payload)
    assert res_nom.status_code == 200
    data_nom = res_nom.json()
    assert data_nom["is_anomaly"] is False
    print(f"[TEST-PASS] Nominal Sensor Agreement (Delta {data_nom['sensor_delta_cm']}cm, Anomaly={data_nom['is_anomaly']})")

    # Test 2: Severe divergence fault (>5cm)
    divergent_payload = {
        "sensor_1_dist_cm": 32.0,
        "sensor_2_dist_cm": 46.5, # Delta 14.5 cm
        "previous_level_cm": 33.0
    }
    res_div = client.post("/api/v1/anomaly-check", json=divergent_payload)
    assert res_div.status_code == 200
    data_div = res_div.json()
    assert data_div["is_anomaly"] is True
    assert "DIVERGENCE" in data_div["anomaly_verdict"]
    print(f"[TEST-PASS] Sensor Fault Detection (Delta {data_div['sensor_delta_cm']}cm, Anomaly={data_div['is_anomaly']}, Verdict={data_div['anomaly_verdict']})")

def test_risk_classification():
    payload = {
        "water_level_pct": 86.5,
        "level_rate_of_change_cm_min": 0.25,
        "rain_accum_30m": 22.0,
        "gate_percent": 50,
        "temperature_c": 28.5
    }
    response = client.post("/api/v1/classify-risk", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["hazard_label"] in ["CLEAR AREA", "DANGER", "PRE-WARNING", "NORMAL"]
    print(f"[TEST-PASS] Risk Classification: Level {payload['water_level_pct']}% -> Class: {data['hazard_label']} (Score: {data['confidence_score']})")

def test_weather_endpoint():
    response = client.get("/api/v1/weather/puttalam")
    assert response.status_code == 200
    data = response.json()
    assert "temperature_c" in data
    assert "current_rain_mm" in data
    print(f"[TEST-PASS] Open-Meteo Weather Service: Temp={data['temperature_c']}°C, Rain={data['current_rain_mm']}mm, Source={data['source']}")

if __name__ == "__main__":
    print("\n--- RUNNING SDAS ML INFERENCE TEST SUITE ---")
    test_root()
    test_forecast_endpoint()
    test_anomaly_endpoint()
    test_risk_classification()
    test_weather_endpoint()
    print("--- ALL 5 INTEGRATION TESTS PASSED PERFECTLY ---\n")
