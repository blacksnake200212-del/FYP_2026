"""
SDAS Water Level Forecaster Training Pipeline
Predicts reservoir water level 1 hour ahead (t + 60 min) using 60-min historical telemetry.
Evaluates with MAE, RMSE, and MAPE on a strict chronological test split (No label leakage).
"""

import os
import joblib
import numpy as np
import pandas as pd
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, root_mean_squared_error

def train_forecasting_model(data_path: str = "dataset_tank_simulation.csv", model_dir: str = "backend_ml/saved_models"):
    print("[TRAIN-FORECAST] Loading dataset from:", data_path)
    df = pd.read_csv(data_path)
    
    # Exclude anomalous intervals from training the nominal hydrological forecaster
    df_clean = df[df["is_anomaly"] == 0].copy().reset_index(drop=True)
    
    # Feature Engineering: 60-minute sequence window
    # Features: current level, 15m trend, 30m trend, 60m trend, rainfall sum 60m, gate percent
    history_window = 60
    forecast_horizon = 60 # 1 hour ahead
    
    X_list = []
    y_list = []
    
    levels = df_clean["water_level_pct"].values
    rainfall = df_clean["rainfall_mm"].values
    gates = df_clean["gate_percent"].values
    
    for i in range(history_window, len(df_clean) - forecast_horizon):
        # Rolling level features
        past_levels = levels[i - history_window:i]
        past_rain = rainfall[i - history_window:i]
        
        feature_vec = [
            levels[i],                           # current level
            levels[i] - past_levels[-15],        # 15-min delta
            levels[i] - past_levels[-30],        # 30-min delta
            levels[i] - past_levels[0],          # 60-min delta
            np.mean(past_levels),                # 60-min mean
            np.std(past_levels),                 # 60-min volatility
            np.sum(past_rain),                   # 60-min accumulated rainfall
            np.max(past_rain),                   # peak rainfall intensity
            gates[i]                             # current gate position
        ]
        
        target = levels[i + forecast_horizon]    # Water level at t + 60 min
        X_list.append(feature_vec)
        y_list.append(target)
        
    X = np.array(X_list)
    y = np.array(y_list)
    
    # Strict Chronological Train/Test Split (75% Train, 25% Test) - Zero Shuffling
    split_idx = int(len(X) * 0.75)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]
    
    print(f"[TRAIN-FORECAST] Train samples: {len(X_train)} | Test samples: {len(X_test)}")
    
    # Feature Normalization
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Train Multi-Layer Neural Sequence Forecaster (Equivalent to recurrent dense representation)
    model = MLPRegressor(
        hidden_layer_sizes=(64, 32),
        activation="relu",
        solver="adam",
        max_iter=300,
        random_state=42,
        early_stopping=True,
        validation_fraction=0.15
    )
    
    print("[TRAIN-FORECAST] Training neural regressor...")
    model.fit(X_train_scaled, y_train)
    
    # Evaluation on Held-Out Test Set
    y_pred = model.predict(X_test_scaled)
    
    mae = mean_absolute_error(y_test, y_pred)
    rmse = root_mean_squared_error(y_test, y_pred)
    
    # Non-leaking MAPE: evaluated only above 20% reservoir datum
    mask_above_20 = y_test >= 20.0
    if np.sum(mask_above_20) > 0:
        mape = np.mean(np.abs((y_test[mask_above_20] - y_pred[mask_above_20]) / y_test[mask_above_20])) * 100.0
    else:
        mape = np.mean(np.abs((y_test - y_pred) / y_test)) * 100.0
        
    print("\n=======================================================")
    print("  1-HOUR AHEAD WATER LEVEL FORECASTER EVALUATION")
    print("=======================================================")
    print(f"  Mean Absolute Error (MAE):     {mae:.2f} % (Tank Scale: ~{mae * 0.40:.2f} cm)")
    print(f"  Root Mean Squared Error (RMSE): {rmse:.2f} % (Tank Scale: ~{rmse * 0.40:.2f} cm)")
    print(f"  Filtered MAPE (>20% Datum):    {mape:.2f} %")
    print("=======================================================\n")
    
    os.makedirs(model_dir, exist_ok=True)
    model_bundle = {
        "model": model,
        "scaler": scaler,
        "metrics": {"mae": mae, "rmse": rmse, "mape": mape},
        "history_window": history_window,
        "forecast_horizon": forecast_horizon
    }
    
    save_path = os.path.join(model_dir, "water_level_forecaster.joblib")
    joblib.dump(model_bundle, save_path)
    print(f"[TRAIN-FORECAST] Model successfully persisted to {save_path}")
    return model_bundle

if __name__ == "__main__":
    train_forecasting_model()
