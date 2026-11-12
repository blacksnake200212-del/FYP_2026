-- ============================================================================
-- SDAS - OPTIONAL SECURITY HARDENING (run AFTER schema.sql)
-- ============================================================================
-- WHY: schema.sql lets the "anon" key do almost everything. That key is printed in
-- app.js, so ANYONE who opens the dashboard can, without logging in:
--   * read every operator's email (profiles) and every emergency phone number (contacts)
--   * insert gate commands (OPEN_50, ESTOP ...) straight into public.commands
--   * delete / edit emergency contacts, edit dam limits, read the audit log
--   * sign up and give themselves role = 'ADMIN'
-- The login screen on the web page only hides buttons; it does not protect the database.
--
-- WHAT STILL WORKS FOR THE ESP32 (anon key):
--   * INSERT readings / alerts
--   * SELECT commands, and UPDATE only the "status" column of commands
--   * SELECT readings, forecasts, alerts, dams, app_config, public views
--
-- BEFORE YOU RUN STEP B: check your ESP32 firmware. If it downloads the phone list from
-- /rest/v1/contacts with the anon key, Step B will stop the SIM800L from getting numbers.
-- In that case run only Step A, or move the firmware to a service key / Edge Function.
-- The Master-PIN login has no Supabase session, so after this file it can no longer
-- send commands. Operators must use a real Supabase account.
-- NOTE: schema.sql runs GRANT ALL again, so run this file again after every schema.sql run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- STEP A: commands, profiles, audit log, push tokens, dams, flood reports
-- ---------------------------------------------------------------------------

-- Commands: only logged-in operators may create them; the node may read them and
-- change only their status.
DROP POLICY IF EXISTS "Allow operators insert commands" ON public.commands;
CREATE POLICY "Allow operators insert commands"
ON public.commands FOR INSERT TO authenticated
WITH CHECK (issued_by IS NULL OR issued_by = auth.uid());

DROP POLICY IF EXISTS "Allow operators update commands" ON public.commands;
DROP POLICY IF EXISTS "Allow node update command status" ON public.commands;
CREATE POLICY "Allow node update command status"
ON public.commands FOR UPDATE TO anon, authenticated
USING (true) WITH CHECK (true);
REVOKE INSERT, UPDATE, DELETE ON public.commands FROM anon;
GRANT UPDATE (status) ON public.commands TO anon;

-- Profiles: users see and create only their own row, and can never self-assign ADMIN.
DROP POLICY IF EXISTS "Allow users read own profile" ON public.profiles;
CREATE POLICY "Allow users read own profile"
ON public.profiles FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow insert own operator profile" ON public.profiles;
CREATE POLICY "Allow insert own operator profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND role = 'OPERATOR');
REVOKE ALL ON public.profiles FROM anon;

-- Create the profile automatically at sign-up (works even when email confirmation is
-- on and the browser has no session yet). Role is always OPERATOR; promote admins by
-- hand in the Supabase Table Editor.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, full_name, role)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 'OPERATOR')
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Audit log: written by logged-in users, readable only by admins.
DROP POLICY IF EXISTS "Allow insert audit_log" ON public.audit_log;
CREATE POLICY "Allow insert audit_log"
ON public.audit_log FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow admins read audit_log" ON public.audit_log;
CREATE POLICY "Allow admins read audit_log"
ON public.audit_log FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'ADMIN'));
REVOKE ALL ON public.audit_log FROM anon;

-- Push tokens: the public app may register a token but not list everyone's tokens.
DROP POLICY IF EXISTS "Allow select push_tokens" ON public.push_tokens;
REVOKE SELECT, UPDATE, DELETE ON public.push_tokens FROM anon;

-- Dams: everyone may read; only logged-in operators may change limits.
DROP POLICY IF EXISTS "Allow operators manage dams" ON public.dams;
CREATE POLICY "Allow operators manage dams"
ON public.dams FOR ALL TO authenticated
USING (true) WITH CHECK (true);
REVOKE INSERT, UPDATE, DELETE ON public.dams FROM anon;

-- Flood reports: the public may submit, only operators may verify/edit.
DROP POLICY IF EXISTS "Allow update flood_reports" ON public.flood_reports;
CREATE POLICY "Allow update flood_reports"
ON public.flood_reports FOR UPDATE TO authenticated
USING (true) WITH CHECK (true);
REVOKE UPDATE, DELETE ON public.flood_reports FROM anon;

-- App config: anon read only.
REVOKE INSERT, UPDATE, DELETE ON public.app_config FROM anon;

-- ---------------------------------------------------------------------------
-- STEP B: emergency phone numbers (read the warning at the top first)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow read contacts" ON public.contacts;
DROP POLICY IF EXISTS "Allow manage contacts" ON public.contacts;
DROP POLICY IF EXISTS "Allow operators manage contacts" ON public.contacts;
CREATE POLICY "Allow operators manage contacts"
ON public.contacts FOR ALL TO authenticated
USING (true) WITH CHECK (true);
REVOKE ALL ON public.contacts FROM anon;
REVOKE ALL ON public.emergency_contacts FROM anon;

-- Views run with their owner's rights, so the compatibility views also need closing.
REVOKE INSERT, UPDATE, DELETE ON public.operator_commands FROM anon;
