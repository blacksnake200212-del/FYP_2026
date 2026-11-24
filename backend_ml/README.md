# SDAS Rule-Based Decision Support Service

## 1. Overview
A small FastAPI server that gives operators **explainable, rule-based advice**. On supervisor
advice it replaces the earlier machine-learning models (MLP forecaster, autoencoder, random
forest). It is **advisory only**: the ESP32 firmware always controls the gate, siren and SMS
with its own thresholds, with or without this server.

All rules use the same numbers as `firmware/SDAS_ESP32_Firmware/config.h`
(50 cm sensor height, 40 cm usable depth, 60 / 80 / 85 % thresholds, 3 % hysteresis, 5 cm sensor limit).

---

## 2. Rules

| Engine | Rule | Output |
|---|---|---|
| **Trend forecast** | Straight line (least squares) through the last 60 one-minute readings, extended 60 minutes. Needs at least 5 readings; otherwise the level is held. | 1-hour level, trend (STABLE / RISING / RISING_FAST / FALLING), minutes to the next threshold |
| **Sensor checks** | R1: no echo or out of range → fault. R2: sensors differ by more than 5 cm → disagreement. R3: depth jumps more than 5 cm between readings → spike. | Verdict, rules fired, what to check |
| **Risk advice** | Stage from the 60 / 80 / 85 % thresholds. Advice is raised one stage early when the level is within 5 % of the next threshold **and** rising. | Stage, advisory stage, recommendation |
| **Weather** | Open-Meteo rain for Puttalam (8.036° N, 79.828° E), cached 10 min. | Current, next 1 h and 3 h rain |

No accuracy figures are claimed: measure them in the bench test (see the bench test sheet).

---

## 3. Running

```bash
pip install -r backend_ml/requirements.txt
uvicorn backend_ml.app.main:app --host 0.0.0.0 --port 8000

# Tests
python backend_ml/tests/test_rule_engine.py     # rules only, no packages needed
python -m pytest backend_ml/tests -q            # rules + API (needs fastapi, httpx)
```

No training step is needed. The old `train/`, `saved_models/` and `data/` folders are no
longer used and can be deleted.

---

## 4. API Endpoints

- `GET /` and `GET /health`: status.
- `POST /api/v1/forecast`: 1-hour trend forecast.
- `POST /api/v1/anomaly-check`: dual-sensor rule checks.
- `POST /api/v1/classify-risk`: stage and early-warning advice.
- `GET /api/v1/weather/puttalam`: rain from Open-Meteo.
- `POST /api/v1/telemetry-hook`: one reading in, sensor check + risk advice out (used by the Wokwi simulation).
