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
| `emergency_contacts` | `authenticated` (Admin) | `SELECT`, `INSERT` | Phone numbers are stored as plain text (the `enc_aes256_` prefix is a label, not encryption). Access is restricted only after running `rls_hardening.sql`. |

---

## 3. Notes (Nov 2026 review)
- `sensor_telemetry`, `operator_commands`, `emergency_contacts`, `public_dam_status_view` are **views** over `readings`, `commands`, `contacts` and `public_status`, kept for older firmware/apps.
- Without `rls_hardening.sql`, the policies in `schema.sql` let the public anon key read, insert and update almost every table. See `FIXES.md` in the project root.
- Run order: `schema.sql` → `seed_data.sql` (optional) → `rls_hardening.sql` (re-run after every `schema.sql`).

---

## 4. SMS recipients for the ESP32 (device key)
The node downloads the opted-in phone numbers from `contacts` every 10 minutes through
`public.get_sms_recipients(p_key)` (section 21 of `schema.sql`). The function returns numbers only
when `p_key` matches a key hash stored in `private.device_keys`, so the public anon key alone
still cannot read phone numbers (this keeps working after `rls_hardening.sql`).

One-time setup:
1. Pick a long random text (at least 12 characters), e.g. `sdas-7f3K9x-2Lq8vRw`.
2. In `firmware/SDAS_ESP32_Firmware/secrets.h` add: `#define SDAS_DEVICE_KEY "sdas-7f3K9x-2Lq8vRw"`
3. In the Supabase SQL editor run (same text):
   ```sql
   INSERT INTO private.device_keys (device_id, key_hash)
   VALUES ('ESP32_PUTTALAM_01', encode(extensions.digest('sdas-7f3K9x-2Lq8vRw', 'sha256'), 'hex'))
   ON CONFLICT (device_id) DO UPDATE SET key_hash = EXCLUDED.key_hash;
   ```
4. Flash the firmware. Serial Monitor shows `[CONTACTS] N SMS recipients loaded from Supabase.`

Without the key, the node uses the 4 `CONTACT_OPERATOR_*` numbers in `config.h`. At most 10 numbers
are used (tier 1 first).
