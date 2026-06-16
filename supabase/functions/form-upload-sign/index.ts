// Anon-callable: signs an upload URL for a smart-form file field.
// Resolves form owner from either onboarding access_token or active lead_forms slug.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_PREFIXES = ["image/", "text/"];
const ALLOWED_EXACT = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/json",
]);

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { token, slug, field_id, filename, content_type, size } = await req.json();
    if (!field_id || !filename || !content_type || typeof size !== "number") {
      return Response.json({ error: "missing_fields" }, { status: 400, headers: corsHeaders });
    }
    if (size <= 0 || size > MAX_BYTES) {
      return Response.json({ error: "file_too_large", limit: MAX_BYTES }, { status: 400, headers: corsHeaders });
    }
    const ct = String(content_type).toLowerCase();
    const ok = ALLOWED_PREFIXES.some((p) => ct.startsWith(p)) || ALLOWED_EXACT.has(ct);
    if (!ok) {
      return Response.json({ error: "file_type_not_allowed" }, { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let user_id: string | null = null;
    let form_kind: "onboarding" | "lead" = "onboarding";
    let form_id: string | null = null;

    if (token) {
      const { data } = await supabase
        .from("onboarding_forms")
        .select("id, user_id")
        .eq("access_token", token)
        .maybeSingle();
      if (data) {
        user_id = data.user_id;
        form_id = data.id;
        form_kind = "onboarding";
      }
    } else if (slug) {
      const { data } = await supabase
        .from("lead_forms")
        .select("id, user_id, is_active")
        .eq("slug", slug)
        .maybeSingle();
      if (data && data.is_active) {
        user_id = data.user_id;
        form_id = data.id;
        form_kind = "lead";
      }
    }

    if (!user_id || !form_id) {
      return Response.json({ error: "form_not_found" }, { status: 404, headers: corsHeaders });
    }

    const uuid = crypto.randomUUID();
    const path = `${user_id}/${form_kind}/${form_id}/${field_id}/${uuid}-${safeName(filename)}`;
    const { data: signed, error: signErr } = await supabase.storage
      .from("form-uploads")
      .createSignedUploadUrl(path);
    if (signErr || !signed) {
      return Response.json({ error: "sign_failed", detail: signErr?.message }, { status: 500, headers: corsHeaders });
    }

    return Response.json(
      {
        path,
        upload_url: signed.signedUrl,
        token: signed.token,
        size_limit: MAX_BYTES,
      },
      { headers: corsHeaders },
    );
  } catch (e) {
    return Response.json({ error: "bad_request", detail: String((e as Error).message) }, { status: 400, headers: corsHeaders });
  }
});
