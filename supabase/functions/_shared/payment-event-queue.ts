import { createClient } from "npm:@supabase/supabase-js@2";
import { processPaymentEvent } from "./payment-event-handlers.ts";
import type { PaddleEnv } from "./paddle.ts";

export async function drainPaymentEvents() {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let processed = 0;
  const errors: string[] = [];
  const started = Date.now();
  while (processed < 5 && Date.now() - started < 30_000) {
    const { data: rows, error } = await db.rpc("claim_payment_webhook_event");
    if (error) throw error;
    const event = rows?.[0];
    if (!event) break;
    let failure: string | null = null;
    try {
      await processPaymentEvent(event.event_type, event.payload, event.environment as PaddleEnv, event.event_id);
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      errors.push(failure);
      console.error("Payment event processing failed", event.event_id, failure);
    }
    const { error: finishError } = await db.rpc("finish_payment_webhook_event", {
      _environment: event.environment, _event_id: event.event_id, _claim_token: event.claim_token, _error: failure,
    });
    if (finishError) throw finishError;
    processed++;
  }
  const { count: failed, error: healthError } = await db.from("payment_webhook_events").select("event_id", { count: "exact", head: true }).eq("status","failed");
  if (healthError) throw healthError;
  return { ok: errors.length === 0 && !failed, processed, failed: failed || 0, errors };
}
