"""
SDAS FastAPI request & response schemas (rule-based decision support)
"""

from typing import List, Optional, Dict
from pydantic import BaseModel, Field


class TelemetryPayload(BaseModel):
    sensor_1_dist_cm: float = Field(..., example=32.4)
    sensor_2_dist_cm: float = Field(..., example=32.6)
    water_level_pct: float = Field(..., example=81.5)
    temperature_c: Optional[float] = Field(None, example=28.4)
    humidity_pct: Optional[float] = Field(None, example=76.5)
    gate_percent: int = Field(0, example=20)
    rainfall_mm: Optional[float] = Field(0.0, example=0.0)
    # Optional extras so the hook can give trend-aware advice (no made-up defaults)
    previous_level_cm: Optional[float] = Field(None, description="Water depth (cm) of the previous reading")
    level_rate_cm_min: Optional[float] = Field(None, description="Measured rate of rise (cm per minute)")


class ForecastRequest(BaseModel):
    current_water_level_pct: float = Field(..., example=78.5)
    history_levels_60m: List[float] = Field(..., description="Water level % once per minute, oldest first (up to 60)")
    history_rainfall_60m: Optional[List[float]] = Field(None, description="Rain (mm) per minute, oldest first")
    current_gate_percent: int = Field(0, example=0)


class ForecastResponse(BaseModel):
    current_level_pct: float
    forecast_1h_level_pct: float
    predicted_delta_pct: float
    rate_pct_per_min: float
    trend: str
    forecast_horizon_minutes: int
    projected_hazard_state: str
    next_threshold_pct: Optional[float]
    minutes_to_next_threshold: Optional[float]
    history_points_used: int
    method: str
    notes: List[str]


class AnomalyCheckRequest(BaseModel):
    sensor_1_dist_cm: float = Field(..., example=34.0)
    sensor_2_dist_cm: float = Field(..., example=48.2)
    previous_level_cm: Optional[float] = Field(None, example=16.0)


class AnomalyCheckResponse(BaseModel):
    is_anomaly: bool
    anomaly_verdict: str
    sensor_delta_cm: Optional[float]
    max_allowed_delta_cm: float
    rules_fired: List[str]
    recommended_action: str
    method: str


class RiskClassificationRequest(BaseModel):
    water_level_pct: float = Field(..., example=83.0)
    level_rate_of_change_cm_min: float = Field(0.0, example=0.15)
    rain_accum_30m: float = Field(0.0, example=0.0)
    gate_percent: int = Field(0, example=20)
    temperature_c: Optional[float] = Field(None, example=29.0)


class RiskClassificationResponse(BaseModel):
    hazard_label: str
    advisory_stage: str
    approaching_next_stage: bool
    rate_pct_per_min: float
    thresholds_pct: Dict[str, float]
    advisory_recommendation: str
    method: str


class WeatherResponse(BaseModel):
    source: str
    latitude: float
    longitude: float
    # None = Open-Meteo not reachable yet (no made-up values)
    temperature_c: Optional[float] = None
    humidity_pct: Optional[float] = None
    current_rain_mm: Optional[float] = None
    forecast_next_1h_rain_mm: Optional[float] = None
    forecast_next_3h_rain_mm: Optional[float] = None
