// Authenticated endpoint for the LeadInbox "Re-qualify" button.
// Verifies the caller's JWT and that they own the lead before re-running qualification.
import { createClient } from "npm:@supabase/supabase-js@2";
import { qualifyCorsHeaders, qualifyLeadById } from "../_shared/lead-qualify.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: qualifyCorsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...qualifyCorsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
  if (claimsErr || !claims?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...qualifyCorsHeaders, "Content-Type": "application/json" },
    });
  }
  const userId = claims.claims.sub;

  let body: any;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...qualifyCorsHeaders, "Content-Type": "application/json" },
    });
  }
  const leadId = body?.leadId;
  if (!leadId || typeof leadId !== "string") {
    return new Response(JSON.stringify({ error: "leadId required" }), {
      status: 400,
      headers: { ...qualifyCorsHeaders, "Content-Type": "application/json" },
    });
  }

  // Ownership check (RLS-scoped client)
  const { data: lead, error: leadErr } = await supabase
    .from("leads")
    .select("id, user_id")
    .eq("id", leadId)
    .maybeSingle();
  if (leadErr || !lead || lead.user_id !== userId) {
    return new Response(JSON.stringify({ error: "Lead not found" }), {
      status: 404,
      headers: { ...qualifyCorsHeaders, "Content-Type": "application/json" },
    });
  }

  const result = await qualifyLeadById(leadId, { force: true });
  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : 500,
    headers: { ...qualifyCorsHeaders, "Content-Type": "application/json" },
  });
});
