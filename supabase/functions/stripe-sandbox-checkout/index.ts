import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { enforcePublicRateLimit } from "../_shared/abuse-rate-limit.ts";
import { readBoundedJson } from "../_shared/bounded-json.ts";
import { connectReturnOrigin, getStripeConnectKey } from "../_shared/stripe-connect.ts";
import { getOrCreateSandboxSession, UUID_PATTERN, type SandboxCheckout } from "../_shared/stripe-sandbox-checkout.ts";

const json = (value: unknown, status = 200) => Response.json(value, { status, headers: corsHeaders });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const key = getStripeConnectKey();
  const origin = connectReturnOrigin();
  if (Deno.env.get("STRIPE_CONNECT_SANDBOX_CHECKOUT_ENABLED") !== "true" || !key || !origin
    || !Deno.env.get("STRIPE_CONNECT_SANDBOX_WEBHOOK_SECRET")?.startsWith("whsec_")) {
    return json({ error: "sandbox_checkout_unavailable" }, 503);
  }

  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return json({ error: "unauthorized" }, 401);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: { user }, error: authError } = await db.auth.getUser(token);
  if (authError || !user) return json({ error: "unauthorized" }, 401);

  const body = await readBoundedJson(request, 4096).catch(() => null) as { contractId?: unknown } | null;
  if (typeof body?.contractId !== "string" || !UUID_PATTERN.test(body.contractId)) {
    return json({ error: "invalid_contract" }, 400);
  }

  try {
    const limited = await enforcePublicRateLimit(request, {
      source: "stripe-sandbox-checkout", resource: user.id,
      ipLimit: { maxRequests: 30, windowSeconds: 600 },
      resourceLimit: { maxRequests: 10, windowSeconds: 600 },
    });
    if (limited) return limited;

    const { data, error } = await db.rpc("reserve_stripe_sandbox_checkout", {
      _owner: user.id, _contract_id: body.contractId, _return_origin: origin,
    }).maybeSingle();
    if (error) throw error;
    if (!data) return json({ error: "contract_or_test_account_unavailable" }, 404);
    const attempt = data as SandboxCheckout;
    if (attempt.status === "paid") return json({ status: "paid", mode: "test" });

    const session = await getOrCreateSandboxSession(key, attempt);
    if (!attempt.stripe_session_id) {
      const { error: bindError } = await db.from("stripe_sandbox_checkouts")
        .update({ stripe_session_id: session.id }).eq("id", attempt.id).is("stripe_session_id", null);
      if (bindError) throw bindError;
    }
    return json({ status: session.status, url: session.url, mode: "test" });
  } catch {
    console.error("Sandbox Stripe checkout failed");
    return json({ error: "sandbox_checkout_failed" }, 503);
  }
});
