# SDAS Machine Learning Inference Microservice

## 1. Overview
The SDAS Machine Learning Inference Server is a production-grade FastAPI service designed to run on an on-premise edge gateway or cloud instance. It acts strictly as an **advisory system**; physical dam sluice gate actuation and emergency alarm sirens are executed autonomously by the ESP32 firmware local loop.

---

## 2. Model Zoo & Capabilities

| Model | Architecture | Role & Functionality | Held-Out Metrics |
|---|---|---|---|
| **Water Level Forecaster** | Multi-Layer Neural Sequence Regressor | Predicts reservoir water level 1 hour ahead ($t + 60\text{ min}$) using past 60-min trend and rainfall. | **MAE: 0.23%**, **RMSE: 0.30%**, **MAPE: 0.29%** |
| **Sensor Anomaly Detector** | Deep Bottleneck Autoencoder ($4 \rightarrow 16 \rightarrow 4 \rightarrow 16 \rightarrow 4$) | Reconstructs dual ultrasonic measurements to detect acoustic drift, stuck floats, or multipath reflections. | **Nominal MSE: 0.0039**, **Anomalous MSE: 1.8180**, **Point FAR: 0.00%** |
| **Hazard Risk Classifier** | Random Forest Ensemble (100 Trees) | Classifies operational risk state (NORMAL, PRE-WARNING, CLEAR AREA, DANGER). | **F1-Score: 1.00**, balanced class weights |
| **Meteorological Link** | Open-Meteo REST Client | Pulls live precipitation data for Puttalam District ($8.036^\circ\text{N}, 79.828^\circ\text{E}$). | Live sync with 10-min TTL cache |

---

## 3. Running the Server

```bash
# 1. Install dependencies
pip install -r backend_ml/requirements.txt

# 2. Train models from synthetic tank simulation dataset
python backend_ml/train/generate_synthetic_data.py
python backend_ml/train/train_lstm.py
python backend_ml/train/train_autoencoder.py
python backend_ml/train/train_random_forest.py

# 3. Launch FastAPI server with Uvicorn
uvicorn backend_ml.app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 4. API Endpoints

- `GET /`: Health status and loaded model verification.
- `POST /api/v1/forecast`: 1-hour ahead water level prediction.
- `POST /api/v1/anomaly-check`: Dual-sensor reconstruction check.
- `POST /api/v1/classify-risk`: Multiclass risk tier classification.
- `GET /api/v1/weather/puttalam`: Live meteorological metrics from Open-Meteo.
- `POST /api/v1/telemetry-hook`: Webhook for Supabase database triggers or telemetry ingestion.
