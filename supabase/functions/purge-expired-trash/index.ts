// Daily cron: permanently purges soft-deleted clients whose deleted_at is older
// than that user's configured trash_retention_days (default 30). Cascades to
// proposals, onboarding_forms (including uploaded files in storage), and deadlines.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type FilePayload = { path?: string };

function parseOne(raw: unknown): FilePayload | null {
  if (!raw) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as FilePayload;
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as FilePayload; } catch { return null; }
  }
  return null;
}
function parseMany(raw: unknown): FilePayload[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((v) => parseOne(v)).filter(Boolean) as FilePayload[];
  const one = parseOne(raw);
  return one ? [one] : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: trashed, error } = await svc
    .from("clients")
    .select("id, user_id, deleted_at")
    .not("deleted_at", "is", null);

  if (error) {
    console.error("query trashed clients failed", error);
    return new Response(JSON.stringify({ error: "query_failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const rows = (trashed || []) as { id: string; user_id: string; deleted_at: string }[];
  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));

  const retentionByUser = new Map<string, number>();
  if (userIds.length > 0) {
    const { data: settings } = await svc
      .from("user_settings")
      .select("user_id, trash_retention_days")
      .in("user_id", userIds);
    (settings || []).forEach((s: any) => retentionByUser.set(s.user_id, s.trash_retention_days ?? 30));
  }

  let purged = 0;
  let retained = 0;
  const now = Date.now();

  for (const row of rows) {
    const retention = retentionByUser.get(row.user_id) ?? 30;
    const ageMs = now - new Date(row.deleted_at).getTime();
    const eligible = ageMs >= retention * 24 * 60 * 60 * 1000;
    if (!eligible) { retained++; continue; }

    try {
      // Collect file paths from onboarding_forms for this client
      const { data: forms } = await svc
        .from("onboarding_forms")
        .select("id, fields, responses")
        .eq("client_id", row.id);
      const paths: string[] = [];
      (forms || []).forEach((f: any) => {
        const fields = Array.isArray(f.fields) ? f.fields : [];
        const responses = f.responses || {};
        fields.forEach((fd: any) => {
          if (fd?.type !== "file") return;
          const raw = responses[fd.id];
          if (!raw) return;
          if (fd.multiple) {
            parseMany(raw).forEach((p) => { if (p?.path) paths.push(p.path); });
          } else {
            const p = parseOne(raw);
            if (p?.path) paths.push(p.path);
          }
        });
      });
      if (paths.length > 0) {
        try { await svc.storage.from("form-uploads").remove(paths); } catch (e) { console.error("storage remove", e); }
      }

      await svc.from("proposals").delete().eq("client_id", row.id);
      await svc.from("onboarding_forms").delete().eq("client_id", row.id);
      await svc.from("deadlines").delete().eq("client_id", row.id);
      const { error: delErr } = await svc.from("clients").delete().eq("id", row.id);
      if (delErr) { console.error("client delete", row.id, delErr); retained++; continue; }
      purged++;
    } catch (e) {
      console.error("purge failed for", row.id, e);
      retained++;
    }
  }

  return new Response(JSON.stringify({ ok: true, purged, retained }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
