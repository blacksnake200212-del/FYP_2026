"""
SDAS FastAPI Pydantic Request & Response Data Schemas
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class TelemetryPayload(BaseModel):
    sensor_1_dist_cm: float = Field(..., example=32.4)
    sensor_2_dist_cm: float = Field(..., example=32.6)
    water_level_pct: float = Field(..., example=81.5)
    temperature_c: float = Field(..., example=28.4)
    humidity_pct: float = Field(..., example=76.5)
    gate_percent: int = Field(..., example=30)
    rainfall_mm: Optional[float] = Field(0.0, example=12.5)

class ForecastRequest(BaseModel):
    current_water_level_pct: float = Field(..., example=78.5)
    history_levels_60m: List[float] = Field(..., description="Array of water levels over the past 60 minutes")
    history_rainfall_60m: Optional[List[float]] = Field(None, description="Precipitation over the past 60 minutes")
    current_gate_percent: int = Field(0, example=0)

class ForecastResponse(BaseModel):
    current_level_pct: float
    forecast_1h_level_pct: float
    predicted_delta_pct: float
    forecast_horizon_minutes: int
    projected_hazard_state: str
    model_confidence_mape: float
    weather_inflow_considered: bool

class AnomalyCheckRequest(BaseModel):
    sensor_1_dist_cm: float = Field(..., example=34.0)
    sensor_2_dist_cm: float = Field(..., example=48.2) # Divergent
    previous_level_cm: Optional[float] = Field(26.0, example=26.0)

class AnomalyCheckResponse(BaseModel):
    is_anomaly: bool
    reconstruction_mse: float
    anomaly_threshold: float
    sensor_delta_cm: float
    anomaly_verdict: str
    recommended_action: str

class RiskClassificationRequest(BaseModel):
    water_level_pct: float = Field(..., example=83.0)
    level_rate_of_change_cm_min: float = Field(..., example=0.15)
    rain_accum_30m: float = Field(..., example=18.0)
    gate_percent: int = Field(..., example=30)
    temperature_c: float = Field(..., example=29.0)

class RiskClassificationResponse(BaseModel):
    predicted_class_id: int
    hazard_label: str
    confidence_score: float
    class_probabilities: Dict[str, float]
    advisory_recommendation: str

class WeatherResponse(BaseModel):
    source: str
    latitude: float
    longitude: float
    temperature_c: float
    humidity_pct: float
    current_rain_mm: float
    forecast_next_1h_rain_mm: float
    forecast_next_3h_rain_mm: float
