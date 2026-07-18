// Starts a plan subscription or updates the caller's existing subscription.
// Catalog prices are provisioned in Paddle ahead of time and supplied through
// server-only environment variables. The browser never chooses the Paddle
// environment or controls a price ID.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  gatewayFetch,
  getPaddleClient,
  getPlanPriceId,
  getServerPaddleEnv,
  type PaidPlan,
} from "../_shared/paddle.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

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

    const { targetPlan } = await req.json();
    if (targetPlan !== "starter" && targetPlan !== "pro") {
      return new Response(
        JSON.stringify({ error: "targetPlan must be 'starter' or 'pro'" }),
        { status: 400, headers: cors },
      );
    }

    const callerId = userData.user.id;
    const plan = targetPlan as PaidPlan;
    const env = getServerPaddleEnv();
    const priceId = getPlanPriceId(env, plan);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: current, error: currentError } = await supabase
      .from("subscriptions")
      .select("plan, paddle_subscription_id, paddle_price_id, environment")
      .eq("user_id", callerId)
      .maybeSingle();
    if (currentError) throw currentError;

    if (current?.paddle_subscription_id) {
      if (current.environment && current.environment !== env) {
        throw new Error("Existing subscription belongs to a different Paddle environment");
      }
      if (current.plan === plan && current.paddle_price_id === priceId) {
        return new Response(
          JSON.stringify({ mode: "unchanged", targetPlan: plan, environment: env }),
          { headers: cors },
        );
      }

      const update = await gatewayFetch(
        env,
        `/subscriptions/${encodeURIComponent(current.paddle_subscription_id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            items: [{ price_id: priceId, quantity: 1 }],
            proration_billing_mode: "prorated_immediately",
            on_payment_failure: "prevent_change",
          }),
        },
      );
      const updated = await update.json();
      if (!update.ok || !updated.data?.id) {
        throw new Error(`Could not update plan subscription: ${JSON.stringify(updated)}`);
      }

      const { error: persistError } = await supabase
        .from("subscriptions")
        .update({ paddle_price_id: priceId, environment: env })
        .eq("user_id", callerId);
      if (persistError) throw persistError;

      return new Response(
        JSON.stringify({ mode: "updated", targetPlan: plan, environment: env }),
        { headers: cors },
      );
    }

    const { error: persistError } = await supabase
      .from("subscriptions")
      .upsert(
        { user_id: callerId, paddle_price_id: priceId, environment: env },
        { onConflict: "user_id" },
      );
    if (persistError) throw persistError;

    const paddle = getPaddleClient(env);
    const transaction = await paddle.transactions.create({
      items: [{ priceId, quantity: 1 }],
      customData: {
        userId: callerId,
        kind: "plan_subscription",
      },
    });

    return new Response(
      JSON.stringify({
        mode: "checkout",
        transactionId: transaction.id,
        targetPlan: plan,
        environment: env,
      }),
      { headers: cors },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("create-plan-checkout error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: cors,
    });
  }
});
