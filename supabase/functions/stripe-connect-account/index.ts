import { createClient } from "npm:@supabase/supabase-js@2";
import { enforcePublicRateLimit } from "../_shared/abuse-rate-limit.ts";
import {
  accountCanTakeClientPayments,
  connectReturnOrigin,
  getStripeConnectKey,
  isStripeAccountId,
  stripeRequest,
} from "../_shared/stripe-connect.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
  "Content-Type": "application/json",
};
const json = (value: unknown, status = 200) => Response.json(value, { status, headers });

type StripeAccount = {
  id: string;
  country: string;
  livemode: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  details_submitted: boolean;
  capabilities?: { card_payments?: string };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const token = req.headers.get("Authorization")?.replace(/^Bearer /, "");
  if (!token) return json({ error: "Unauthorized" }, 401);
  const auth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: userData, error: userError } = await auth.auth.getUser(token);
  const user = userData?.user;
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  let body: { action?: string; country?: string };
  try {
    body = await req.json();
    if (!body || typeof body !== "object") return json({ error: "Invalid request" }, 400);
  } catch { return json({ error: "Invalid request" }, 400); }
  if (body.action !== "status" && body.action !== "onboard") return json({ error: "Invalid action" }, 400);
  if (body.action === "onboard") {
    try {
      const limited = await enforcePublicRateLimit(req, {
        source: "stripe-connect-account", resource: user.id,
        ipLimit: { maxRequests: 30, windowSeconds: 10 * 60 },
        resourceLimit: { maxRequests: 10, windowSeconds: 10 * 60 },
      });
      if (limited) return limited;
    } catch { return json({ error: "Payment account setup is temporarily unavailable" }, 503); }
    if (!connectReturnOrigin()) return json({ error: "Connect return origin is not configured" }, 503);
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: saved, error: readError } = await db.from("client_payment_accounts")
    .select("stripe_account_id,country")
    .eq("user_id", user.id).eq("environment", "test").maybeSingle();
  if (readError) return json({ error: "Could not read payment account" }, 500);
  const key = getStripeConnectKey();
  if (!key) return json({ configured: false, connected: false, environment: "test" });

  try {
    let accountId = saved?.stripe_account_id as string | undefined;
    if (!accountId && body.action === "status") {
      return json({ configured: true, connected: false, environment: "test" });
    }
    if (!accountId) {
      const country = typeof body.country === "string" ? body.country.toUpperCase() : undefined;
      if (!country || !/^[A-Z]{2}$/.test(country)) return json({ error: "Two-letter business country is required" }, 400);
      if (!user.email) return json({ error: "An account email is required" }, 400);
      // The owner enters their legal country; Stripe collects identity and bank
      // details in hosted onboarding. No bank details enter CloseSync.
      const params = new URLSearchParams({
        type: "standard", country, email: user.email,
        "capabilities[card_payments][requested]": "true",
        "capabilities[transfers][requested]": "true",
        "metadata[closesync_user_id]": user.id,
      });
      const created = await stripeRequest<StripeAccount>(key, "/accounts", {
        method: "POST", body: params,
        idempotencyKey: `closesync-connect-test-${user.id}`,
      });
      if (!isStripeAccountId(created.id) || created.livemode || created.country !== country) {
        throw new Error("Stripe returned an unexpected account");
      }
      const { error: saveError } = await db.from("client_payment_accounts").insert({
        user_id: user.id, environment: "test", stripe_account_id: created.id, country,
      });
      if (saveError) throw new Error("Could not store connected account");
      accountId = created.id;
    }
    if (!isStripeAccountId(accountId)) throw new Error("Stored account ID is invalid");
    const account = await stripeRequest<StripeAccount>(key, `/accounts/${accountId}`);
    if (account.id !== accountId || account.livemode) throw new Error("Stripe account mode mismatch");
    const ready = accountCanTakeClientPayments(account);
    const { error: updateError } = await db.from("client_payment_accounts").update({
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      card_payments_active: account.capabilities?.card_payments === "active",
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id).eq("environment", "test").eq("stripe_account_id", accountId);
    if (updateError) throw new Error("Could not update account status");

    if (body.action === "status" || ready) {
      return json({ configured: true, connected: true, ready, environment: "test",
        chargesEnabled: account.charges_enabled, payoutsEnabled: account.payouts_enabled });
    }
    const origin = connectReturnOrigin()!;
    const link = await stripeRequest<{ url: string }>(key, "/account_links", {
      method: "POST",
      body: new URLSearchParams({
        account: accountId,
        refresh_url: `${origin}/dashboard/settings#integrations`,
        return_url: `${origin}/dashboard/settings#integrations`,
        type: "account_onboarding",
      }),
    });
    if (!link.url?.startsWith("https://connect.stripe.com/")) throw new Error("Stripe returned an unexpected onboarding URL");
    return json({ configured: true, connected: true, ready: false, environment: "test", url: link.url });
  } catch (error) {
    console.error("stripe-connect-account:", error instanceof Error ? error.message : String(error));
    return json({ error: "Could not prepare the connected account. Please retry." }, 502);
  }
});
