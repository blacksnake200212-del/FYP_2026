# SDAS Mobile App Blueprint & Technical Specification

> **Smart Dam Alert System (SDAS) - Tabbowa Dam Station #01**  
> Dual React Native (Expo) Architecture with Shared Supabase Backend  
> Author: SDAS Engineering Team | Last Updated: October 2026

---

## 1. Architectural Foundation & Monorepo Structure

Both apps are built with React Native and Expo (SDK 57), communicating with a shared Supabase PostgreSQL backend with Row Level Security (RLS) and Supabase Realtime engine.

```
mobile_apps/
├── packages/shared/             # Shared Types, Supabase Client, i18n, Theme Constants
│   ├── statusColors.ts          # NORMAL (green), PRE-WARNING (yellow), CLEAR AREA (orange), DANGER (red)
│   ├── formatters.ts            # Date formatting, capacity %, distance rounding
│   ├── types.ts                 # Telemetry, Alert, Command, Forecast TypeScript models
│   └── i18n/                    # Trilingual translations (EN, SI, TA)
├── public_app/                  # SDAS Public Flood Advisory (Zero authentication, read-only)
│   ├── app.json                 # com.sdas.publicportal (SDK 57)
│   ├── App.js                   # Navigation & Tab Container
│   └── src/screens/             # Home, Alerts Timeline, What To Do, Settings, About
└── operator_app/                # SDAS Operator Console (Auth, MFA TOTP, MQTT/Gate Overrides)
    ├── app.json                 # com.sdas.operatorconsole (SDK 57)
    ├── App.js                   # Navigation & Tab Container
    └── src/screens/             # Login, Dashboard, Gate Control, Alerts, History, AI Insights, Contacts, Audit
```

### 1.1 Status Model & Visual Indicators
The state is represented simultaneously with **Color + Icon + Text** to guarantee accessibility and avoid reliance on color alone:

| Stage | Color | Hex Code | Icon | Description | Safety Action |
|---|---|---|---|---|---|
| **NORMAL** | Emerald Green | `#10B981` | 🟢 / 🛡️ | Safe operating levels (< 60%) | Normal routine monitoring |
| **PRE-WARNING** | Amber Yellow | `#EAB308` | 🟡 / ⚠️ | Level rising towards 60% | Gate closed; prepare downstream |
| **CLEAR AREA** | Bright Orange | `#F97316` | 🟠 / 📢 | Water reaches 80% (Gate 20-30%) | Evacuate spillway & low crossings |
| **DANGER** | Crimson Red | `#EF4444` | 🔴 / 🚨 | Water breaches 85% (Gate 50%) | Immediate evacuation to high ground |

### 1.2 Staleness Rule (2-Minute Threshold)
If `NOW() - updated_at > 120 seconds`:
- The UI displays an amber/red staleness banner: `"⚠️ Data may be outdated (Last updated: X min ago)"`.
- The gauge dims and clearly denotes that live telemetry transmission from the dam has paused.
- No historical reading is ever presented as current telemetry.

---

## 2. Public App Specification (Read-Only)

**Security Boundary:** Anonymous clients use the Supabase `anon` key. They can only query the sanitized `public_status` view and insert into `push_tokens`. No raw sensor distances, gate actuation controls, operator names, or phone numbers are exposed.

### Screen Breakdown
1. **Home:**
   - Circular capacity gauge (`0% - 100%`).
   - 4-Stage Status Banner with icon, badge, and plain-language action.
   - 1-Hour Forecast Trend indicator: Rising (`↗`), Steady (`→`), Falling (`↘`).
   - Staleness alert bar.
   - Quick-refresh button.
2. **Alerts:**
   - Chronological timeline of all triggered warning stages with timestamps and source (Automatic State Machine vs. Operator Manual Dispatch).
3. **What To Do (Disaster Advisory):**
   - Step-by-step civil protection instructions for each of the 4 stages in English, Sinhala, and Tamil.
4. **Settings:**
   - Language selector (English, Sinhala, Tamil).
   - Push notification opt-in switch (stores Expo Push Token in `push_tokens`).
   - Optional SMS alert registration for residents without smartphones.
