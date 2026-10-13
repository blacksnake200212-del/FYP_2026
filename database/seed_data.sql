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

-- 4. Insert emergency contacts (Encrypted representation)
INSERT INTO public.contacts
(name, phone_encrypted, role, recipient_group, tier, opted_in)
VALUES
('Chief Irrigation Engineer - Puttalam', 'enc_aes256_0771234567', 'OPERATOR', 'ENGINEERS', 1, true),
('Duty Control Officer - Tabbowa Dam', 'enc_aes256_0719876543', 'OPERATOR', 'ENGINEERS', 1, true),
('Disaster Management Centre (DMC) Call Center', 'enc_aes256_0112670002', 'DMC_OFFICER', 'DMC', 2, true),
('Anamaduwa Divisional Secretariat', 'enc_aes256_0322263223', 'COMMUNITY_LEADER', 'PUBLIC', 3, true);
