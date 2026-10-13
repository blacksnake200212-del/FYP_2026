-- ============================================================================
-- SMART DAM ALERT SYSTEM (SDAS) - SUPABASE POSTGRESQL SCHEMA V3.0
-- Aligned with Master Mobile App Blueprint
-- Security: Row Level Security (RLS) with Role Segregation & Contact Encryption
-- ============================================================================

-- Enable pgcrypto extension for encryption and UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. READINGS TABLE (Raw and compensated sensor time-series)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.readings (
    id BIGSERIAL PRIMARY KEY,
    device_id VARCHAR(50) DEFAULT 'SDAS-NODE-01' NOT NULL,
    level_pct NUMERIC(5, 2) NOT NULL,
    distance_1 NUMERIC(6, 2) NOT NULL,
    distance_2 NUMERIC(6, 2) NOT NULL,
    temperature NUMERIC(4, 2) NOT NULL,
    humidity NUMERIC(5, 2) NOT NULL,
    alert_state SMALLINT NOT NULL CHECK (alert_state BETWEEN 0 AND 4),
    control_mode SMALLINT NOT NULL CHECK (control_mode BETWEEN 0 AND 2),
    gate_percent SMALLINT NOT NULL CHECK (gate_percent BETWEEN 0 AND 100),
    sensors_agreed BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_readings_created_at ON public.readings (created_at DESC);

-- ============================================================================
-- 2. FORECASTS TABLE (1-hour ahead AI predictions from XGBoost/LSTM)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(50) DEFAULT 'SDAS-NODE-01' NOT NULL,
    horizon_min INT DEFAULT 60 NOT NULL,
    predicted_level NUMERIC(5, 2) NOT NULL,
    risk_class VARCHAR(30) NOT NULL,
    confidence NUMERIC(4, 3) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_forecasts_created_at ON public.forecasts (created_at DESC);

-- ============================================================================
-- 3. ALERTS TABLE (Timeline of dam warnings, auto & manual)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage VARCHAR(30) NOT NULL,
    source VARCHAR(20) DEFAULT 'AUTO' CHECK (source IN ('AUTO', 'MANUAL')),
    message TEXT NOT NULL,
    water_level_pct NUMERIC(5, 2),
    gate_percent SMALLINT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON public.alerts (created_at DESC);

-- ============================================================================
-- 4. COMMANDS TABLE (Audited operator manual gate overrides)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schema_version INT DEFAULT 1 NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('OPEN_20', 'OPEN_50', 'CLOSE', 'ESTOP', 'AUTO', 'PREWARN_SMS')),
    params JSONB DEFAULT '{}'::jsonb,
    issued_by UUID REFERENCES auth.users(id),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACKNOWLEDGED', 'EXECUTED', 'EXPIRED', 'REJECTED')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_commands_status ON public.commands (status, created_at DESC);

-- ============================================================================
-- 5. SMS_JOBS TABLE (Cellular emergency dispatch tracking via SIM800L)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sms_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT NOT NULL,
    recipient_group VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'SENDING', 'COMPLETED', 'FAILED')),
    delivered_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sms_jobs_created_at ON public.sms_jobs (created_at DESC);

-- ============================================================================
-- 6. CONTACTS TABLE (Emergency phone numbers with encrypted storage)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    phone_encrypted TEXT NOT NULL,
    role VARCHAR(50) NOT NULL,
    recipient_group VARCHAR(50) DEFAULT 'OPERATOR' NOT NULL,
    tier SMALLINT DEFAULT 1 NOT NULL CHECK (tier BETWEEN 1 AND 3),
    opted_in BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================================================
-- 7. PUSH_TOKENS TABLE (Anonymous push notification device tokens)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL,
    language VARCHAR(10) DEFAULT 'en' NOT NULL,
    app_version VARCHAR(20) DEFAULT '2.0.0' NOT NULL,
    platform VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================================================
