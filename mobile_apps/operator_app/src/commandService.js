// Shared gate-command sender & status watcher for the Operator Console.
// Inserts commands into Supabase and watches the command row for hardware execution (EXECUTED / REJECTED)
// or flags node offline if no response within 30 seconds.

import { supabase } from './supabaseClient';
import { COMMAND_SCHEMA_VERSION } from './updateService';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The ESP32 polls Supabase every ~5 s. 5 minutes matches the web dashboard and leaves room for
// phone/ESP32 clock differences.
const COMMAND_TTL_MS = 5 * 60 * 1000;

/**
 * Inserts a command into public.commands table.
 * Returns { ok: boolean, id: string | null, status: string | null, message: string | null }
 */
export async function sendGateCommand(type, operatorUser, targetPercent = 0, extraParams = {}) {
  const pct = Math.min(Math.max(Number(targetPercent) || 0, 0), 50); // 50% safety hard limit
  const userId = operatorUser?.id;

  const payload = {
    schema_version: COMMAND_SCHEMA_VERSION,
    type,
    params: {
      target_percent: pct,
      operator: operatorUser?.email || null,
      issued_via: 'SDAS Operator App',
      timestamp: new Date().toISOString(),
      ...extraParams
    },
    // issued_by must be a real auth.users id (foreign key), otherwise the insert fails
    issued_by: userId && UUID_RE.test(userId) ? userId : null,
    status: 'PENDING',
    expires_at: new Date(Date.now() + COMMAND_TTL_MS).toISOString()
  };

  const { data, error } = await supabase
    .from('commands')
    .insert([payload])
    .select('id, status');

  if (error) {
    console.warn('[Command insert error]:', error.message);
    return { ok: false, id: null, status: null, message: error.message };
  }

  const inserted = data && data.length > 0 ? data[0] : null;
  return {
    ok: true,
    id: inserted?.id || null,
    status: inserted?.status || 'PENDING',
    message: null
  };
}

/**
 * Watches a command row in real-time until it transitions to EXECUTED / REJECTED,
 * or times out after timeoutMs (default 30 seconds -> 'Node offline').
 *
 * Calls onStatusChange({ status: 'PENDING' | 'EXECUTED' | 'REJECTED' | 'TIMEOUT', message: string, done: boolean })
 * Returns an unsubscribe/cancel function.
 */
export function watchCommandStatus(commandId, onStatusChange, timeoutMs = 30000) {
  if (!commandId) {
    onStatusChange({ status: 'TIMEOUT', message: 'No command ID to watch', done: true });
    return () => {};
  }

  let isDone = false;
  let timer = null;
  let pollInterval = null;
  let channel = null;

  const finish = (status, message) => {
    if (isDone) return;
    isDone = true;
    if (timer) clearTimeout(timer);
    if (pollInterval) clearInterval(pollInterval);
    if (channel) {
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        // ignore
      }
    }
    onStatusChange({ status, message, done: true });
  };

  // Immediate pending status notification
  onStatusChange({
    status: 'PENDING',
    message: 'Command queued. Awaiting ESP32 hardware pickup (~5s)...',
    done: false
  });

  // 1. Supabase Realtime Subscription for this specific command id
  channel = supabase
    .channel(`cmd-watch-${commandId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'commands',
        filter: `id=eq.${commandId}`
      },
      (payload) => {
        const nextStatus = payload?.new?.status;
        if (nextStatus === 'EXECUTED') {
          finish('EXECUTED', 'Command successfully executed by ESP32 node.');
        } else if (nextStatus === 'REJECTED') {
          finish('REJECTED', 'Command rejected by ESP32 node.');
        }
      }
    )
    .subscribe();

  // 2. Fallback Active Polling every 2.5 seconds (in case realtime websocket is delayed)
  pollInterval = setInterval(async () => {
    if (isDone) return;
    try {
      const { data, error } = await supabase
        .from('commands')
        .select('status')
        .eq('id', commandId)
        .limit(1);

      if (!error && data && data.length > 0) {
        const s = data[0].status;
        if (s === 'EXECUTED') {
          finish('EXECUTED', 'Command successfully executed by ESP32 node.');
        } else if (s === 'REJECTED') {
          finish('REJECTED', 'Command rejected by ESP32 node.');
        }
      }
    } catch (e) {
      // network hiccup, retry next interval
    }
  }, 2500);

  // 3. 30-Second Timeout: Flag Node Offline
  timer = setTimeout(() => {
    finish('TIMEOUT', 'Node offline - no response from ESP32 after 30 seconds.');
  }, timeoutMs);

  return () => {
    isDone = true;
    if (timer) clearTimeout(timer);
    if (pollInterval) clearInterval(pollInterval);
    if (channel) {
      try {
        supabase.removeChannel(channel);
      } catch (e) {}
    }
  };
}
