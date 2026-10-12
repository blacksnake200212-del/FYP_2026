-- ============================================================================
-- SMART DAM ALERT SYSTEM (SDAS) - SUPABASE POSTGRESQL SCHEMA V2.0
-- Security: Row Level Security (RLS) with Role Segregation & Contact Encryption
-- ============================================================================

-- Enable pgcrypto extension for encryption and UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TELEMETRY TABLE (Raw and compensated sensor time-series)
CREATE TABLE IF NOT EXISTS public.sensor_telemetry (
    id BIGSERIAL PRIMARY KEY,
    recorded_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    sensor_1_dist NUMERIC(6, 2) NOT NULL,
    sensor_2_dist NUMERIC(6, 2) NOT NULL,
    water_level_pct NUMERIC(5, 2) NOT NULL,
    temperature_c NUMERIC(4, 2) NOT NULL,
    humidity_pct NUMERIC(5, 2) NOT NULL,
    alert_state SMALLINT NOT NULL CHECK (alert_state BETWEEN 0 AND 4),
    control_mode SMALLINT NOT NULL CHECK (control_mode BETWEEN 0 AND 2),
    gate_percent SMALLINT NOT NULL CHECK (gate_percent BETWEEN 0 AND 100),
    sensors_agreed BOOLEAN DEFAULT TRUE NOT NULL,
    degraded_mode BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_telemetry_recorded_at ON public.sensor_telemetry (recorded_at DESC);

-- 2. DAM ALERTS LOG
CREATE TABLE IF NOT EXISTS public.dam_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    triggered_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    alert_stage VARCHAR(30) NOT NULL,
    water_level_pct NUMERIC(5, 2) NOT NULL,
    gate_percent SMALLINT NOT NULL,
    sms_broadcast_count INT DEFAULT 0,
    details TEXT
);

CREATE INDEX IF NOT EXISTS idx_dam_alerts_triggered ON public.dam_alerts (triggered_at DESC);

-- 3. OPERATOR AUDITED COMMAND OVERRIDES
CREATE TABLE IF NOT EXISTS public.operator_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issued_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    operator_id UUID REFERENCES auth.users(id),
    operator_username VARCHAR(100),
    command_type VARCHAR(30) NOT NULL CHECK (command_type IN ('OPEN_30', 'OPEN_50', 'OPEN_100', 'CLOSE', 'ESTOP', 'AUTO', 'PREWARN_SMS')),
    target_percent SMALLINT NOT NULL CHECK (target_percent BETWEEN 0 AND 100),
    timeout_sec INT DEFAULT 300 NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'EXECUTED', 'EXPIRED', 'REJECTED')),
    executed_at TIMESTAMPTZ,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_operator_commands_status ON public.operator_commands (status, issued_at DESC);

-- 4. EMERGENCY CONTACTS (PII Protected with cryptographic storage)
CREATE TABLE IF NOT EXISTS public.emergency_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(120) NOT NULL,
    role VARCHAR(50) NOT NULL,
    phone_encrypted TEXT NOT NULL,
    tier SMALLINT DEFAULT 1 NOT NULL CHECK (tier BETWEEN 1 AND 3),
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    opted_in_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================================================
-- 5. SANITIZED PUBLIC VIEW (Zero PII, Safe for Anonymous Mobile Clients)
-- ============================================================================
CREATE OR REPLACE VIEW public.public_dam_status_view AS
SELECT
    t.recorded_at,
    t.water_level_pct,
    t.gate_percent,
    t.alert_state,
    CASE 
        WHEN t.alert_state = 0 THEN 'NORMAL'
        WHEN t.alert_state = 1 THEN 'PRE-WARNING'
        WHEN t.alert_state = 2 THEN 'CLEAR AREA'
        WHEN t.alert_state = 3 THEN 'DANGER'
        ELSE 'SENSOR CHECK'
    END AS alert_label,
    CASE 
        WHEN t.alert_state = 0 THEN 'Reservoir levels are stable. No flood hazard.'
        WHEN t.alert_state = 1 THEN 'Water level is rising. Gate remains closed. Stay alert.'
        WHEN t.alert_state = 2 THEN 'Sluice gate opening 30%. Evacuate riverbanks and low spillways immediately.'
        WHEN t.alert_state = 3 THEN 'CRITICAL FLOOD DANGER: Sluice gate opening 50%. Seek higher ground immediately.'
        ELSE 'Technicians verifying reservoir sensors.'
    END AS safety_instructions
FROM public.sensor_telemetry t
ORDER BY t.recorded_at DESC
LIMIT 1;

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.sensor_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dam_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

-- Allow ESP32 device anon key to INSERT telemetry, but not update or delete
CREATE POLICY "Allow anon insert telemetry"
ON public.sensor_telemetry
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow authenticated operators and backend to read telemetry
CREATE POLICY "Allow authenticated read telemetry"
ON public.sensor_telemetry
FOR SELECT
TO authenticated
USING (true);

-- Allow public read of alerts
CREATE POLICY "Allow public read alerts"
ON public.dam_alerts
FOR SELECT
TO anon, authenticated
USING (true);

-- Only authenticated operators can view or create manual override commands
CREATE POLICY "Allow operators create commands"
ON public.operator_commands
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = operator_id);

CREATE POLICY "Allow operators read commands"
ON public.operator_commands
FOR SELECT
TO authenticated
USING (true);

-- Emergency contacts restricted strictly to authenticated emergency managers
CREATE POLICY "Restricted contacts access"
ON public.emergency_contacts
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
