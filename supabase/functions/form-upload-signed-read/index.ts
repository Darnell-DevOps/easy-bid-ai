// Authenticated: returns a short-lived signed READ URL for a file in form-uploads,
// only if the caller owns the path (path starts with their user id).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return Response.json({ error: "unauthorized" }, { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData.user) {
      return Response.json({ error: "unauthorized" }, { status: 401, headers: corsHeaders });
    }
    const uid = userData.user.id;

    const { path } = await req.json();
    if (!path || typeof path !== "string") {
      return Response.json({ error: "missing_path" }, { status: 400, headers: corsHeaders });
    }
    if (!path.startsWith(`${uid}/`)) {
      return Response.json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    const { data, error } = await supabase.storage
      .from("form-uploads")
      .createSignedUrl(path, 60 * 5);
    if (error || !data) {
      return Response.json({ error: "sign_failed", detail: error?.message }, { status: 500, headers: corsHeaders });
    }
    return Response.json({ url: data.signedUrl }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: "bad_request", detail: String((e as Error).message) }, { status: 400, headers: corsHeaders });
  }
});
