// Paddle webhook: marks proposals paid and manages retainer subscriptions.
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyWebhook, EventName, type PaddleEnv } from "../_shared/paddle.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function fmtMoney(cents: number, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format((cents || 0) / 100);
  } catch {
    return `${((cents || 0) / 100).toFixed(2)} ${currency}`;
  }
}

async function ownerEmail(userId: string): Promise<string | null> {
  try {
    const { data } = await supabase.auth.admin.getUserById(userId);
    return data?.user?.email ?? null;
  } catch { return null; }
}

async function sendEmail(args: {
  templateName: string;
  recipientEmail: string;
  data: Record<string, unknown>;
  idempotencyKey: string;
  userId?: string;
}) {
  try {
    const { error } = await supabase.functions.invoke("send-email", { body: args });
    if (error) console.error("send-email invoke error:", error.message);
  } catch (e: any) {
    console.error("send-email exception:", e?.message || e);
  }
}

async function handleTransactionCompleted(data: any) {
  const cd = data?.customData || {};
  // Proposal one-off payments
  if (cd.proposalId && cd.kind !== "retainer_subscription") {
    const { error } = await supabase.rpc("mark_proposal_paid", {
      _proposal_id: cd.proposalId,
      _txn_id: data.id,
    });
    if (error) console.error("mark_proposal_paid error:", error.message);

    // Send payment-confirmation to client
    const { data: prop } = await supabase
      .from("proposals")
      .select("user_id, client_id, client_name, service_type, amount_cents, currency")
      .eq("id", cd.proposalId)
      .maybeSingle();
    let clientEmail: string | null = null;
    if (prop?.client_id) {
      const { data: c } = await supabase.from("clients").select("email").eq("id", prop.client_id).maybeSingle();
      clientEmail = c?.email || null;
    }
    if (clientEmail && prop) {
      await sendEmail({
        templateName: "payment-confirmation",
        recipientEmail: clientEmail,
        userId: prop.user_id,
        idempotencyKey: `paid-prop-${cd.proposalId}-${data.id}`,
        data: {
          name: prop.client_name,
          amount: fmtMoney(prop.amount_cents || 0, prop.currency || "USD"),
          description: prop.service_type || `Proposal — ${prop.client_name}`,
        },
      });
    }
    return;
  }
  // Recurring retainer charge — record an invoice and bump totals
  if (cd.retainerId || data.subscriptionId) {
    let retainerId: string | null = cd.retainerId || null;
    if (!retainerId && data.subscriptionId) {
      const { data: r } = await supabase
        .from("retainers")
        .select("id")
        .eq("paddle_subscription_id", data.subscriptionId)
        .maybeSingle();
      retainerId = r?.id || null;
    }
    if (!retainerId) return;
    const { data: ret } = await supabase
      .from("retainers")
      .select("user_id, client_email, client_name, total_billed_cents, total_payments_count, currency")
      .eq("id", retainerId)
      .maybeSingle();
    if (!ret) return;

    const amount = Number(data?.details?.totals?.total ?? data?.details?.totals?.grandTotal ?? 0);
    const currency = data?.currencyCode || ret.currency || "USD";

    await supabase.from("retainer_invoices").insert({
      user_id: ret.user_id,
      retainer_id: retainerId,
      amount_cents: amount,
      currency,
      due_date: new Date().toISOString().slice(0, 10),
      paid_at: new Date().toISOString(),
      paddle_transaction_id: data.id,
      status: "paid",
    });

    // Mark any prior failed invoice for this retainer as recovered
    await supabase
      .from("retainer_invoices")
      .update({ recovered_at: new Date().toISOString(), status: "recovered" })
      .eq("retainer_id", retainerId)
      .eq("status", "failed")
      .is("recovered_at", null);

    await supabase
      .from("retainers")
      .update({
        last_billed_date: new Date().toISOString().slice(0, 10),
        total_billed_cents: (ret.total_billed_cents || 0) + amount,
        total_payments_count: (ret.total_payments_count || 0) + 1,
        has_failed_payment: false,
        failed_payment_reason: null,
        failed_payment_at: null,
        payment_retry_count: 0,
        payment_recovered_at: new Date().toISOString(),
      })
      .eq("id", retainerId);

    // Clear any pending payment_failed reminders
    await supabase
      .from("retainer_reminders")
      .update({ status: "resolved", sent_at: new Date().toISOString() })
      .eq("retainer_id", retainerId)
      .in("kind", ["payment_failed", "payment_final"])
      .eq("status", "pending");

    // Email payment confirmation to the client
    if (ret.client_email) {
      await sendEmail({
        templateName: "payment-confirmation",
        recipientEmail: ret.client_email,
        userId: ret.user_id,
        idempotencyKey: `paid-ret-${retainerId}-${data.id}`,
        data: {
          name: ret.client_name,
          amount: fmtMoney(amount, currency),
          description: `Retainer — ${ret.client_name || ""}`.trim(),
        },
      });
    }
  }
}

