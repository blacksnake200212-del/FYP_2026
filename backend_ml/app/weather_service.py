"""
SDAS Open-Meteo Weather Service
Fetches real-time and forecasted precipitation data for the Puttalam catchment area (8.0362°N, 79.8283°E)
for the rule-based advice.
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
        # FIX: before the first successful fetch this returned made-up values (28.5 °C, 78 %,
        # 0.5 mm / 1.2 mm rain) as if they were real weather. Now it returns None ("no data").
        self.cached_data: Dict[str, Any] = {
            "source": "unavailable",
            "latitude": PUTTALAM_LAT,
            "longitude": PUTTALAM_LON,
            "temperature_c": None,
            "humidity_pct": None,
            "current_rain_mm": None,
            "forecast_next_1h_rain_mm": None,
            "forecast_next_3h_rain_mm": None
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
                hourly_precip = [v or 0.0 for v in hourly.get("precipitation", [])]
                hourly_times = hourly.get("time", [])
                # FIX: hourly[0] is midnight, not "the next hour". Start from the current hour.
                now_key = (current.get("time") or "")[:13]
                start = next((i for i, t in enumerate(hourly_times) if t[:13] == now_key), 0)
                nxt = hourly_precip[start + 1:start + 4]

                self.cached_data = {
                    "source": "open-meteo-live",
                    "latitude": PUTTALAM_LAT,
                    "longitude": PUTTALAM_LON,
                    "temperature_c": current.get("temperature_2m"),
                    "humidity_pct": current.get("relative_humidity_2m"),
                    "current_rain_mm": current.get("precipitation"),
                    "forecast_next_1h_rain_mm": float(nxt[0]) if len(nxt) > 0 else None,
                    "forecast_next_3h_rain_mm": float(sum(nxt)) if len(nxt) == 3 else None,
                    "timestamp": current.get("time", "")
                }
                self.last_fetch_time = now
        except Exception as e:
            # Silently fallback to cached or baseline data during network dropouts
            self.cached_data["source"] = f"cached_fallback (error: {str(e)[:30]})"

        return self.cached_data

# Global Singleton
weather_service = WeatherService()
