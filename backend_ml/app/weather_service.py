"""
SDAS Open-Meteo Weather Service
Fetches real-time and forecasted precipitation data for the Puttalam catchment area (8.0362°N, 79.8283°E)
to inform the predictive hydrological ML pipeline.
"""

import time
import requests
from typing import Dict, Any

PUTTALAM_LAT = 8.0362
PUTTALAM_LON = 79.8283
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

class WeatherService:
    def __init__(self, cache_ttl_seconds: int = 600):
        self.cache_ttl = cache_ttl_seconds
        self.last_fetch_time = 0.0
        self.cached_data: Dict[str, Any] = {
            "source": "fallback_baseline",
            "latitude": PUTTALAM_LAT,
            "longitude": PUTTALAM_LON,
            "temperature_c": 28.5,
            "humidity_pct": 78.0,
            "current_rain_mm": 0.0,
            "forecast_next_1h_rain_mm": 0.5,
            "forecast_next_3h_rain_mm": 1.2
        }

    def get_weather(self) -> Dict[str, Any]:
        """
        Retrieves real-time weather metrics with caching to minimize external API hits.
        """
        now = time.time()
        if (now - self.last_fetch_time) < self.cache_ttl:
            return self.cached_data

        try:
            params = {
                "latitude": PUTTALAM_LAT,
                "longitude": PUTTALAM_LON,
                "current": "temperature_2m,relative_humidity_2m,precipitation,rain",
                "hourly": "precipitation,rain",
                "forecast_days": 1,
                "timezone": "Asia/Colombo"
            }
            response = requests.get(OPEN_METEO_URL, params=params, timeout=4.0)
            if response.status_code == 200:
                data = response.json()
                current = data.get("current", {})
                hourly = data.get("hourly", {})
                hourly_precip = hourly.get("precipitation", [0.0] * 24)

                self.cached_data = {
                    "source": "open-meteo-live",
                    "latitude": PUTTALAM_LAT,
                    "longitude": PUTTALAM_LON,
                    "temperature_c": current.get("temperature_2m", 28.5),
                    "humidity_pct": current.get("relative_humidity_2m", 78.0),
                    "current_rain_mm": current.get("precipitation", 0.0),
                    "forecast_next_1h_rain_mm": float(hourly_precip[0]) if len(hourly_precip) > 0 else 0.0,
                    "forecast_next_3h_rain_mm": float(sum(hourly_precip[:3])) if len(hourly_precip) >= 3 else 0.0,
                    "timestamp": current.get("time", "")
                }
                self.last_fetch_time = now
        except Exception as e:
            # Silently fallback to cached or baseline data during network dropouts
            self.cached_data["source"] = f"cached_fallback (error: {str(e)[:30]})"

        return self.cached_data

# Global Singleton
weather_service = WeatherService()
