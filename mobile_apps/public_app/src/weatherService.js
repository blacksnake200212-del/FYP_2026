// Real weather for the Puttalam catchment from Open-Meteo (free, no API key).
// Replaces the fixed sunrise/sunset, "feels like = temp + 2" and invented 5-day outlook.

const PUTTALAM = { lat: 8.0362, lon: 79.8283 };
const URL =
  'https://api.open-meteo.com/v1/forecast' +
  `?latitude=${PUTTALAM.lat}&longitude=${PUTTALAM.lon}` +
  '&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,wind_speed_10m,weather_code' +
  '&hourly=precipitation_probability,precipitation' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset' +
  '&timezone=Asia%2FColombo&forecast_days=5';

// WMO weather codes -> short text + emoji
export function describeWeatherCode(code) {
  if (code === 0) return { text: 'Clear', icon: '☀️' };
  if (code <= 2) return { text: 'Partly cloudy', icon: '⛅' };
  if (code === 3) return { text: 'Overcast', icon: '☁️' };
  if (code === 45 || code === 48) return { text: 'Fog', icon: '🌫️' };
  if (code >= 51 && code <= 57) return { text: 'Drizzle', icon: '🌦️' };
  if (code >= 61 && code <= 67) return { text: 'Rain', icon: '🌧️' };
  if (code >= 80 && code <= 82) return { text: 'Rain showers', icon: '🌧️' };
  if (code >= 95) return { text: 'Thunderstorm', icon: '⛈️' };
  return { text: 'Cloudy', icon: '☁️' };
}

const hhmm = (iso) => (iso ? iso.slice(11, 16) : null);   // "2026-11-24T06:01" -> "06:01"
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Returns null when offline or the service fails (screens then show "--").
export async function fetchPuttalamWeather() {
  // FIX: on a weak mobile signal fetch() could hang forever; give up after 10 s
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 10000) : null;
  try {
    const res = await fetch(URL, ctrl ? { signal: ctrl.signal } : undefined);
    if (!res.ok) return null;
    const j = await res.json();
    const c = j.current || {};
    const h = j.hourly || {};
    const d = j.daily || {};

    // Next 1 h and 3 h from the current hour
    const nowKey = (c.time || '').slice(0, 13);
    let i = (h.time || []).findIndex((t) => t.slice(0, 13) === nowKey);
    if (i < 0) i = 0;
    const prob = h.precipitation_probability || [];
    const rain = h.precipitation || [];
    const sum = (a, from, n) => a.slice(from, from + n).reduce((s, v) => s + (Number(v) || 0), 0);

    return {
      source: 'Open-Meteo',
      condition: describeWeatherCode(c.weather_code).text,
      tempC: c.temperature_2m ?? null,
      feelsLikeC: c.apparent_temperature ?? null,
      humidityPct: c.relative_humidity_2m ?? null,
      windSpeedKmh: c.wind_speed_10m ?? null,
      rainNowMm: c.precipitation ?? null,
      rainChancePct: prob[i + 1] ?? prob[i] ?? null,
      rainNext3hMm: Math.round(sum(rain, i + 1, 3) * 10) / 10,
      sunrise: hhmm((d.sunrise || [])[0]),
      sunset: hhmm((d.sunset || [])[0]),
      daily: (d.time || []).map((t, k) => ({
        day: DAY[new Date(`${t}T12:00:00`).getDay()],
        icon: describeWeatherCode((d.weather_code || [])[k]).icon,
        tMax: (d.temperature_2m_max || [])[k] ?? null,
        rainMm: (d.precipitation_sum || [])[k] ?? null
      }))
    };
  } catch (e) {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
