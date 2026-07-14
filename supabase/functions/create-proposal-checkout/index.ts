// Creates a Paddle transaction with a custom amount for a specific proposal,
// then returns the transaction ID. Frontend opens checkout with this ID.
import { createClient } from "npm:@supabase/supabase-js@2";
import { getPaddleClient, gatewayFetch, type PaddleEnv } from "../_shared/paddle.ts";
import { calculateCommercialTotals } from "../_shared/commercial-calc.ts";

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
    const { proposalId, environment } = await req.json();
    if (!proposalId) {
      return new Response(JSON.stringify({ error: "proposalId required" }), {
        status: 400,
        headers: cors,
      });
    }
    const env = (environment || "sandbox") as PaddleEnv;

    // Fetch proposal (service role bypasses RLS — safe; only id needed publicly)
    const { data: proposal, error: pErr } = await supabase
      .from("proposals")
      .select(
        "id, client_name, company_name, service_type, amount_cents, currency, tax_rate, tax_mode, client_paid",
      )
      .eq("id", proposalId)
      .maybeSingle();

    if (pErr || !proposal) {
      return new Response(JSON.stringify({ error: "Proposal not found" }), {
        status: 404,
        headers: cors,
      });
    }
    if (proposal.client_paid) {
      return new Response(JSON.stringify({ error: "Already paid" }), {
        status: 400,
        headers: cors,
      });
    }
    if (!proposal.amount_cents) {
      return new Response(
        JSON.stringify({ error: "Invalid amount (min $0.70)" }),
        { status: 400, headers: cors },
      );
    }

    const { totalCents } = calculateCommercialTotals(
      proposal.amount_cents,
      proposal.tax_rate,
      proposal.tax_mode,
    );

    if (!totalCents || totalCents < 70) {
      return new Response(
        JSON.stringify({ error: "Invalid amount (min $0.70)" }),
        { status: 400, headers: cors },
      );
    }

    // Look up the catalog product to attach the non-catalog price to.
    const productRes = await gatewayFetch(
      env,
      `/products?external_id=proposal_payment`,
    );
    const productJson = await productRes.json();
    const productId = productJson.data?.[0]?.id;
    if (!productId) {
      return new Response(
        JSON.stringify({ error: "Payments product not configured" }),
        { status: 500, headers: cors },
      );
    }

    const paddle = getPaddleClient(env);
    const currency = (proposal.currency || "USD").toUpperCase();
    const description = `${proposal.service_type} — ${proposal.company_name || proposal.client_name}`;

    const txn = await paddle.transactions.create({
      items: [
        {
          quantity: 1,
          price: {
            description,
            productId,
            unitPrice: {
              amount: String(proposal.amount_cents),
              currencyCode: currency as any,
            },
            quantity: { minimum: 1, maximum: 1 },
            taxMode: "account_setting" as any,
          } as any,
        },
      ],
      customData: { proposalId: proposal.id, kind: "proposal_payment" },
    } as any);

    return new Response(
      JSON.stringify({ transactionId: txn.id }),
      { headers: cors },
    );
  } catch (e: any) {
    console.error("create-proposal-checkout error:", e?.message || e);
    return new Response(
      JSON.stringify({ error: e?.message || String(e) }),
      { status: 500, headers: cors },
    );
  }
});