5. **About & Helplines:**
   - Dam technical profile (Tabbowa Reservoir, Deduru Oya basin).
   - Direct one-tap emergency calling buttons: DMC (`117`), Police (`119`), Suwa Seriya Ambulance (`1990`).

---

## 3. Operator App Specification (Authenticated & Audited)

**Security Boundary:** Requires Supabase Auth (JWT) + TOTP MFA. Every manual gate actuation and SMS dispatch requires role verification and records an immutable entry in `audit_log`.

### Screen Breakdown
1. **Login & MFA:**
   - Email/password authentication via Supabase Auth.
   - Mandatory TOTP MFA token prompt.
   - Verification of `profiles.role` (`OPERATOR` or `ADMIN`).
2. **Dashboard:**
   - Primary dam level metric, alert stage, and gate position.
   - Control mode indicator: `AUTO`, `MANUAL`, or `EMERGENCY`.
   - Hardware diagnostic telemetry tiles: Sensor 1 (HC-SR04), Sensor 2 (JSN-SR04T), DHT22 (temp/humidity), Battery voltage, GSM signal (CSQ), Wi-Fi RSSI, Last Node Heartbeat.
3. **Gate Control:**
   - Commands: `OPEN`, `CLOSE`, `EMERGENCY STOP (ESTOP)`, `REVERT TO AUTO`.
   - Gate Presets: `0% (Closed)`, `20% (Advisory Discharge)`, `50% (High Emergency Discharge)`.
   - **Hold-to-Confirm:** Requires a 2-second continuous hold to eliminate accidental touches.
   - **Watchdog Countdown:** Shows remaining active manual duration (e.g., 300s) before automated failsafe reversion to `AUTO`.
   - Command state indicator: `PENDING` ➔ `ACKNOWLEDGED` ➔ `EXECUTED` (or `REJECTED`).
4. **Alerts & Manual SMS:**
   - Manual staged Pre-Warning SMS broadcast dispatcher via SIM800L.
   - Select template and recipient group (Divisional Secretariats, Police, Community Leaders).
   - Live SMS preview with word count and recipient count confirmation.
5. **History & Charts:**
   - Water level time-series chart with anomaly markers (sensor disagreements).
   - Gate movement event log.
   - SMS delivery status log.
6. **AI Insights:**
   - 1-hour XGBoost/LSTM forecast curve.
   - Risk classification confidence metric (e.g., `94.2% NORMAL`).
   - Dual-sensor discrepancy and acoustic drift diagnostic score.
7. **Emergency Contacts (Admins Only):**
   - Cryptographically stored emergency contacts directory.
   - Add, edit, tier ranking (Tier 1-3), and active toggle.
8. **Audit Log (Admins Only):**
   - Immutable log of all operator overrides, timestamp, operator ID, and payload.

---

## 4. Backend Data Model (Supabase PostgreSQL)

```sql
-- 1. Sensor Readings
CREATE TABLE public.readings (
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
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. AI Forecasts
CREATE TABLE public.forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(50) DEFAULT 'SDAS-NODE-01' NOT NULL,
    horizon_min INT DEFAULT 60 NOT NULL,
    predicted_level NUMERIC(5, 2) NOT NULL,
    risk_class VARCHAR(30) NOT NULL,
    confidence NUMERIC(4, 3) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Dam Alerts Log
CREATE TABLE public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage VARCHAR(30) NOT NULL,
    source VARCHAR(20) DEFAULT 'AUTO' CHECK (source IN ('AUTO', 'MANUAL')),
    message TEXT NOT NULL,
    water_level_pct NUMERIC(5, 2),
    gate_percent SMALLINT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Operator Commands
CREATE TABLE public.commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(30) NOT NULL CHECK (type IN ('OPEN_20', 'OPEN_50', 'CLOSE', 'ESTOP', 'AUTO', 'PREWARN_SMS')),
    params JSONB DEFAULT '{}'::jsonb,
    issued_by UUID REFERENCES auth.users(id),
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACKNOWLEDGED', 'EXECUTED', 'EXPIRED', 'REJECTED')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 5. SMS Broadcast Jobs
CREATE TABLE public.sms_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message TEXT NOT NULL,
    recipient_group VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'SENDING', 'COMPLETED', 'FAILED')),
    delivered_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. Encrypted Emergency Contacts
CREATE TABLE public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    phone_encrypted TEXT NOT NULL,
    role VARCHAR(50) NOT NULL,
    recipient_group VARCHAR(50) DEFAULT 'PUBLIC',
    tier SMALLINT DEFAULT 1 CHECK (tier BETWEEN 1 AND 3),
    opted_in BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 7. Push Notification Tokens
CREATE TABLE public.push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token TEXT UNIQUE NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    platform VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 8. User Role Profiles
CREATE TABLE public.profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(120),
    role VARCHAR(30) DEFAULT 'OPERATOR' CHECK (role IN ('OPERATOR', 'ADMIN')),
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 9. Immutable Audit Log
CREATE TABLE public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    action VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 10. Sanitized Public Realtime View
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

-- 11. Versioned Public Contract View (Guarantees backward compatibility)
CREATE OR REPLACE VIEW public.public_status_v1 AS
SELECT * FROM public.public_status;

-- 12. App Version & Update Strategy Metadata Table
CREATE TABLE public.app_config (
    app_id VARCHAR(50) PRIMARY KEY, -- 'public_app', 'operator_app'
    min_supported_version VARCHAR(20) NOT NULL,
    latest_version VARCHAR(20) NOT NULL,
    update_message TEXT,
    store_url TEXT,
    apk_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
```

