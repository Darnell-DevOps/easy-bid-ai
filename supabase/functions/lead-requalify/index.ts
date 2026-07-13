// Authenticated endpoint for the "Re-qualify" button.
// Accepts either { leadId } (leads table) or { clientId } (clients table).
import { createClient } from "npm:@supabase/supabase-js@2";
import { qualifyClientById, qualifyCorsHeaders, qualifyLeadById } from "../_shared/lead-qualify.ts";

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...qualifyCorsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: qualifyCorsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
  if (claimsErr || !claims?.claims?.sub) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const userId = claims.claims.sub;

  let body: any;
  try { body = await req.json(); } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const leadId = typeof body?.leadId === "string" ? body.leadId : null;
  const clientId = typeof body?.clientId === "string" ? body.clientId : null;

  if ((!leadId && !clientId) || (leadId && clientId)) {
    return jsonResponse({ error: "Provide exactly one of leadId or clientId" }, 400);
  }

  if (leadId) {
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("id, user_id")
      .eq("id", leadId)
      .maybeSingle();
    if (leadErr || !lead || lead.user_id !== userId) {
      return jsonResponse({ error: "Lead not found" }, 404);
    }
    const result = await qualifyLeadById(leadId, { force: true });
    return jsonResponse(result, result.ok ? 200 : 500);
  }

  // clientId path
  const { data: client, error: clientErr } = await supabase
    .from("clients")
    .select("id, user_id")
    .eq("id", clientId!)
    .maybeSingle();
  if (clientErr || !client || client.user_id !== userId) {
    return jsonResponse({ error: "Client not found" }, 404);
  }
  const result = await qualifyClientById(clientId!);
  return jsonResponse(result, result.ok ? 200 : 500);
});
