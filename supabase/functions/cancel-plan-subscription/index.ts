// Cancels the caller's own SaaS subscription and downgrades them only after
// Paddle confirms the cancellation. The target row is always resolved from
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
      await paddle.subscriptions.cancel(subscription.paddle_subscription_id, {
        effectiveFrom: "immediately",
      });
    } else if (subscription?.plan === "starter" || subscription?.plan === "pro") {
      throw new Error("Subscription is still being provisioned; please try cancellation again shortly");
    }

    const { error: updateError } = await supabase
      .from("subscriptions")
      .upsert(
        {
          user_id: callerId,
          plan: "free",
          paddle_subscription_id: null,
          paddle_customer_id: null,
          paddle_price_id: null,
          environment: null,
          cancel_at_period_end: false,
          current_period_end: null,
        },
        { onConflict: "user_id" },
      );
    if (updateError) throw updateError;

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
