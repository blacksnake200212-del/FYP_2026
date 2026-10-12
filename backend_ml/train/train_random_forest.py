"""
SDAS Random Forest Hazard Classifier Training Pipeline
Classifies reservoir operational hazard tiers [0: NORMAL, 1: PRE-WARNING, 2: CLEAR AREA, 3: DANGER]
using multi-sensor telemetry, rainfall accumulation, and inflow rate features.
"""

import os
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix

def train_rf_classifier(data_path: str = "dataset_tank_simulation.csv", model_dir: str = "backend_ml/saved_models"):
    print("[TRAIN-RF] Loading dataset from:", data_path)
    df = pd.read_csv(data_path)
    
    # 1. Feature Engineering
    df["rate_of_change"] = np.abs(df["water_level_cm"].diff().fillna(0))
    df["rain_accum_30m"] = df["rainfall_mm"].rolling(window=30, min_periods=1).sum()
    
    # Target Class Generation based on Ground Truth Dam State
    # 0 = NORMAL (<60%), 1 = PRE-WARNING (60-80%), 2 = CLEAR AREA (80-85%), 3 = DANGER (>=85%)
    conditions = [
        (df["water_level_pct"] < 60.0),
        (df["water_level_pct"] >= 60.0) & (df["water_level_pct"] < 80.0),
        (df["water_level_pct"] >= 80.0) & (df["water_level_pct"] < 85.0),
        (df["water_level_pct"] >= 85.0)
    ]
    choices = [0, 1, 2, 3]
    df["hazard_class"] = np.select(conditions, choices, default=0)
    
    feature_cols = ["water_level_pct", "rate_of_change", "rain_accum_30m", "gate_percent", "temperature_c"]
    X = df[feature_cols].values
    y = df["hazard_class"].values
    
    # Strict Chronological Train/Test Split (75% Train, 25% Test)
    split_idx = int(len(df) * 0.75)
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]
    
    # Random Forest Ensemble
    rf = RandomForestClassifier(
        n_estimators=100,
        max_depth=8,
        min_samples_split=5,
        random_state=42,
        class_weight="balanced"
    )
    
    print("[TRAIN-RF] Training Random Forest classifier...")
    rf.fit(X_train, y_train)
    
    # Evaluation on Held-Out Test Horizon
    y_pred = rf.predict(X_test)
    class_names = ["NORMAL", "PRE-WARNING", "CLEAR AREA", "DANGER"]
    
    labels = [0, 1, 2, 3]
    report = classification_report(y_test, y_pred, labels=labels, target_names=class_names, zero_division=0)
    conf_matrix = confusion_matrix(y_test, y_pred, labels=labels)
    
    print("\n=======================================================")
    print("  RANDOM FOREST HAZARD CLASSIFIER EVALUATION")
    print("=======================================================")
    print(report)
    print("Confusion Matrix:\n", conf_matrix)
    print("=======================================================\n")
    
    os.makedirs(model_dir, exist_ok=True)
    bundle = {
        "model": rf,
        "feature_cols": feature_cols,
        "class_names": class_names,
        "feature_importances": dict(zip(feature_cols, rf.feature_importances_))
    }
    
    save_path = os.path.join(model_dir, "random_forest_risk_classifier.joblib")
    joblib.dump(bundle, save_path)
    print(f"[TRAIN-RF] Model saved to {save_path}")
    return bundle

if __name__ == "__main__":
    train_rf_classifier()
