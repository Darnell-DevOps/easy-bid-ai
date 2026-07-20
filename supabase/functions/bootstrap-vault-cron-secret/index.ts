// One-shot bootstrap: copies the CRON_SECRET env var into Vault as `cron_secret`.
// No response ever exposes the value. This function is safe to remove after use.
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!cronSecret || !serviceKey || !supabaseUrl) {
    return new Response(JSON.stringify({ error: "Missing required env" }), { status: 500 });
  }
  const admin = createClient(supabaseUrl, serviceKey);
  const { error } = await admin.rpc("bootstrap_replace_cron_vault_secret", { _value: cronSecret });
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
