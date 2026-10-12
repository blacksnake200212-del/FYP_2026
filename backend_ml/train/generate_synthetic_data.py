"""
SDAS Hydrological Dataset Generator (Tabbowa Dam Prototype Simulation)
Generates high-fidelity time-series telemetry representing reservoir inflow,
spillway discharge, Open-Meteo precipitation correlations, and sensor failure modes.
"""

import numpy as np
import pandas as pd
import os
from datetime import datetime, timedelta

def generate_sdas_dataset(num_hours: int = 168, output_path: str = "dataset_tank_simulation.csv"):
    """
    Generates 7 days (168 hours) of 1-minute sampled telemetry (10,080 samples).
    """
    np.random.seed(42)
    start_time = datetime(2026, 10, 1, 0, 0, 0)
    timestamps = [start_time + timedelta(minutes=i) for i in range(num_hours * 60)]
    n = len(timestamps)

    # 1. Environmental Simulation (Puttalam District climate)
    # Ambient Temperature: Diurnal cycle between 24°C (night) and 34°C (afternoon)
    hour_of_day = np.array([t.hour + t.minute / 60.0 for t in timestamps])
    temp_ambient = 29.0 - 5.0 * np.cos(2 * np.pi * (hour_of_day - 4) / 24.0) + np.random.normal(0, 0.4, n)
    humidity = 95.0 - (temp_ambient - 24.0) * 3.5 + np.random.normal(0, 1.0, n)
    humidity = np.clip(humidity, 45.0, 99.0)

    # 2. Precipitation Simulation (Inter-monsoonal storm surges)
    # Two major storm events on Day 2 and Day 5
    rainfall_mm = np.zeros(n)
    storm1_start = 24 * 60 + 300    # Day 2 morning
    storm1_end = storm1_start + 360 # 6 hours duration
    storm2_start = 4 * 24 * 60 + 600 # Day 5 afternoon
    storm2_end = storm2_start + 480 # 8 hours duration

    # Heavy tropical downpours (up to 45 mm/hr)
    rainfall_mm[storm1_start:storm1_end] = np.sin(np.linspace(0, np.pi, storm1_end - storm1_start)) * 38.0 + np.random.exponential(1.5, storm1_end - storm1_start)
    rainfall_mm[storm2_start:storm2_end] = np.sin(np.linspace(0, np.pi, storm2_end - storm2_start)) * 52.0 + np.random.exponential(2.0, storm2_end - storm2_start)
    # Light background drizzle
    background_rain = np.random.choice([0.0, 0.2, 0.8], size=n, p=[0.92, 0.06, 0.02])
    rainfall_mm += background_rain

    # 3. Reservoir Water Level Dynamics (Continuity Equation: dL/dt = Inflow - Outflow)
    # Tank max depth = 40.0 cm (representing 100% full capacity)
    water_level_cm = np.zeros(n)
    gate_percent = np.zeros(n, dtype=int)
    
    current_level = 18.0 # Starting at 45% of 40cm
    base_inflow = 0.015  # cm/min steady river inflow
    evaporation_loss = 0.005 # cm/min

    for i in range(n):
        rain_inflow = (rainfall_mm[i] / 60.0) * 0.12 # Runoff conversion coefficient
        total_inflow = base_inflow + rain_inflow
        
        # Current level percentage
        level_pct = (current_level / 40.0) * 100.0
        
        # Autonomous gate control logic with 3% hysteresis
        current_gate = gate_percent[i - 1] if i > 0 else 0
        if level_pct >= 85.0:
            target_gate = 50
        elif level_pct >= 80.0:
            target_gate = 30
        elif level_pct < 77.0 and current_gate == 30:
            target_gate = 0
        elif level_pct < 82.0 and current_gate == 50:
            target_gate = 30
        else:
            target_gate = current_gate
            
        gate_percent[i] = target_gate
        outflow_discharge = (target_gate / 100.0) * 0.14 # cm/min discharge capacity
        
        current_level += (total_inflow - outflow_discharge - evaporation_loss)
        current_level = np.clip(current_level, 5.0, 40.0)
        water_level_cm[i] = current_level

    water_level_pct = (water_level_cm / 40.0) * 100.0

    # 4. Sensor Measurement Synthesis with Speed-of-Sound Compensation
    # Distance from sensor (mounted at 65 cm) = 65 - water_level_cm
    true_distance_cm = 65.0 - water_level_cm
    
    # Speed of sound v = 331.4 + 0.606 * T
    speed_of_sound = 331.4 + (0.606 * temp_ambient)
    
    # Acoustic measurement noise (±0.8 cm Gaussian jitter)
    sensor_1_raw = true_distance_cm + np.random.normal(0, 0.4, n)
    sensor_2_raw = true_distance_cm + np.random.normal(0, 0.4, n)

    # 5. Injection of Sensor Malfunctions & Anomalies (for Autoencoder validation)
    is_anomaly = np.zeros(n, dtype=int)
    anomaly_type = ["NORMAL"] * n

    # Anomaly Event 1: Single sensor debris / multipath divergence (Sensor 1 jumps 12 cm)
    anom1_start, anom1_end = 1200, 1260
    sensor_1_raw[anom1_start:anom1_end] += 12.5
    is_anomaly[anom1_start:anom1_end] = 1
    for k in range(anom1_start, anom1_end): anomaly_type[k] = "SENSOR1_DIVERGENCE"

    # Anomaly Event 2: Frozen / Stuck transducer (Sensor 2 stuck at constant value during storm)
    anom2_start, anom2_end = 3600, 3680
    sensor_2_raw[anom2_start:anom2_end] = sensor_2_raw[anom2_start]
    is_anomaly[anom2_start:anom2_end] = 1
    for k in range(anom2_start, anom2_end): anomaly_type[k] = "SENSOR2_STUCK"

    # Anomaly Event 3: High-frequency electrical noise burst on both channels
    anom3_start, anom3_end = 6500, 6540
    sensor_1_raw[anom3_start:anom3_end] += np.random.normal(0, 6.0, anom3_end - anom3_start)
    sensor_2_raw[anom3_start:anom3_end] += np.random.normal(0, 6.0, anom3_end - anom3_start)
    is_anomaly[anom3_start:anom3_end] = 1
    for k in range(anom3_start, anom3_end): anomaly_type[k] = "NOISE_BURST"

    sensor_delta_cm = np.abs(sensor_1_raw - sensor_2_raw)

    # Assemble DataFrame
    df = pd.DataFrame({
        "timestamp": timestamps,
        "water_level_cm": np.round(water_level_cm, 2),
        "water_level_pct": np.round(water_level_pct, 2),
        "rainfall_mm": np.round(rainfall_mm, 2),
        "temperature_c": np.round(temp_ambient, 2),
        "humidity_pct": np.round(humidity, 2),
        "speed_of_sound_mps": np.round(speed_of_sound, 2),
        "sensor_1_raw_cm": np.round(sensor_1_raw, 2),
        "sensor_2_raw_cm": np.round(sensor_2_raw, 2),
        "sensor_delta_cm": np.round(sensor_delta_cm, 2),
        "gate_percent": gate_percent,
        "is_anomaly": is_anomaly,
        "anomaly_type": anomaly_type
    })

    os.makedirs(os.path.dirname(output_path), exist_ok=True) if os.path.dirname(output_path) else None
    df.to_csv(output_path, index=False)
    print(f"[DATASET] Successfully generated {len(df)} samples saved to {output_path}")
    return df

if __name__ == "__main__":
    generate_sdas_dataset(num_hours=168, output_path="dataset_tank_simulation.csv")
