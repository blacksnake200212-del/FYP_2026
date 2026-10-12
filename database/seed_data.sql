-- ============================================================================
-- SMART DAM ALERT SYSTEM (SDAS) - SEED DATA FOR TESTING & VERIFICATION
-- ============================================================================

-- Insert sample calibrated telemetry records
INSERT INTO public.sensor_telemetry 
(recorded_at, sensor_1_dist, sensor_2_dist, water_level_pct, temperature_c, humidity_pct, alert_state, control_mode, gate_percent, sensors_agreed, degraded_mode)
VALUES
(NOW() - INTERVAL '20 minutes', 45.2, 45.1, 49.5, 28.4, 76.2, 0, 0, 0, true, false),
(NOW() - INTERVAL '15 minutes', 42.1, 42.3, 57.2, 28.5, 76.5, 0, 0, 0, true, false),
(NOW() - INTERVAL '10 minutes', 40.0, 39.8, 62.5, 28.6, 77.0, 1, 0, 0, true, false),
(NOW() - INTERVAL '5 minutes',  32.5, 32.7, 81.2, 28.8, 78.1, 2, 0, 30, true, false),
(NOW() - INTERVAL '1 minute',   30.8, 31.0, 85.5, 28.9, 78.4, 3, 0, 50, true, false);

-- Insert logged alerts
INSERT INTO public.dam_alerts 
(triggered_at, alert_stage, water_level_pct, gate_percent, sms_broadcast_count, details)
VALUES
(NOW() - INTERVAL '5 minutes', 'CLEAR_AREA', 81.2, 30, 3, 'Water breached 80% threshold. Automated 30% gate release initiated.'),
(NOW() - INTERVAL '1 minute', 'DANGER', 85.5, 50, 3, 'Water breached 85% critical threshold. Automated 50% gate release and local siren active.');

-- Insert emergency contact directory (Encrypted representation)
INSERT INTO public.emergency_contacts
(full_name, role, phone_encrypted, tier, is_active)
VALUES
('Chief Irrigation Engineer - Puttalam', 'OPERATOR', 'enc_aes256_0771234567', 1, true),
('Duty Control Officer - Tabbowa Dam', 'OPERATOR', 'enc_aes256_0719876543', 1, true),
('Disaster Management Centre (DMC) Call Center', 'DMC_OFFICER', 'enc_aes256_0112670002', 2, true),
('Anamaduwa Divisional Secretariat', 'COMMUNITY_LEADER', 'enc_aes256_0322263223', 3, true);
