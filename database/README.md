# SDAS Supabase & PostgreSQL Database Architecture

## 1. Schema Design
- `schema.sql`: Contains the complete production PostgreSQL schema with extensions, tables, indexes, sanitized public view, and Row Level Security (RLS) policies.
- `seed_data.sql`: Calibrated telemetry records, alert logs, and encrypted contact records for local validation.

---

## 2. Row Level Security (RLS) & Access Control

| Entity | Role / Key | Permitted Actions | Security Rationale |
|---|---|---|---|
| `sensor_telemetry` | `anon` (ESP32 Device Key) | `INSERT` only | Firmware can post telemetry but cannot delete or alter logs. |
| `sensor_telemetry` | `authenticated` (Operator) | `SELECT` | Operators view full diagnostic history. |
| `public_dam_status_view` | `anon` (Public App) | `SELECT` | Zero-login access to sanitized level, alert status, and safety tips. |
| `operator_commands` | `authenticated` (Operator) | `INSERT`, `SELECT` | Strict audit trail of all manual gate actuations. |
| `emergency_contacts` | `authenticated` (Admin) | `SELECT`, `INSERT` | Phone numbers encrypted via AES-GCM to prevent PII exposure. |
