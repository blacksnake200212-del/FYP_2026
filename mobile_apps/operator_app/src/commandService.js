// Shared gate-command sender for the Operator Console.
// FIX: GateControlScreen and DashboardScreen each inserted commands themselves and ignored the
// Supabase result ({ error } is returned, not thrown), so a rejected command still showed
// "transmitted to ESP32". This helper reports what really happened.

import { supabase } from './supabaseClient';
import { COMMAND_SCHEMA_VERSION } from './updateService';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The ESP32 polls Supabase every ~5 s. 5 minutes matches the web dashboard and leaves room for
// phone/ESP32 clock differences (the old 10 s expiry could expire before the node saw it).
const COMMAND_TTL_MS = 5 * 60 * 1000;

export async function sendGateCommand(type, operatorUser, targetPercent = 0) {
  const pct = Math.min(Math.max(Number(targetPercent) || 0, 0), 50); // 50% hard limit
  const userId = operatorUser?.id;

  const { error } = await supabase.from('commands').insert([
    {
      schema_version: COMMAND_SCHEMA_VERSION,
      type,
      params: {
        target_percent: pct,
        operator: operatorUser?.email || null,
        issued_via: 'SDAS Operator App',
        timestamp: new Date().toISOString()
      },
      // issued_by must be a real auth.users id (foreign key), otherwise the insert fails
      issued_by: userId && UUID_RE.test(userId) ? userId : null,
      status: 'PENDING',
      expires_at: new Date(Date.now() + COMMAND_TTL_MS).toISOString()
    }
  ]);

  if (error) {
    console.warn('[Command insert error]:', error.message);
    return { ok: false, message: error.message };
  }
  return { ok: true, message: null };
}
