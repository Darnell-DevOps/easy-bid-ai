// Stops renewal of the caller's subscription, retaining paid access until
// Paddle reports its actual cancellation. The target row is resolved from
// the caller's verified JWT, never from client-supplied identifiers.
import { createClient } from "npm:@supabase/supabase-js@2";
import { getPaddleClient, getServerPaddleEnv, type PaddleEnv } from "../_shared/paddle.ts";

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
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: cors,
      });
    }

    const callerId = userData.user.id;
    const { data: subscription, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("plan, paddle_subscription_id, environment")
      .eq("user_id", callerId)
      .maybeSingle();
    if (subscriptionError) throw subscriptionError;

    if (subscription?.paddle_subscription_id) {
      const configuredEnv = getServerPaddleEnv();
      const env = (subscription.environment ?? configuredEnv) as PaddleEnv;
      if (env !== configuredEnv) {
        throw new Error("Subscription belongs to a different Paddle environment");
      }

      const paddle = getPaddleClient(env);
      const current = await paddle.subscriptions.get(subscription.paddle_subscription_id);
      const cancelled = current.scheduledChange?.action === "cancel"
        ? current
        : await paddle.subscriptions.cancel(subscription.paddle_subscription_id, {
          effectiveFrom: "next_billing_period",
        });
      const accessEndsAt = cancelled.scheduledChange?.effectiveAt || cancelled.currentBillingPeriod?.endsAt;
      if (!accessEndsAt || !Number.isFinite(Date.parse(accessEndsAt))) {
        throw new Error("Paddle did not confirm the paid-access end date. Please refresh billing and try again.");
      }
      const { error: updateError } = await supabase.from("subscriptions")
        .update({ cancel_at_period_end: true, current_period_end: accessEndsAt, paddle_updated_at: cancelled.updatedAt })
        .eq("user_id", callerId).eq("paddle_subscription_id", subscription.paddle_subscription_id);
      if (updateError) throw updateError;
      return new Response(JSON.stringify({ ok: true, cancelAtPeriodEnd: true, accessEndsAt }), { headers: cors });
    } else if (subscription?.plan === "starter" || subscription?.plan === "pro") {
      throw new Error("Subscription is still being provisioned; please try cancellation again shortly");
    }

    // Already free: no entitlement mutation is necessary.
    return new Response(JSON.stringify({ ok: true }), { headers: cors });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("cancel-plan-subscription error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: cors,
    });
  }
});
