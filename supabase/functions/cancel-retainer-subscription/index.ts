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
    // Require a valid caller and verify they own the retainer BEFORE any mutation.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: cors,
      });
    }
    const token = authHeader.slice("Bearer ".length);
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: cors,
      });
    }
    const callerId = userData.user.id;

    const { retainerId, mode } = await req.json();
    if (!retainerId) {
      return new Response(JSON.stringify({ error: "retainerId required" }), {
        status: 400,
        headers: cors,
      });
    }

    const { data: retainer, error } = await supabase
      .from("retainers")
      .select("user_id, paddle_subscription_id, environment")
      .eq("id", retainerId)
      .maybeSingle();

    if (error || !retainer) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: cors,
      });
    }

    if (retainer.user_id !== callerId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: cors,
      });
    }

    if (!retainer.paddle_subscription_id) {
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
