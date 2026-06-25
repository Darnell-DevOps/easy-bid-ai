import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id ?? "");
    if (!id) return new Response(JSON.stringify({ error: "missing id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row, error } = await admin
      .from("custom_domains")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error || !row) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const txtHost = `_closesync.${row.domain}`;
    const dnsRes = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(txtHost)}&type=TXT`, {
      headers: { Accept: "application/dns-json" },
    });
    const dns = await dnsRes.json();
    const answers: string[] = (dns?.Answer ?? []).map((a: any) => String(a.data || "").replace(/^"|"$/g, ""));
    const expected = row.verification_token as string;
    const ok = answers.some((v) => v.includes(expected));

    const update: Record<string, unknown> = {
      last_checked_at: new Date().toISOString(),
      last_check_error: ok ? null : `TXT record at ${txtHost} did not contain expected token`,
    };
    if (ok) {
      update.verified = true;
      update.verified_at = new Date().toISOString();
    }

    await admin.from("custom_domains").update(update).eq("id", id);

    return new Response(JSON.stringify({ ok, verified: ok, expected, found: answers, host: txtHost }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
