// Cancels a retainer's Paddle subscription at the end of the current period.
import { createClient } from "npm:@supabase/supabase-js@2";
import { getPaddleClient, type PaddleEnv } from "../_shared/paddle.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }
  try {
    const { retainerId, mode } = await req.json();
    if (!retainerId) {
      return new Response(JSON.stringify({ error: "retainerId required" }), {
        status: 400,
        headers: cors,
      });
    }

    const { data: retainer, error } = await supabase
      .from("retainers")
      .select("paddle_subscription_id, environment")
      .eq("id", retainerId)
      .maybeSingle();

    if (error || !retainer?.paddle_subscription_id) {
      return new Response(JSON.stringify({ error: "No active subscription" }), {
        status: 400,
        headers: cors,
      });
    }

    const env = (retainer.environment || "sandbox") as PaddleEnv;
    const paddle = getPaddleClient(env);
    const effective = mode === "immediate" ? "immediately" : "next_billing_period";

    await (paddle as any).subscriptions.cancel(retainer.paddle_subscription_id, {
      effectiveFrom: effective,
    });

    await supabase
      .from("retainers")
      .update({
        cancel_at_period_end: effective === "next_billing_period",
        status: effective === "immediately" ? "cancelled" : "active",
        cancelled_at:
          effective === "immediately" ? new Date().toISOString() : null,
      })
      .eq("id", retainerId);

    return new Response(JSON.stringify({ ok: true }), { headers: cors });
  } catch (e: any) {
    console.error("cancel-retainer-subscription error:", e?.message || e);
    return new Response(
      JSON.stringify({ error: e?.message || String(e) }),
      { status: 500, headers: cors },
    );
  }
});
