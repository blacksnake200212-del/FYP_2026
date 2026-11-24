"""
Smart Dam Alert System (SDAS) - Rule-Based Decision Support Service
Built with FastAPI. Gives explainable, rule-based advice to operators:
1-hour level trend forecast, dual-sensor fault checks, risk stage advice, and
Open-Meteo rainfall for Puttalam.

ADVISORY ONLY: the ESP32 firmware always controls the gate with its own thresholds.
(The earlier ML models were replaced with rules on supervisor advice.)
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .models import (
    TelemetryPayload,
    ForecastRequest, ForecastResponse,
    AnomalyCheckRequest, AnomalyCheckResponse,
    RiskClassificationRequest, RiskClassificationResponse,
    WeatherResponse
)
from .rule_engine import rule_engine, SENSOR_MOUNT_HEIGHT_CM
from .weather_service import weather_service

app = FastAPI(
    title="SDAS Rule-Based Decision Support Server",
    description="Explainable rule-based advice for Tabbowa Dam (Puttalam): trend forecast, sensor checks, risk stage",
    version="3.0.0"
)

# CORS for the Expo apps and the web dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.api_route("/", methods=["GET", "HEAD"])
def root():
    return {
        "service": "SDAS Rule-Based Decision Support",
        "status": "ONLINE",
        "version": "3.0.0",
        "method": "RULE_BASED",
        "engines": ["linear_trend_forecast", "sensor_rule_checks", "threshold_risk_advice"],
    }


@app.api_route("/health", methods=["GET", "HEAD"])
def health_check():
    return {"status": "HEALTHY"}


@app.post("/api/v1/forecast", response_model=ForecastResponse)
def get_water_level_forecast(request: ForecastRequest):
    """1-hour level projection from the straight-line trend of the last 60 one-minute readings."""
    try:
        return rule_engine.forecast(request.current_water_level_pct, request.history_levels_60m,
                                    request.history_rainfall_60m, request.current_gate_percent)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecast error: {e}")


@app.post("/api/v1/anomaly-check", response_model=AnomalyCheckResponse)
def check_sensor_anomalies(request: AnomalyCheckRequest):
    """Rule checks: no echo, sensors disagree by more than 5 cm, or a sudden jump."""
    try:
        return rule_engine.check_sensors(request.sensor_1_dist_cm, request.sensor_2_dist_cm,
                                         request.previous_level_cm)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sensor check error: {e}")


@app.post("/api/v1/classify-risk", response_model=RiskClassificationResponse)
def classify_operational_risk(request: RiskClassificationRequest):
    """Stage from the firmware thresholds (60/80/85 %), raised early when close and rising."""
    try:
        return rule_engine.classify_risk(request.water_level_pct, request.level_rate_of_change_cm_min,
                                         request.rain_accum_30m, request.gate_percent, request.temperature_c)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Risk advice error: {e}")


@app.get("/api/v1/weather/puttalam", response_model=WeatherResponse)
def get_puttalam_weather():
    """Current and forecast rain for the Puttalam catchment from Open-Meteo."""
    try:
        return WeatherResponse(**weather_service.get_weather())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Weather service error: {e}")


@app.post("/api/v1/telemetry-hook")
def ingest_telemetry_webhook(payload: TelemetryPayload):
    """One reading in, sensor check + risk advice out (used by the Wokwi simulation)."""
    sensors = rule_engine.check_sensors(payload.sensor_1_dist_cm, payload.sensor_2_dist_cm,
                                        payload.previous_level_cm)
    rate = payload.level_rate_cm_min
    valid = [d for d in (payload.sensor_1_dist_cm, payload.sensor_2_dist_cm) if d is not None and d > 0]
    if rate is None and payload.previous_level_cm is not None and valid:
        # Readings arrive about every 5 s: convert the depth change to cm per minute
        depth_now = SENSOR_MOUNT_HEIGHT_CM - min(valid)
        rate = (depth_now - payload.previous_level_cm) * 12.0
    risk = rule_engine.classify_risk(payload.water_level_pct, rate or 0.0, payload.rainfall_mm or 0.0,
                                     payload.gate_percent, payload.temperature_c)
    return {
        "status": "PROCESSED",
        "method": "RULE_BASED",
        "rate_known": rate is not None,
        "sensor_check": sensors,
        "risk_advice": risk,
    }
