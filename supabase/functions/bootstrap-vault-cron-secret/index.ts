// One-shot bootstrap: copies the CRON_SECRET env var into Vault as `cron_secret`.
// Requires the caller to present the current CRON_SECRET as x-cron-secret,
// so it cannot be abused by anonymous callers. Delete this function after use.
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  if (!cronSecret) {
    return new Response(JSON.stringify({ error: "CRON_SECRET env not set" }), { status: 500 });
  }
  const authz = req.headers.get("Authorization") || "";
  if (authz !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceKey);

  // Remove any prior entries then insert fresh, so this is idempotent.
  const { error: delErr } = await admin.rpc("bootstrap_replace_cron_vault_secret", {
    _value: cronSecret,
  });
  if (delErr) {
    return new Response(JSON.stringify({ error: delErr.message }), { status: 500 });
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
