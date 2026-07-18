import { createClient } from "npm:@supabase/supabase-js@2";
import { processAcceptanceContract } from "../_shared/process-acceptance-contract.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { proposalId, message, evidence, retry } = await req.json();
    if (
      typeof proposalId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(proposalId)
    ) {
      return json({ error: "Invalid proposal" }, 400);
    }
    if (message != null && (typeof message !== "string" || message.length > 2_000)) {
      return json({ error: "Message is too long" }, 400);
    }
    if (evidence != null && JSON.stringify(evidence).length > 100_000) {
      return json({ error: "Acceptance evidence is too large" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (retry) {
      const { data: accepted } = await admin
        .from("proposals")
        .select("id")
        .eq("id", proposalId)
        .eq("status", "accepted")
        .maybeSingle();
      if (!accepted) return json({ error: "Accepted proposal not found" }, 404);
    } else {
      const { error } = await admin.rpc("client_portal_respond", {
        _proposal_id: proposalId,
        _action: "accept",
        _message: typeof message === "string" && message.trim() ? message.trim() : null,
        _evidence: evidence || null,
      });
      if (error) return json({ error: error.message }, 400);
    }

    const contract = await processAcceptanceContract(admin, proposalId, Boolean(retry));
    return json({ accepted: true, contract });
  } catch (error) {
    console.error("client-portal-accept error", error);
    return json({ error: "Could not accept the proposal" }, 500);
  }
});
