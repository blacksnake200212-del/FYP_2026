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

-- ============================================================================
-- 6. Insert Primary Dam Reservoir Profile (Kantalai Dam)
-- ============================================================================
INSERT INTO public.dams
(id, name, location, total_height_m, current_level_m, warning_level_m, danger_level_m, latitude, longitude, is_online)
VALUES
('KANTALAI-01', 'Kantalai Dam', 'Kantalai, Trincomalee', 3.00, 2.04, 2.40, 2.70, 8.528400, 80.992200, true)
ON CONFLICT (id) DO UPDATE
SET current_level_m = EXCLUDED.current_level_m,
    is_online = EXCLUDED.is_online;

-- ============================================================================
-- 7. Insert Crowdsourced Community Flood Reports (Aligned with Mobile UI Mockup)
-- ============================================================================
INSERT INTO public.flood_reports
(dam_id, reporter_name, location_name, latitude, longitude, distance_km, description, photo_url, water_depth_est, status, created_at)
VALUES
('KANTALAI-01', 'Tharindu Perera', 'Kantalai, 2.4 km away', 8.531200, 80.998500, 2.4, 'Water is covering the road near the bridge.', 'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=500', '0.6 m', 'VERIFIED', NOW() - INTERVAL '2 hours'),
('KANTALAI-01', 'Saman Bandara', 'Mahaweli Rd, 5.1 km', 8.512000, 80.975000, 5.1, 'Moderate water level on the road near agricultural canal.', 'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0?w=500', '0.4 m', 'PENDING', NOW() - INTERVAL '45 minutes'),
('KANTALAI-01', 'Kamal Silva', 'Paddithidal, 8.7 km', 8.485000, 80.940000, 8.7, 'Water entering low-lying village pathways. Drain overflow.', NULL, '0.3 m', 'PENDING', NOW() - INTERVAL '1 hour 15 minutes');

-- ============================================================================
-- 8. Insert Community Chat Channel Messages (Kantalai Community)
-- ============================================================================
INSERT INTO public.community_messages
(dam_id, sender_name, sender_role, message, photo_url, is_system, created_at)
VALUES
('KANTALAI-01', 'Tharindu', 'CITIZEN', 'Water is flowing near the old bridge.', 'https://images.unsplash.com/photo-1547683905-f686c993aae5?w=500', false, NOW() - INTERVAL '40 minutes'),
('KANTALAI-01', 'Saman', 'CITIZEN', 'Be careful everyone. Avoid this area.', NULL, false, NOW() - INTERVAL '35 minutes'),
('KANTALAI-01', 'System Operator', 'SYSTEM', 'This report is under verification by the operator.', NULL, true, NOW() - INTERVAL '30 minutes');


