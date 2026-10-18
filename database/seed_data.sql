-- ============================================================================
-- SMART DAM ALERT SYSTEM (SDAS) - SEED DATA FOR TESTING & VERIFICATION V3.0
-- ============================================================================

-- 1. Insert sample readings (telemetry time-series)
INSERT INTO public.readings 
(created_at, device_id, distance_1, distance_2, level_pct, temperature, humidity, alert_state, control_mode, gate_percent, sensors_agreed)
VALUES
(NOW() - INTERVAL '20 minutes', 'SDAS-NODE-01', 45.2, 45.1, 49.5, 28.4, 76.2, 0, 0, 0, true),
(NOW() - INTERVAL '15 minutes', 'SDAS-NODE-01', 42.1, 42.3, 57.2, 28.5, 76.5, 0, 0, 0, true),
(NOW() - INTERVAL '10 minutes', 'SDAS-NODE-01', 40.0, 39.8, 62.5, 28.6, 77.0, 1, 0, 0, true),
(NOW() - INTERVAL '5 minutes',  'SDAS-NODE-01', 32.5, 32.7, 81.2, 28.8, 78.1, 2, 0, 20, true),
(NOW() - INTERVAL '1 minute',   'SDAS-NODE-01', 30.8, 31.0, 85.5, 28.9, 78.4, 3, 0, 50, true);

-- 2. Insert AI forecasts
INSERT INTO public.forecasts
(device_id, horizon_min, predicted_level, risk_class, confidence, created_at)
VALUES
('SDAS-NODE-01', 60, 88.2, 'DANGER', 0.942, NOW() - INTERVAL '1 minute');

-- 3. Insert logged alerts
INSERT INTO public.alerts 
(created_at, stage, source, message, water_level_pct, gate_percent)
VALUES
(NOW() - INTERVAL '5 minutes', 'CLEAR_AREA', 'AUTO', 'Water breached 80% threshold. Automated 20% gate release initiated.', 81.2, 20),
(NOW() - INTERVAL '1 minute', 'DANGER', 'AUTO', 'Water breached 85% critical threshold. Automated 50% gate release and local siren active.', 85.5, 50);

-- 4. Insert emergency contacts (Configured with User Testing Numbers)
INSERT INTO public.contacts
(name, phone_encrypted, role, recipient_group, tier, opted_in)
VALUES
('Testing Number 1 (Adrian)', 'enc_aes256_+94740099235', 'OPERATOR', 'ENGINEERS', 1, true),
('Testing Number 2 (Aadhil)', 'enc_aes256_+94712833936', 'OPERATOR', 'ENGINEERS', 1, true),
('Testing Number 3 (Dilshan / DMC)', 'enc_aes256_+94781099235', 'DMC_OFFICER', 'DMC', 2, true);

-- 5. Insert App Config version metadata (OTA & Store Update Control)
INSERT INTO public.app_config
(app_id, min_supported_version, latest_version, update_message, store_url, apk_url)
VALUES
('public_app', '2.0.0', '2.0.0', 'New flood risk forecasting maps and performance enhancements.', 'https://play.google.com/store/apps/details?id=com.sdas.publicportal', 'https://github.com/blacksnake200212-del/FYP_2026/releases/latest/download/public_app.apk'),
('operator_app', '2.0.0', '2.0.0', 'Security updates and refined gate override watchdog telemetry.', 'https://play.google.com/store/apps/details?id=com.sdas.operatorconsole', 'https://github.com/blacksnake200212-del/FYP_2026/releases/latest/download/operator_app.apk')
ON CONFLICT (app_id) DO UPDATE 
SET min_supported_version = EXCLUDED.min_supported_version,
    latest_version = EXCLUDED.latest_version,
    update_message = EXCLUDED.update_message,
    store_url = EXCLUDED.store_url,
    apk_url = EXCLUDED.apk_url;

