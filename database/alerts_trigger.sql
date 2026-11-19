-- ============================================================================
-- SDAS - AUTOMATIC ALERTS TIMELINE TRIGGER
-- Automatically inserts an alert into public.alerts whenever alert_state changes
-- (Phase 3 Integration Plan: Supabase Trigger on public.readings)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_reading_alert_transition()
RETURNS TRIGGER AS $$
DECLARE
    last_state SMALLINT;
    stage_name VARCHAR(30);
    alert_msg TEXT;
BEGIN
    -- Look up the preceding reading's alert_state
    SELECT alert_state INTO last_state
    FROM public.readings
    WHERE id < NEW.id
    ORDER BY id DESC
    LIMIT 1;

    -- Trigger alert row only if alert_state changed (or first reading ever)
    IF last_state IS NULL OR last_state <> NEW.alert_state THEN
        CASE NEW.alert_state
            WHEN 0 THEN
                stage_name := 'NORMAL';
                alert_msg := format('Tabbowa Dam: Water level normalized to %s%%. Sluice gates closed. Normal operations.', NEW.level_pct);
            WHEN 1 THEN
                stage_name := 'PRE_WARNING';
                alert_msg := format('Tabbowa Dam [PRE-WARNING]: Water level reached %s%% (rising). Sluice gates on standby.', NEW.level_pct);
            WHEN 2 THEN
                stage_name := 'CLEAR_AREA';
                alert_msg := format('Tabbowa Dam [CLEAR AREA]: Water level reached %s%%. Sluice gate opening to 20%% advisory release. Move away from riverbanks now.', NEW.level_pct);
            WHEN 3 THEN
                stage_name := 'DANGER';
                alert_msg := format('Tabbowa Dam [CRITICAL DANGER]: Reservoir level reached %s%%! Sluice gate opened to 50%% max flood relief. Immediate downstream evacuation.', NEW.level_pct);
            WHEN 4 THEN
                stage_name := 'SENSOR_FAULT';
                alert_msg := format('Tabbowa Dam [SENSOR FAULT]: Dual ultrasonic sensors out of agreement or echo lost. System operating in degraded safety mode.', NEW.level_pct);
            ELSE
                stage_name := 'UNKNOWN';
                alert_msg := format('Tabbowa Dam: Status change to state %s at %s%% water level.', NEW.alert_state, NEW.level_pct);
        END CASE;

        INSERT INTO public.alerts (
            stage,
            source,
            message,
            water_level_pct,
            gate_percent,
            created_at
        ) VALUES (
            stage_name,
            'AUTO',
            alert_msg,
            NEW.level_pct,
            NEW.gate_percent,
            NEW.created_at
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_reading_alert_transition ON public.readings;
CREATE TRIGGER trg_reading_alert_transition
    AFTER INSERT ON public.readings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_reading_alert_transition();
