"""
Smart Dam Alert System (SDAS) - Machine Learning Inference Microservice
Built with FastAPI. Provides 1-hour ahead water-level forecasting,
Autoencoder sensor anomaly verification, Random Forest hazard classification,
and Open-Meteo meteorological synchronization.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, Any

from .models import (
    TelemetryPayload,
    ForecastRequest, ForecastResponse,
    AnomalyCheckRequest, AnomalyCheckResponse,
    RiskClassificationRequest, RiskClassificationResponse,
    WeatherResponse
)
from .ml_service import ml_service
from .weather_service import weather_service

app = FastAPI(
    title="SDAS Machine Learning Inference Server",
    description="Hydrological forecasting and dual-sensor anomaly verification service for Tabbowa Dam / Puttalam Basin",
    version="2.0.0"
)

# Enable Cross-Origin Resource Sharing (CORS) for Expo Mobile Apps & Web Dashboards
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "service": "SDAS ML Inference Service",
        "status": "ONLINE",
        "version": "2.0.0",
        "models_loaded": {
            "forecaster": ml_service.forecast_bundle is not None,
            "autoencoder": ml_service.autoencoder_bundle is not None,
            "random_forest": ml_service.rf_bundle is not None
        }
    }

@app.get("/health")
def health_check():
    return {"status": "HEALTHY", "uptime": "OK"}

@app.post("/api/v1/forecast", response_model=ForecastResponse)
def get_water_level_forecast(request: ForecastRequest):
    """
    Computes a 1-hour ahead (t + 60 min) reservoir level projection
    using historical water level trends and precipitation data.
    """
    try:
        return ml_service.predict_future_level(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting inference error: {str(e)}")

@app.post("/api/v1/anomaly-check", response_model=AnomalyCheckResponse)
def check_sensor_anomalies(request: AnomalyCheckRequest):
    """
    Reconstructs dual-sensor ultrasonic telemetry using the neural Autoencoder.
    Flags acoustic drift, multipath reflection errors, or stuck transducers.
    """
    try:
        return ml_service.detect_anomalies(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Anomaly detection error: {str(e)}")

@app.post("/api/v1/classify-risk", response_model=RiskClassificationResponse)
def classify_operational_risk(request: RiskClassificationRequest):
    """
    Classifies immediate operational risk category (NORMAL, PRE-WARNING, CLEAR AREA, DANGER)
    using the Random Forest ensemble classifier.
    """
    try:
        return ml_service.classify_hazard(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Risk classification error: {str(e)}")

@app.get("/api/v1/weather/puttalam", response_model=WeatherResponse)
def get_puttalam_weather():
    """
    Pulls real-time precipitation and 1-hour/3-hour forecasted rainfall
    from Open-Meteo for the Puttalam reservoir catchment basin.
    """
    try:
        weather_data = weather_service.get_weather()
        return WeatherResponse(**weather_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Weather service error: {str(e)}")

@app.post("/api/v1/telemetry-hook")
def ingest_telemetry_webhook(payload: TelemetryPayload):
    """
    Ingests live telemetry from Supabase database webhooks or ESP32 nodes
    and returns comprehensive AI advisory analytics.
    """
    # 1. Run Anomaly Verification
    anom_req = AnomalyCheckRequest(
        sensor_1_dist_cm=payload.sensor_1_dist_cm,
        sensor_2_dist_cm=payload.sensor_2_dist_cm
    )
    anom_res = ml_service.detect_anomalies(anom_req)

    # 2. Run Risk Classification
    risk_req = RiskClassificationRequest(
        water_level_pct=payload.water_level_pct,
        level_rate_of_change_cm_min=0.05,
        rain_accum_30m=payload.rainfall_mm or 0.0,
        gate_percent=payload.gate_percent,
        temperature_c=payload.temperature_c
    )
    risk_res = ml_service.classify_hazard(risk_req)

    return {
        "status": "PROCESSED",
        "anomaly_analysis": anom_res,
        "risk_classification": risk_res
    }
