// SDAS Supabase Edge Function: send a push notification to every public-app phone
// when a new row is added to public.alerts (stage change from the ESP32 trigger, or an
// operator alert). Works even when the public app is closed.
//
// Deploy (Supabase dashboard):
//   1. Edge Functions -> Deploy a new function -> name "send-stage-push" -> paste this file -> Deploy.
//   2. Database -> Webhooks -> Create: table public.alerts, event INSERT,
//      type "Supabase Edge Functions", function send-stage-push.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided to Edge Functions automatically.

import { createClient } from "jsr:@supabase/supabase-js@2";

const TEXT: Record<string, { title: string; body: string }> = {
  PRE_WARNING: { title: "⚠️ PRE-WARNING - TABBOWA DAM", body: "Reservoir reached 60%. Gate on standby. Stay alert." },
  CLEAR_AREA: { title: "⚠️ CLEAR THE AREA - TABBOWA DAM", body: "Reservoir reached 80%. Gate opening 20%. Leave the river banks now." },
  DANGER: { title: "🚨 DANGER - TABBOWA DAM", body: "Reservoir reached 85%. Gate opening 50%. Move to higher ground immediately." },
  SENSOR_FAULT: { title: "ℹ️ Dam sensor fault - Tabbowa Dam", body: "Water level reading unavailable. Follow official advice (DMC 117)." },
};

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const alert = payload?.record ?? payload;          // database webhook sends { type, table, record }
    const text = TEXT[alert?.stage];
    if (!text) return new Response(JSON.stringify({ skipped: "no push for this stage" }), { status: 200 });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: rows, error } = await supabase.from("push_tokens").select("token").limit(5000);
    if (error) throw error;

    const tokens = (rows ?? []).map((r) => r.token).filter((t) => typeof t === "string" && t.startsWith("ExponentPushToken"));
    let sent = 0;
    for (let i = 0; i < tokens.length; i += 100) {          // Expo accepts up to 100 messages per request
      const batch = tokens.slice(i, i + 100).map((to) => ({
        to,
        title: text.title,
        body: alert.message || text.body,
        sound: "default",
        priority: "high",
        channelId: "sdas_flood_alerts",
        data: { stage: alert.stage, alertId: alert.id },
      }));
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(batch),
      });
      if (res.ok) sent += batch.length;
    }
    return new Response(JSON.stringify({ stage: alert.stage, tokens: tokens.length, sent }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
