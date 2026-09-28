// Creates (or reuses) a recurring Paddle price for a specific retainer,
// then returns a transactionId so the frontend can open Paddle Checkout.
import { createClient } from "npm:@supabase/supabase-js@2";
import { getPaddleClient, gatewayFetch, getServerPaddleEnv, type PaddleEnv } from "../_shared/paddle.ts";
import { calculateCommercialTotals } from "../_shared/commercial-calc.ts";
import { enforcePublicRateLimit } from "../_shared/abuse-rate-limit.ts";
import { mayUseCentralClientCheckout } from "../_shared/client-payment-policy.ts";

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

const RETAINER_PRODUCT_EXTERNAL_ID = "retainer_subscription";

async function ensureRetainerProduct(env: PaddleEnv): Promise<string> {
  const lookup = await gatewayFetch(
    env,
    `/products?external_id=${RETAINER_PRODUCT_EXTERNAL_ID}`,
  );
  const json = await lookup.json();
  const existing = json.data?.[0]?.id;
  if (existing) return existing;

  const create = await gatewayFetch(env, `/products`, {
    method: "POST",
    body: JSON.stringify({
      name: "Retainer Subscription",
      tax_category: "standard",
      import_meta: { external_id: RETAINER_PRODUCT_EXTERNAL_ID },
    }),
  });
  const created = await create.json();
  if (!created.data?.id) {
    throw new Error(`Could not create retainer product: ${JSON.stringify(created)}`);
  }
  return created.data.id;
}

function billingCycle(interval: string, customDays?: number | null) {
  switch (interval) {
    case "weekly":
      return { interval: "week", frequency: 1 };
    case "monthly":
      return { interval: "month", frequency: 1 };
    case "quarterly":
      return { interval: "month", frequency: 3 };
    case "custom":
      return { interval: "day", frequency: Math.max(1, customDays || 30) };
    default:
      return { interval: "month", frequency: 1 };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: cors,
    });
  }
  try {
    const { token } = await req.json();
    if (
      typeof token !== "string" ||
      token.length < 16 ||
      token.length > 128 ||
      !/^[a-zA-Z0-9_-]+$/.test(token)
    ) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 400,
        headers: cors,
      });
    }
    const limited = await enforcePublicRateLimit(req, {
      source: "create-retainer-subscription",
      resource: token,
      ipLimit: { maxRequests: 30, windowSeconds: 10 * 60 },
      resourceLimit: { maxRequests: 10, windowSeconds: 10 * 60 },
    });
    if (limited) return limited;

    const env = getServerPaddleEnv();
    if (!mayUseCentralClientCheckout(env)) {
      return new Response(
        JSON.stringify({ error: "Online client payments are unavailable until this business connects an approved payment account." }),
        { status: 503, headers: cors },
      );
    }

    const { data: retainer, error: rErr } = await supabase
      .from("retainers")
      .select(
        "id, user_id, client_name, client_email, company_name, title, description, amount_cents, currency, tax_rate, tax_mode, billing_interval, custom_interval_days, paddle_price_id, paddle_product_id, paddle_subscription_id, status",
      )
      .eq("access_token", token)
      .maybeSingle();

    if (rErr || !retainer) {
      return new Response(JSON.stringify({ error: "Retainer not found" }), {
        status: 404,
        headers: cors,
      });
    }
    if (retainer.paddle_subscription_id) {
      return new Response(
        JSON.stringify({ error: "Subscription already active for this retainer" }),
        { status: 400, headers: cors },
      );
    }

    // Compute the true final payable total (tax-inclusive) so Paddle charges
    // exactly what the app committed to. Null tax_rate/tax_mode → total = amount_cents.
    const { totalCents } = calculateCommercialTotals(
      retainer.amount_cents,
      retainer.tax_rate,
      retainer.tax_mode,
    );

    if (!totalCents || totalCents < 70) {
      return new Response(
        JSON.stringify({ error: "Invalid amount (min $0.70)" }),
        { status: 400, headers: cors },
      );
    }

    const productId = await ensureRetainerProduct(env);

    // Create a fresh recurring price for this retainer.
    const cycle = billingCycle(retainer.billing_interval, retainer.custom_interval_days);
    const currency = (retainer.currency || "USD").toUpperCase();
    const priceDescription = `${retainer.title} — ${retainer.company_name || retainer.client_name}`;

    const priceRes = await gatewayFetch(env, `/prices`, {
      method: "POST",
      body: JSON.stringify({
        product_id: productId,
        description: priceDescription,
        unit_price: { amount: String(totalCents), currency_code: currency },
        billing_cycle: cycle,
        quantity: { minimum: 1, maximum: 1 },
        tax_mode: "internal",
      }),
    });
    const priceJson = await priceRes.json();
    const paddlePriceId = priceJson.data?.id;
    if (!paddlePriceId) {
      throw new Error(`Could not create price: ${JSON.stringify(priceJson)}`);
    }

    // Persist Paddle ids
    await supabase
      .from("retainers")
      .update({
        paddle_product_id: productId,
        paddle_price_id: paddlePriceId,
        environment: env,
      })
      .eq("id", retainer.id);

    // Create a transaction so frontend can open overlay checkout.
    const paddle = getPaddleClient(env);
    const txn = await paddle.transactions.create({
      items: [{ priceId: paddlePriceId, quantity: 1 }],
      customData: {
        retainerId: retainer.id,
        userId: retainer.user_id,
        kind: "retainer_subscription",
      },
      ...(retainer.client_email
        ? { customer: { email: retainer.client_email } }
        : {}),
    } as any);

    return new Response(
      JSON.stringify({ transactionId: txn.id, paddlePriceId }),
      { headers: cors },
    );
  } catch (e: any) {
    console.error("create-retainer-subscription error:", e?.message || e);
    return new Response(
      JSON.stringify({ error: e?.message || String(e) }),
      { status: 500, headers: cors },
    );
  }
});
