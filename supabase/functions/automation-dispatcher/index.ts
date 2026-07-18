import { createClient } from "npm:@supabase/supabase-js@2";
import { cronUnauthorized, isCronAuthorized } from "../_shared/cron-auth.ts";

type ClaimedJob = {
  job_name: string;
  function_name: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (!isCronAuthorized(req)) return cronUnauthorized();

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const cronSecret = Deno.env.get("CRON_SECRET")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const { data: jobs, error: claimError } = await admin.rpc(
    "claim_due_automation_jobs",
    { _limit: 20 },
  );
  if (claimError) {
    console.error("automation dispatcher claim failed", claimError);
    return Response.json({ error: claimError.message }, { status: 500 });
  }

  const results: Array<Record<string, unknown>> = [];
  for (const job of (jobs || []) as ClaimedJob[]) {
    const started = Date.now();
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/${job.function_name}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
          "x-cron-secret": cronSecret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dispatchedAt: new Date().toISOString() }),
      });
      const body = await response.json().catch(() => ({}));
      const completedAt = new Date().toISOString();
      const succeeded = response.ok && body?.ok !== false && !body?.error;
      await admin
        .from("automation_job_registry")
        .update({
          last_completed_at: completedAt,
          last_succeeded_at: succeeded ? completedAt : undefined,
          last_failed_at: succeeded ? undefined : completedAt,
          last_error: succeeded ? null : String(body?.error || `HTTP ${response.status}`).slice(0, 1_000),
          last_result: body,
          last_duration_ms: Date.now() - started,
        })
        .eq("job_name", job.job_name);
      results.push({ job: job.job_name, ok: succeeded, status: response.status, result: body });
    } catch (error) {
      const completedAt = new Date().toISOString();
      const message = error instanceof Error ? error.message : String(error);
      await admin
        .from("automation_job_registry")
        .update({
          last_completed_at: completedAt,
          last_failed_at: completedAt,
          last_error: message.slice(0, 1_000),
          last_duration_ms: Date.now() - started,
        })
        .eq("job_name", job.job_name);
      results.push({ job: job.job_name, ok: false, error: message });
    }
  }

  return Response.json({ ok: true, dispatched: results.length, jobs: results });
});
