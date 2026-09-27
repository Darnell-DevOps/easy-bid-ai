import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyWebhook, type PaddleEnv } from "../_shared/paddle.ts";
import { drainPaymentEvents } from "../_shared/payment-event-queue.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void };

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const env = new URL(req.url).searchParams.get("env") || "sandbox";
  if (env !== "sandbox" && env !== "live") return new Response("Invalid environment", { status: 400 });
  let event;
  try {
    event = await verifyWebhook(req, env as PaddleEnv);
  } catch {
    return new Response("Invalid webhook signature", { status: 400 });
  }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { error } = await db.from("payment_webhook_events").upsert({
    environment: env, event_id: event.eventId, event_type: event.eventType,
    occurred_at: event.occurredAt, payload: event.data,
  }, { onConflict: "environment,event_id", ignoreDuplicates: true });
  if (error) {
    console.error("Payment event persistence failed", error.message);
    return new Response("Please retry webhook delivery", { status: 503 });
  }
  const processing = drainPaymentEvents().catch(error => console.error("Payment background worker failed", error));
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(processing);
  else await processing;
  return Response.json({ received: true });
});
