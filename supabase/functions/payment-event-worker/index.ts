import { cronUnauthorized, isCronAuthorized } from "../_shared/cron-auth.ts";
import { drainPaymentEvents } from "../_shared/payment-event-queue.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!isCronAuthorized(req)) return cronUnauthorized();
  try {
    const result = await drainPaymentEvents();
    return Response.json(result, { status: result.ok ? 200 : 500 });
  } catch (error) {
    console.error("Payment queue worker failed", error);
    return Response.json({ ok: false, error: "Payment queue worker failed" }, { status: 500 });
  }
});
