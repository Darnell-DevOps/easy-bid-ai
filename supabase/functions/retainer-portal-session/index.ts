// Creates a Paddle hosted customer portal session for a retainer's subscription.
// Resolves the retainer by its secret access_token (never by raw id) so that
// knowledge of a retainer's UUID alone can't be used to open its billing portal.
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
    const { token } = await req.json();
    if (!token || typeof token !== "string" || token.length < 16) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 400,
        headers: cors,
      });
    }

    const { data: retainer, error } = await supabase
      .from("retainers")
      .select("paddle_subscription_id, paddle_customer_id, environment")
      .eq("access_token", token)
      .maybeSingle();

    if (error || !retainer) {
      return new Response(JSON.stringify({ error: "Retainer not found" }), {
        status: 404,
        headers: cors,
      });
    }
    if (!retainer.paddle_subscription_id || !retainer.paddle_customer_id) {
      return new Response(
        JSON.stringify({ error: "No active subscription on this retainer yet" }),
        { status: 400, headers: cors },
      );
    }

    const env = (retainer.environment || "sandbox") as PaddleEnv;
    const paddle = getPaddleClient(env);
    const session: any = await (paddle as any).customerPortalSessions.create(
      retainer.paddle_customer_id,
      [retainer.paddle_subscription_id],
    );

    const subUrl =
      session?.urls?.subscriptions?.[0]?.cancelSubscription ||
      session?.urls?.subscriptions?.[0]?.updateSubscriptionPaymentMethod ||
      session?.urls?.general?.overview;

    return new Response(
      JSON.stringify({ url: subUrl, overview: session?.urls?.general?.overview }),
      { headers: cors },
    );
  } catch (e: any) {
    console.error("retainer-portal-session error:", e?.message || e);
    return new Response(
      JSON.stringify({ error: e?.message || String(e) }),
      { status: 500, headers: cors },
    );
  }
});
