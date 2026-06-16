// Internal endpoint invoked by the AFTER INSERT trigger on public.leads via pg_net.
// Auth: shared secret in `x-internal-secret` header (not user JWT).
import { qualifyCorsHeaders, qualifyLeadById } from "../_shared/lead-qualify.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: qualifyCorsHeaders });

  const expected = Deno.env.get("LEAD_QUALIFY_SECRET");
  const provided = req.headers.get("x-internal-secret");
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...qualifyCorsHeaders, "Content-Type": "application/json" },
    });
  }

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

  const result = await qualifyLeadById(leadId, { force: !!body.force });
  return new Response(JSON.stringify(result), {
    status: result.ok ? 200 : 500,
    headers: { ...qualifyCorsHeaders, "Content-Type": "application/json" },
  });
});
