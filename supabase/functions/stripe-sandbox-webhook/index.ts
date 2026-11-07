import { createClient } from "npm:@supabase/supabase-js@2";
import { readBoundedText } from "../_shared/bounded-json.ts";
import { sandboxCheckoutEvent, verifyStripeWebhookSignature } from "../_shared/stripe-sandbox-checkout.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  const secret = Deno.env.get("STRIPE_CONNECT_SANDBOX_WEBHOOK_SECRET");
  if (!secret?.startsWith("whsec_") || Deno.env.get("STRIPE_CONNECT_SANDBOX_CHECKOUT_ENABLED") !== "true") {
    return new Response(null, { status: 503 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response(null, { status: 400 });

  const body = await readBoundedText(request, 1_048_576).catch(() => null);
  if (!body || !await verifyStripeWebhookSignature(body, signature, secret)) return new Response(null, { status: 400 });
  let event: unknown;
  try { event = JSON.parse(body); } catch { return new Response(null, { status: 400 }); }
  const update = sandboxCheckoutEvent(event);
  if (!update) return new Response(null, { status: 204 });

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data, error } = await db.rpc("record_stripe_sandbox_checkout_event", update);
  if (error) return new Response(null, { status: 503 });
  if (data !== true) console.warn("Unmatched sandbox checkout event");
  return new Response(null, { status: 204 });
});
