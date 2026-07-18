import { createClient } from "npm:@supabase/supabase-js@2";
import { cronUnauthorized, isCronAuthorized } from "../_shared/cron-auth.ts";
import { processAcceptanceContract } from "../_shared/process-acceptance-contract.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (!isCronAuthorized(req)) return cronUnauthorized();

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const now = new Date().toISOString();
    const { data: contracts, error } = await admin
      .from("contracts")
      .select("proposal_id")
      .eq("source", "acceptance_auto")
      .is("deleted_at", null)
      .in("generation_status", ["queued", "failed"])
      .lte("generation_next_retry_at", now)
      .not("proposal_id", "is", null)
      .limit(20);
    if (error) throw error;

    let ready = 0;
    let failed = 0;
    for (const row of contracts || []) {
      const result = await processAcceptanceContract(admin, row.proposal_id, false);
      if (result?.generation_status === "ready") ready++;
      else if (result?.generation_status === "failed") failed++;
    }
    return Response.json({ ok: true, scanned: contracts?.length || 0, ready, failed });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("contract-generation-retry-cron error", message);
    return Response.json({ error: message }, { status: 500 });
  }
});