---

## 5. SDAS App Update Strategy

How users of the public and operator apps learn about new versions, and how old versions keep working:

### 5.1 Two Update Types
| Type | What Changed | How it Reaches Users |
|---|---|---|
| **Over-The-Air (OTA)** | JavaScript, screens, text, translations, images | `expo-updates` (EAS Update). App downloads in the background on launch and applies on the next restart. No store review required. |
| **Store / Binary Update** | Native code, permissions, new Expo SDK, native libraries | Play Store / App Store or direct APK download. Requires binary compile. |

*Each build carries a `runtimeVersion`. An OTA update only reaches builds with a matching runtime. When native code changes, `runtimeVersion` is bumped and a new binary is shipped. Old binaries keep receiving compatible OTA updates.*

### 5.2 User Update Notifications
1. **OTA Updates:**
   - Checked automatically on app launch and foreground transitions.
   - If a new JS bundle is downloaded, a non-blocking toast displays: *"Update ready, restart to apply"*.
2. **Store / APK Updates:**
   - Powered by the `app_config` Supabase table.
   - **Below `min_supported_version`:** Displays a full-screen **blocking modal** *"Update Required"* with a direct button to Google Play / APK download. Used strictly for breaking changes or security patches.
   - **Below `latest_version`:** Displays a dismissible top banner: *"New version available (vX.X.X): [message] [Update]"*.
   - **Settings Screen:** Explicit "App Version" line with a manual *"Check for Updates"* button.
3. **Push Notifications:**
   - Store device `app_version` inside `push_tokens` table to broadcast targeted upgrade advisories.

### 5.3 Backward Compatibility & Old Version Longevity
- **Additive Changes Only:** Database schemas add new columns with safe defaults; columns are never renamed or deleted while older clients remain active.
- **Versioned Public Contract:** Public apps consume `public_status_v1` (with alias to `public_status`). New major revisions will introduce `public_status_v2` without breaking existing clients.
- **Versioned Commands (`schema_version`):** Operator app dispatches include `schema_version: 1`. Edge functions and hardware nodes reject stale schema versions with clear update prompts.

### 5.4 Safety Rule (Zero Alert Dependency on Updates)
**The emergency alert chain must NEVER depend on anyone updating their app.**
- Physical cellular SMS broadcasts dispatched via the SIM800L module reach all resident feature phones and smartphones unconditionally.
- Push notifications trigger across all registered push tokens regardless of client version.
- Stale or outdated apps continue to receive live stage alerts (CLEAR AREA, DANGER) without obstruction. Update prompts enhance features and security, but never gate life-safety warnings.

### 5.5 Distribution Model
- **Public App:** Google Play Store (and Apple App Store) for automatic updates and frictionless installation.
- **Operator App:** Direct Standalone APK distribution during prototype and deployment, leveraging `app_config` version checks and EAS OTA updates.

