-- DEMO DATA ONLY: example readings, alerts, flood reports and chat messages for screenshots
-- and practice. Do NOT run this on the database used for the real bench test or the demo,
-- or the made-up rows will appear in the apps as if they were real.
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
-- FIX: schema.sql already inserts these same 4 numbers (as plain '+94...'). Inserting them
-- again here created duplicate rows, so each phone could receive every alert twice.
-- Only insert a number if it is not stored yet in either format.
-- NOTE: 'enc_aes256_' is only a text prefix, NOT encryption. See FIXES.md.
INSERT INTO public.contacts
(name, phone_encrypted, role, recipient_group, tier, opted_in)
SELECT v.name, v.phone, v.role, v.grp, v.tier, true
FROM (VALUES
    ('Testing Number 1 (Adrian)', 'enc_aes256_+94740099235', 'OPERATOR', 'ENGINEERS', 1),
    ('Testing Number 2 (Disaster Unit)', 'enc_aes256_+94778364925', 'OPERATOR', 'ENGINEERS', 1),
    ('Testing Number 3 (Aadhil)', 'enc_aes256_+94712833936', 'OPERATOR', 'ENGINEERS', 1),
    ('Testing Number 4 (Dilshan / DMC)', 'enc_aes256_+94781099235', 'DMC_OFFICER', 'DMC', 2)
) AS v(name, phone, role, grp, tier)
WHERE NOT EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.phone_encrypted IN (v.phone, replace(v.phone, 'enc_aes256_', ''))
);

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
-- 6. Insert Primary Dam Reservoir Profile (Tabbowa Dam)
-- ============================================================================
INSERT INTO public.dams
(id, name, location, total_height_m, current_level_m, warning_level_m, danger_level_m, latitude, longitude, is_online)
VALUES
('TABBOWA-01', 'Tabbowa Dam', 'Puttalam District', 3.00, 2.04, 2.40, 2.70, 8.036200, 79.828300, true)
ON CONFLICT (id) DO UPDATE
SET current_level_m = EXCLUDED.current_level_m,
    is_online = EXCLUDED.is_online;

-- ============================================================================
-- 7. Insert SAMPLE Crowdsourced Flood Reports (demo data only, delete before real use)
-- ============================================================================
-- FIX: these used Kantalai (Trincomalee) places/coordinates and stock internet flood photos.
-- They are now clearly marked samples near Tabbowa Dam (Puttalam), with no photos.
INSERT INTO public.flood_reports
(dam_id, reporter_name, location_name, latitude, longitude, distance_km, description, photo_url, water_depth_est, status, created_at)
VALUES
('TABBOWA-01', 'Sample Reporter 1', '[SAMPLE] Road near Tabbowa spill canal (typed by citizen, no GPS)', 8.036200, 79.828300, 2.4, 'SAMPLE: Water is covering the road near the bridge.', NULL, NULL, 'VERIFIED', NOW() - INTERVAL '2 hours'),
('TABBOWA-01', 'Sample Reporter 2', '[SAMPLE] Paddy field road, downstream (typed by citizen, no GPS)', 8.036200, 79.828300, 5.1, 'SAMPLE: Moderate water level on the road near the agricultural canal.', NULL, NULL, 'PENDING', NOW() - INTERVAL '45 minutes'),
('TABBOWA-01', 'Sample Reporter 3', '[SAMPLE] Low-lying village path (typed by citizen, no GPS)', 8.036200, 79.828300, 8.7, 'SAMPLE: Water entering low-lying village pathways. Drain overflow.', NULL, NULL, 'PENDING', NOW() - INTERVAL '1 hour 15 minutes');

-- ============================================================================
-- 8. Insert SAMPLE Community Chat Channel Messages (Tabbowa community, demo data only)
-- ============================================================================
INSERT INTO public.community_messages
(dam_id, sender_name, sender_role, message, photo_url, is_system, created_at)
VALUES
('TABBOWA-01', 'Tharindu', 'CITIZEN', 'Water is flowing near the old bridge.', NULL, false, NOW() - INTERVAL '40 minutes'),
('TABBOWA-01', 'Saman', 'CITIZEN', 'Be careful everyone. Avoid this area.', NULL, false, NOW() - INTERVAL '35 minutes'),
('TABBOWA-01', 'System Operator', 'SYSTEM', 'This report is under verification by the operator.', NULL, true, NOW() - INTERVAL '30 minutes');


