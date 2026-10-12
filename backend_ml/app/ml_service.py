"""
SDAS Machine Learning Inference Engine
Manages model persistence, real-time inference, and algorithmic safety checks.
"""

import os
import joblib
import numpy as np
from typing import Dict, Any, List
from .models import (
    ForecastRequest, ForecastResponse,
    AnomalyCheckRequest, AnomalyCheckResponse,
    RiskClassificationRequest, RiskClassificationResponse
)
from .weather_service import weather_service

MODEL_DIR = os.path.join(os.path.dirname(__file__), "..", "saved_models")

class MLService:
    def __init__(self):
        self.forecast_bundle = self._load_model("water_level_forecaster.joblib")
        self.autoencoder_bundle = self._load_model("autoencoder_anomaly_detector.joblib")
        self.rf_bundle = self._load_model("random_forest_risk_classifier.joblib")

    def _load_model(self, filename: str) -> Any:
        path = os.path.join(MODEL_DIR, filename)
        if os.path.exists(path):
            try:
                bundle = joblib.load(path)
                print(f"[ML-ENGINE] Successfully loaded: {filename}")
                return bundle
            except Exception as e:
                print(f"[ML-ENGINE] Error loading {filename}: {e}")
        return None

    def reload_models(self):
        self.forecast_bundle = self._load_model("water_level_forecaster.joblib")
        self.autoencoder_bundle = self._load_model("autoencoder_anomaly_detector.joblib")
        self.rf_bundle = self._load_model("random_forest_risk_classifier.joblib")

    def predict_future_level(self, req: ForecastRequest) -> ForecastResponse:
        """
        Predicts water level percentage 1 hour ahead (t + 60 min).
        """
        levels = np.array(req.history_levels_60m)
        if len(levels) < 15:
            # Pad or extrapolate if insufficient history
            levels = np.pad(levels, (max(0, 60 - len(levels)), 0), mode="edge")
            
        cur_level = req.current_water_level_pct
        rain_sum = 0.0
        rain_max = 0.0
        
        # Pull live Open-Meteo precipitation if client did not supply historical rain
        weather = weather_service.get_weather()
        if req.history_rainfall_60m and len(req.history_rainfall_60m) > 0:
            rain_sum = float(np.sum(req.history_rainfall_60m))
            rain_max = float(np.max(req.history_rainfall_60m))
        else:
            rain_sum = weather.get("forecast_next_1h_rain_mm", 0.0) * 1.5
            rain_max = weather.get("current_rain_mm", 0.0)

        delta_15 = float(cur_level - levels[-15]) if len(levels) >= 15 else 0.0
        delta_30 = float(cur_level - levels[-30]) if len(levels) >= 30 else 0.0
        delta_60 = float(cur_level - levels[0])
        mean_60 = float(np.mean(levels))
        std_60 = float(np.std(levels))

        feature_vector = np.array([[
            cur_level, delta_15, delta_30, delta_60,
            mean_60, std_60, rain_sum, rain_max, req.current_gate_percent
        ]])

        if self.forecast_bundle is not None:
            model = self.forecast_bundle["model"]
            scaler = self.forecast_bundle["scaler"]
            scaled_feat = scaler.transform(feature_vector)
            pred_level = float(model.predict(scaled_feat)[0])
            mape = float(self.forecast_bundle["metrics"]["mape"])
        else:
            # Algorithmic hydrological fallback
            runoff_factor = 0.15 * (rain_sum / 60.0)
            discharge_factor = 0.18 * (req.current_gate_percent / 100.0)
            pred_level = cur_level + (delta_15 * 2.0) + (runoff_factor - discharge_factor) * 60.0
            mape = 3.8

        pred_level = float(np.clip(pred_level, 0.0, 100.0))
        delta_level = pred_level - cur_level

        if pred_level >= 85.0:
            projected_state = "DANGER"
        elif pred_level >= 80.0:
            projected_state = "CLEAR AREA"
        elif pred_level >= 60.0:
            projected_state = "PRE-WARNING"
        else:
            projected_state = "NORMAL"

        return ForecastResponse(
            current_level_pct=round(cur_level, 2),
            forecast_1h_level_pct=round(pred_level, 2),
            predicted_delta_pct=round(delta_level, 2),
            forecast_horizon_minutes=60,
            projected_hazard_state=projected_state,
            model_confidence_mape=round(mape, 2),
            weather_inflow_considered=True
        )

    def detect_anomalies(self, req: AnomalyCheckRequest) -> AnomalyCheckResponse:
        """
        Evaluates reconstruction error between dual sensors to detect hardware faults.
        """
        d1 = req.sensor_1_dist_cm
        d2 = req.sensor_2_dist_cm
        delta = abs(d1 - d2)
        prev_level = req.previous_level_cm if req.previous_level_cm else 25.0
        cur_level = 65.0 - ((d1 + d2) / 2.0)
        rate = abs(cur_level - prev_level)

        features = np.array([[d1, d2, delta, rate]])

        if self.autoencoder_bundle is not None:
            model = self.autoencoder_bundle["model"]
            scaler = self.autoencoder_bundle["scaler"]
            threshold = float(self.autoencoder_bundle["threshold"])

            scaled = scaler.transform(features)
            recon = model.predict(scaled)
            mse = float(np.mean(np.square(scaled - recon)))
            is_anom = bool(mse > threshold or delta > 5.0)
        else:
            # Deterministic fallback check
            mse = float(delta * 0.4)
            threshold = 2.0
            is_anom = bool(delta > 5.0 or rate > 15.0)

        if delta > 5.0:
            verdict = "CRITICAL_SENSOR_DIVERGENCE"
            action = "Switch to healthy single-sensor degraded mode; dispatch maintenance crew."
        elif is_anom:
            verdict = "ANOMALOUS_ACOUSTIC_DISTORTION"
            action = "Sensor readings exhibit high reconstruction error. Suppress automatic trigger, require operator verification."
        else:
            verdict = "NOMINAL_HEALTHY"
            action = "Dual sensors in mutual acoustic consensus. Safe for automated closed-loop gate regulation."

        return AnomalyCheckResponse(
            is_anomaly=is_anom,
            reconstruction_mse=round(mse, 4),
            anomaly_threshold=round(threshold, 4),
            sensor_delta_cm=round(delta, 2),
            anomaly_verdict=verdict,
            recommended_action=action
        )

    def classify_hazard(self, req: RiskClassificationRequest) -> RiskClassificationResponse:
        """
        Random Forest risk classification for multi-tier disaster management.
        """
        features = np.array([[
            req.water_level_pct,
            req.level_rate_of_change_cm_min,
            req.rain_accum_30m,
            req.gate_percent,
            req.temperature_c
        ]])

        class_names = ["NORMAL", "PRE-WARNING", "CLEAR AREA", "DANGER"]

        if self.rf_bundle is not None:
            rf = self.rf_bundle["model"]
            pred_id = int(rf.predict(features)[0])
            probs = rf.predict_proba(features)[0]
            prob_dict = {class_names[i]: round(float(probs[i]), 3) for i in range(len(class_names))}
            confidence = float(probs[pred_id])
        else:
            # Rule-based fallback
            if req.water_level_pct >= 85.0:
                pred_id = 3
            elif req.water_level_pct >= 80.0:
                pred_id = 2
            elif req.water_level_pct >= 60.0:
                pred_id = 1
            else:
                pred_id = 0
            confidence = 0.95
            prob_dict = {c: (0.95 if i == pred_id else 0.016) for i, c in enumerate(class_names)}

        recommendations = {
            "NORMAL": "Maintain baseline 5-second monitoring. Gates closed.",
            "PRE-WARNING": "Reservoir reaching 60%. Issue mobile advisory; hold gate closed to conserve water.",
            "CLEAR AREA": "Reservoir at 80%. Automated 30% gate release active. Clear riverbanks.",
            "DANGER": "CRITICAL 85%+: Automated 50% gate release. Audible siren active. Initiate downstream evacuation."
        }

        return RiskClassificationResponse(
            predicted_class_id=pred_id,
            hazard_label=class_names[pred_id],
            confidence_score=round(confidence, 3),
            class_probabilities=prob_dict,
            advisory_recommendation=recommendations[class_names[pred_id]]
        )

# Global Singleton
ml_service = MLService()