async function handleTransactionPaymentFailed(data: any) {
  const cd = data?.customData || {};
  let retainerId: string | null = cd.retainerId || null;
  if (!retainerId && data.subscriptionId) {
    const { data: r } = await supabase
      .from("retainers")
      .select("id")
      .eq("paddle_subscription_id", data.subscriptionId)
      .maybeSingle();
    retainerId = r?.id || null;
  }
  if (!retainerId) return;

  const { data: ret } = await supabase
    .from("retainers")
    .select("user_id, client_name, currency, payment_retry_count")
    .eq("id", retainerId)
    .maybeSingle();
  if (!ret) return;

  const reason =
    data?.details?.payments?.[0]?.errorCode || "Payment declined";
  const newRetryCount = (ret.payment_retry_count || 0) + 1;
  const amount = Number(
    data?.details?.totals?.total ?? data?.details?.totals?.grandTotal ?? 0,
  );
  const currency = data?.currencyCode || ret.currency || "USD";

  // Record the failed invoice
  await supabase.from("retainer_invoices").insert({
    user_id: ret.user_id,
    retainer_id: retainerId,
    amount_cents: amount,
    currency,
    due_date: new Date().toISOString().slice(0, 10),
    failed_at: new Date().toISOString(),
    failure_reason: reason,
    paddle_transaction_id: data.id,
    status: "failed",
  });

  await supabase
    .from("retainers")
    .update({
      has_failed_payment: true,
      failed_payment_at: new Date().toISOString(),
      failed_payment_reason: reason,
      payment_retry_count: newRetryCount,
      status: "past_due",
    })
    .eq("id", retainerId);

  // Queue (or upgrade) a reminder for the owner
  const reminderKind = newRetryCount >= 3 ? "payment_final" : "payment_failed";
  await supabase.from("retainer_reminders").upsert(
    {
      user_id: ret.user_id,
      retainer_id: retainerId,
      kind: reminderKind,
      scheduled_for: new Date().toISOString(),
      status: "pending",
      channel: "in_app",
    },
    { onConflict: "retainer_id,kind" },
  );

  // Email the owner immediately
  const to = await ownerEmail(ret.user_id);
  if (to) {
    await sendEmail({
      templateName: "payment-failed",
      recipientEmail: to,
      userId: ret.user_id,
      idempotencyKey: `payfail-${retainerId}-${newRetryCount}`,
      data: {
        client_name: ret.client_name,
        amount: fmtMoney(amount, currency),
        reason,
        severity: newRetryCount >= 3 ? "final" : "warning",
        url: `https://app.closesync.io/recovery`,
      },
    });
  }
}

async function handleSubscriptionCreated(data: any) {
  const cd = data?.customData || {};
  const retainerId = cd.retainerId;
  if (!retainerId) return;
  await supabase
    .from("retainers")
    .update({
      paddle_subscription_id: data.id,
      paddle_customer_id: data.customerId,
      status: "active",
      current_period_end: data?.currentBillingPeriod?.endsAt || null,
      next_billing_date: data?.nextBilledAt
        ? new Date(data.nextBilledAt).toISOString().slice(0, 10)
        : null,
      cancel_at_period_end: false,
      cancelled_at: null,
    })
    .eq("id", retainerId);
}

async function handleSubscriptionUpdated(data: any) {
  const subId = data.id;
  const { data: ret } = await supabase
    .from("retainers")
    .select("id")
    .eq("paddle_subscription_id", subId)
    .maybeSingle();
  if (!ret) return;
  await supabase
    .from("retainers")
    .update({
      status: data.status === "active" ? "active" : data.status === "paused" ? "paused" : data.status,
      current_period_end: data?.currentBillingPeriod?.endsAt || null,
      next_billing_date: data?.nextBilledAt
        ? new Date(data.nextBilledAt).toISOString().slice(0, 10)
        : null,
      cancel_at_period_end: data?.scheduledChange?.action === "cancel",
      scheduled_change: data?.scheduledChange ?? null,
    })
    .eq("id", ret.id);
}

async function handleSubscriptionCanceled(data: any) {
  await supabase
    .from("retainers")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancel_at_period_end: false,
    })
    .eq("paddle_subscription_id", data.id);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  const url = new URL(req.url);
  const env = (url.searchParams.get("env") || "sandbox") as PaddleEnv;

  try {
    const event = await verifyWebhook(req, env);
    console.log("payments-webhook event:", event.eventType, "env:", env);

    switch (event.eventType) {
      case EventName.TransactionCompleted:
        await handleTransactionCompleted(event.data as any);
        break;
      case EventName.TransactionPaymentFailed:
        await handleTransactionPaymentFailed(event.data as any);
        break;
      case EventName.SubscriptionCreated:
        await handleSubscriptionCreated(event.data as any);
        break;
      case EventName.SubscriptionUpdated:
        await handleSubscriptionUpdated(event.data as any);
        break;
      case EventName.SubscriptionCanceled:
        await handleSubscriptionCanceled(event.data as any);
        break;
      default:
        console.log("Unhandled event:", event.eventType);
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
