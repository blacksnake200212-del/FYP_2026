#ifndef SDAS_SECRETS_H
#define SDAS_SECRETS_H

// ============================================================================
// SDAS FIRMWARE CREDENTIALS TEMPLATE
// Copy this file to "secrets.h" and enter your local network credentials.
// ============================================================================

#define WIFI_SSID                "YOUR_WIFI_SSID"
#define WIFI_PASSWORD            "YOUR_WIFI_PASSWORD"

// Supabase REST Endpoint (Insert-Only Device Anon Key - NEVER service_role)
#define SUPABASE_URL             "https://your-project.supabase.co/rest/v1"
#define SUPABASE_ANON_KEY        "YOUR_SUPABASE_ANON_KEY"

#endif // SDAS_SECRETS_H