-- 8. APP_CONFIG TABLE (OTA & Store Version Control for Both Mobile Apps)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.app_config (
    app_id VARCHAR(50) PRIMARY KEY, -- 'public_app', 'operator_app'
    min_supported_version VARCHAR(20) NOT NULL,
    latest_version VARCHAR(20) NOT NULL,
    update_message TEXT,
    store_url TEXT,
    apk_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================================================
-- 8. PROFILES TABLE (Operator and Admin user roles)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(120),
    role VARCHAR(30) DEFAULT 'OPERATOR' CHECK (role IN ('OPERATOR', 'ADMIN')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================================================
-- 9. AUDIT_LOG TABLE (Immutable record of all sensitive actions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log (created_at DESC);

-- ============================================================================
-- 10. SANITIZED PUBLIC VIEW (Zero PII, Safe for Anonymous Mobile App)
-- ============================================================================
CREATE OR REPLACE VIEW public.public_status AS
SELECT
    r.level_pct,
    CASE 
        WHEN r.alert_state = 0 THEN 'NORMAL'
        WHEN r.alert_state = 1 THEN 'PRE-WARNING'
        WHEN r.alert_state = 2 THEN 'CLEAR AREA'
        WHEN r.alert_state = 3 THEN 'DANGER'
        ELSE 'MAINTENANCE'
    END AS status,
    CASE
        WHEN f.predicted_level > r.level_pct + 1.0 THEN 'RISING'
        WHEN f.predicted_level < r.level_pct - 1.0 THEN 'FALLING'
        ELSE 'STEADY'
    END AS trend,
    r.gate_percent,
    r.created_at AS updated_at
FROM public.readings r
LEFT JOIN LATERAL (
    SELECT predicted_level FROM public.forecasts 
    ORDER BY created_at DESC LIMIT 1
) f ON true
ORDER BY r.created_at DESC
LIMIT 1;

-- Versioned Public Contract View (Guarantees backward compatibility for older apps)
CREATE OR REPLACE VIEW public.public_status_v1 AS
SELECT * FROM public.public_status;

-- ============================================================================
-- 11. BACKWARDS COMPATIBILITY VIEWS (For existing ESP32 firmware / endpoints)
-- ============================================================================
CREATE OR REPLACE VIEW public.sensor_telemetry AS
SELECT
    id,
    created_at AS recorded_at,
    distance_1 AS sensor_1_dist,
    distance_2 AS sensor_2_dist,
    level_pct AS water_level_pct,
    temperature AS temperature_c,
    humidity AS humidity_pct,
    alert_state,
    control_mode,
    gate_percent,
    sensors_agreed,
    false AS degraded_mode
FROM public.readings;

CREATE OR REPLACE VIEW public.dam_alerts AS
SELECT
    id,
    created_at AS triggered_at,
    stage AS alert_stage,
    water_level_pct,
    gate_percent,
    0 AS sms_broadcast_count,
    message AS details
FROM public.alerts;

CREATE OR REPLACE VIEW public.operator_commands AS
SELECT
    id,
    created_at AS issued_at,
    issued_by AS operator_id,
    'OPERATOR' AS operator_username,
    type AS command_type,
    COALESCE((params->>'target_percent')::SMALLINT, 0) AS target_percent,
    300 AS timeout_sec,
    status,
    NULL::TIMESTAMPTZ AS executed_at,
    params::TEXT AS notes
FROM public.commands;

CREATE OR REPLACE VIEW public.emergency_contacts AS
SELECT
    id,
    name AS full_name,
    role,
    phone_encrypted,
    tier,
    opted_in AS is_active,
    created_at AS opted_in_at
FROM public.contacts;

CREATE OR REPLACE VIEW public.public_dam_status_view AS
SELECT
    updated_at AS recorded_at,
    level_pct AS water_level_pct,
    gate_percent,
    CASE 
        WHEN status = 'NORMAL' THEN 0
        WHEN status = 'PRE-WARNING' THEN 1
        WHEN status = 'CLEAR AREA' THEN 2
        WHEN status = 'DANGER' THEN 3
        ELSE 4
    END AS alert_state,
    status AS alert_label,
    CASE 
        WHEN status = 'NORMAL' THEN 'Reservoir levels are stable. No flood hazard.'
        WHEN status = 'PRE-WARNING' THEN 'Water level is rising. Gate remains closed. Stay alert.'
        WHEN status = 'CLEAR AREA' THEN 'Sluice gate opening 20%. Evacuate riverbanks and low spillways immediately.'
        WHEN status = 'DANGER' THEN 'CRITICAL FLOOD DANGER: Sluice gate opening 50%. Seek higher ground immediately.'
        ELSE 'Technicians verifying reservoir sensors.'
    END AS safety_instructions
FROM public.public_status;

-- ============================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Readings: Device insert via Edge Function/Key; Authenticated Operators read
CREATE POLICY "Allow device insert readings"
ON public.readings FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow operators read readings"
ON public.readings FOR SELECT TO authenticated
USING (true);

-- Forecasts: Service/backend insert; Authenticated Operators read
CREATE POLICY "Allow service insert forecasts"
ON public.forecasts FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow operators read forecasts"
ON public.forecasts FOR SELECT TO authenticated
USING (true);

-- Alerts: Authenticated insert; Public anonymous read via view
CREATE POLICY "Allow insert alerts"
ON public.alerts FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow public read alerts"
ON public.alerts FOR SELECT TO anon, authenticated
USING (true);

-- Commands: Authenticated operators insert and read
CREATE POLICY "Allow operators insert commands"
ON public.commands FOR INSERT TO authenticated
WITH CHECK (auth.uid() = issued_by);

CREATE POLICY "Allow operators read commands"
ON public.commands FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Allow operators update commands"
ON public.commands FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

-- SMS Jobs: Operators only
CREATE POLICY "Allow operators manage sms_jobs"
ON public.sms_jobs FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- Contacts: Admins only
CREATE POLICY "Allow admins manage contacts"
ON public.contacts FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'ADMIN')
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'ADMIN')
);

-- Push Tokens: Public insert-only (no public read/delete)
CREATE POLICY "Allow public insert push_tokens"
ON public.push_tokens FOR INSERT TO anon, authenticated
WITH CHECK (true);

-- App Config: Public read-only; Admins manage
CREATE POLICY "Allow public read app_config"
ON public.app_config FOR SELECT TO anon, authenticated
USING (true);

CREATE POLICY "Allow admins manage app_config"
ON public.app_config FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'ADMIN')
)
WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'ADMIN')
);

-- Profiles: Users read own profile; Admins read/manage all
CREATE POLICY "Allow users read own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'ADMIN'));

-- Audit Log: Authenticated insert; Admins read; No delete
CREATE POLICY "Allow insert audit_log"
ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow admins read audit_log"
ON public.audit_log FOR SELECT TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'ADMIN')
);
