// Manage user-owned sending domains via Resend.
// Auth required. Actions: list | add | check | remove | set_default | set_local
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const RESEND_KEY = Deno.env.get("RESEND_API_KEY")!;
const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const GATEWAY = "https://connector-gateway.lovable.dev/resend";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const DOMAIN_RE = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

async function resend(path: string, init: RequestInit = {}) {
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LOVABLE_KEY}`,
      "X-Connection-Api-Key": RESEND_KEY,
      ...(init.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  if (!RESEND_KEY || !LOVABLE_KEY) return json({ error: "missing_credentials" }, 500);

  // Authenticate via JWT (verify_jwt also enforced at the platform level by default).
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json({ error: "unauthorized" }, 401);
  }
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: u, error: authErr } = await userClient.auth.getUser();
  if (authErr || !u?.user) return json({ error: "unauthorized" }, 401);
  const userId = u.user.id;

  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const action = String(body?.action || "");
  const allowed = new Set(["list", "add", "check", "remove", "set_default", "set_local"]);
  if (!allowed.has(action)) return json({ error: "unknown_action" }, 400);

  if (action === "list") {
    const { data } = await admin.from("sending_domains")
      .select("*").eq("user_id", userId).order("created_at", { ascending: false });
    return json({ domains: data || [] });
  }

  if (action === "add") {
    const domain = String(body.domain || "").trim().toLowerCase();
    if (!DOMAIN_RE.test(domain)) return json({ error: "invalid_domain" }, 400);

    // Already exists locally?
    const { data: existing } = await admin.from("sending_domains")
      .select("id").eq("user_id", userId).eq("domain", domain).maybeSingle();
    if (existing) return json({ error: "already_added" }, 409);

    const r = await resend("/domains", { method: "POST", body: JSON.stringify({ name: domain }) });
    if (!r.ok) return json({ error: "resend_failed", details: r.body }, 502);

    const { data: ins, error } = await admin.from("sending_domains").insert({
      user_id: userId,
      domain,
      resend_domain_id: r.body.id,
      status: r.body.status || "pending",
      dns_records: r.body.records || [],
      last_checked_at: new Date().toISOString(),
    }).select("*").maybeSingle();
    if (error) return json({ error: "db_failed", details: error.message }, 500);
    return json({ domain: ins });
  }

  if (action === "check") {
    const id = body.id as string;
    const { data: row } = await admin.from("sending_domains")
      .select("*").eq("id", id).eq("user_id", userId).maybeSingle();
    if (!row) return json({ error: "not_found" }, 404);
    if (!row.resend_domain_id) return json({ error: "no_resend_id" }, 400);

    // Trigger verification then fetch latest
    await resend(`/domains/${row.resend_domain_id}/verify`, { method: "POST" });
    const r = await resend(`/domains/${row.resend_domain_id}`, { method: "GET" });
    if (!r.ok) return json({ error: "resend_failed", details: r.body }, 502);

    const newStatus = r.body.status || row.status;
    const update: any = {
      status: newStatus,
      dns_records: r.body.records || row.dns_records,
      last_checked_at: new Date().toISOString(),
    };
    if (newStatus === "verified" && !row.verified_at) update.verified_at = new Date().toISOString();
    const { data: upd } = await admin.from("sending_domains")
      .update(update).eq("id", id).select("*").maybeSingle();
    return json({ domain: upd });
  }

  if (action === "remove") {
    const id = body.id as string;
    const { data: row } = await admin.from("sending_domains")
      .select("*").eq("id", id).eq("user_id", userId).maybeSingle();
    if (!row) return json({ error: "not_found" }, 404);
    if (row.resend_domain_id) {
      await resend(`/domains/${row.resend_domain_id}`, { method: "DELETE" });
    }
    await admin.from("sending_domains").delete().eq("id", id);
    return json({ ok: true });
  }

  if (action === "set_default") {
    const id = body.id as string;
    await admin.from("sending_domains").update({ is_default: false }).eq("user_id", userId);
    const { data: upd } = await admin.from("sending_domains")
      .update({ is_default: true }).eq("id", id).eq("user_id", userId).select("*").maybeSingle();
    return json({ domain: upd });
  }

  if (action === "set_local") {
    const id = body.id as string;
    const local = String(body.local || "hello").trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
    if (!local) return json({ error: "invalid_local" }, 400);
    const { data: upd } = await admin.from("sending_domains")
      .update({ default_from_local: local }).eq("id", id).eq("user_id", userId).select("*").maybeSingle();
    return json({ domain: upd });
  }

  return json({ error: "unknown_action" }, 400);
});
