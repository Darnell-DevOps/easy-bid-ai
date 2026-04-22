// Paddle webhook: marks proposals paid when their transaction completes.
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyWebhook, EventName, type PaddleEnv } from "../_shared/paddle.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const url = new URL(req.url);
  const env = (url.searchParams.get("env") || "sandbox") as PaddleEnv;

  try {
    const event = await verifyWebhook(req, env);
    console.log("payments-webhook event:", event.eventType, "env:", env);

    if (event.eventType === EventName.TransactionCompleted) {
      const data: any = event.data;
      const proposalId = data?.customData?.proposalId;
      if (proposalId) {
        const { error } = await supabase.rpc("mark_proposal_paid", {
          _proposal_id: proposalId,
          _txn_id: data.id,
        });
        if (error) console.error("mark_proposal_paid error:", error.message);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("webhook error:", e?.message || e);
    return new Response("Webhook error", { status: 400 });
  }
});
