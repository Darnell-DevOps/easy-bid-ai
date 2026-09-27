// Paddle webhook: marks proposals paid and manages retainer subscriptions.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  getPaddleClient,
  EventName,
  getPlanForPriceId,
  getServerPaddleEnv,
  type PaddleEnv,
} from "./paddle.ts";
import { calculateCommercialTotals } from "./commercial-calc.ts";
import { buildOnboardingFields, buildOnboardingPrefill } from "./onboarding-fields.ts";
import { resolvePublicUrl } from "./customDomain.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function valueAtPath(value: unknown, path: Array<string | number>): unknown {
  let current = value;
  for (const part of path) {
    if (typeof part === "number") {
      if (!Array.isArray(current)) return undefined;
      current = current[part];
    } else {
      if (!current || typeof current !== "object") return undefined;
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}

function planEventPriceId(data: unknown): string | null {
  const candidates = [
    valueAtPath(data, ["items", 0, "price", "id"]),
    valueAtPath(data, ["items", 0, "priceId"]),
    valueAtPath(data, ["details", "lineItems", 0, "price", "id"]),
    valueAtPath(data, ["details", "lineItems", 0, "priceId"]),
  ];
  return candidates.find((value): value is string => typeof value === "string") ?? null;
}

function isAuthoritativePlanEnvironment(env: PaddleEnv): boolean {
  return env === getServerPaddleEnv();
}

function requirePlanFromEvent(data: unknown, env: PaddleEnv) {
  const priceId = planEventPriceId(data);
  if (!priceId) throw new Error("Plan event is missing its Paddle price ID");
  const plan = getPlanForPriceId(env, priceId);
  if (!plan) throw new Error(`Unrecognized plan price ID: ${priceId}`);
  return { plan, priceId };
}

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
    const { data, error } = await supabase.functions.invoke("send-email", { body: args });
    if (error) throw error;
    if (data?.ok !== true && !data?.suppressed) throw new Error("Payment email delivery not confirmed");
  } catch (e: any) {
    console.error("send-email exception:", e?.message || e);
    throw e;
  }
}

async function automationsHandlePaymentEvent(args: {
  userId: string;
  kind: "proposal_paid" | "retainer_paid" | "proposal_failed" | "retainer_failed";
  proposalId?: string | null;
  retainerId?: string | null;
  amountCents?: number;
  currency?: string;
}): Promise<Record<string, boolean>> {
  try {
    const { data, error } = await supabase.rpc("automations_handle_payment_event", {
      _user_id: args.userId,
      _kind: args.kind,
      _proposal_id: args.proposalId ?? null,
      _retainer_id: args.retainerId ?? null,
      _amount_cents: args.amountCents ?? 0,
      _currency: args.currency ?? "USD",
    });
    if (error) {
      console.error("automations_handle_payment_event error:", error.message);
      throw error;
    }
    const flags = (data as Record<string, boolean>) || {};
    if (args.kind === "retainer_paid") {
      const { data: enabled, error: flagError } = await supabase.rpc("automation_enabled", { _user_id: args.userId, _key: "payment_auto_confirmation" });
      if (flagError) throw flagError;
      flags.payment_auto_confirmation = enabled === true;
    }
    return flags;
  } catch (e: any) {
    console.error("automations_handle_payment_event exception:", e?.message || e);
    throw e;
  }
}

async function handleTransactionCompleted(data: any, env: PaddleEnv) {
  const cd = data?.customData || {};

  if (cd.kind === "plan_subscription" && cd.userId) {
    if (!isAuthoritativePlanEnvironment(env)) return;
    const paddle = getPaddleClient(env);
    const transaction = data.subscriptionId ? data : await paddle.transactions.get(data.id);
    if (!transaction.subscriptionId) throw new Error("Plan subscription is not provisioned yet");
    await syncPlanSubscription(await paddle.subscriptions.get(transaction.subscriptionId), env, cd.userId);
    return;
  }
  // Proposal one-off payments
  if (cd.proposalId && cd.kind !== "retainer_subscription") {
    const { error } = await supabase.rpc("mark_proposal_paid", {
      _proposal_id: cd.proposalId,
      _txn_id: data.id,
    });
    if (error) throw error;

    const { data: prop, error: proposalError } = await supabase
      .from("proposals")
      .select("user_id, client_id, client_name, company_name, service_type, amount_cents, currency, tax_rate, tax_mode, goals, deliverables")
      .eq("id", cd.proposalId)
      .maybeSingle();
    if (proposalError) throw proposalError;
    if (!prop) throw new Error("Paid proposal not found");
    let clientEmail: string | null = null;
    if (prop?.client_id) {
      const { data: c, error: clientError } = await supabase.from("clients").select("email").eq("id", prop.client_id).maybeSingle();
      if (clientError) throw clientError;
      clientEmail = c?.email || null;
    }

    // Resolve the authoritative final payable total.
    // Paddle's payload is the strongest source (what was actually charged); fall back to our structured expectation.
    const expectedTotalCents = prop?.amount_cents
      ? calculateCommercialTotals(prop.amount_cents, prop.tax_rate, prop.tax_mode).totalCents
      : 0;
    const actualTotalCents = Number(data?.details?.totals?.total ?? data?.details?.totals?.grandTotal ?? 0);
    const resolvedAmountCents = actualTotalCents > 0 ? actualTotalCents : expectedTotalCents;

    if (actualTotalCents > 0 && expectedTotalCents > 0 && actualTotalCents !== expectedTotalCents) {
      console.warn(
        `Proposal payment total mismatch for ${cd.proposalId}: expected ${expectedTotalCents}c, actual ${actualTotalCents}c`
      );
    }

    const resolvedCurrency = prop?.currency || data?.currencyCode || "USD";

    // Run automation side-effects (notifications, onboarding auto-send intent, onboarding task)
    const ran = prop?.user_id
      ? await automationsHandlePaymentEvent({
          userId: prop.user_id,
          kind: "proposal_paid",
          proposalId: cd.proposalId,
          amountCents: resolvedAmountCents,
          currency: resolvedCurrency,
        })
      : {};

    // Create and initialize the canonical form before any network email send.
    const { data: claim, error: claimErr } = await supabase.rpc("prepare_payment_onboarding", {
      _proposal_id: cd.proposalId, _fields: buildOnboardingFields(prop.service_type), _responses: buildOnboardingPrefill(prop),
    });
    if (claimErr) throw claimErr;
    // Send payment-confirmation to client only if automation enabled
    if (clientEmail && prop && ran.payment_auto_confirmation) {
      await sendEmail({
        templateName: "payment-confirmation",
        recipientEmail: clientEmail,
        userId: prop.user_id,
        idempotencyKey: `paid-prop-${cd.proposalId}-${data.id}`,
        data: {
          name: prop.client_name,
          amount: fmtMoney(resolvedAmountCents, resolvedCurrency),
          description: prop.service_type || `Proposal — ${prop.client_name}`,
        },
      });
    }

    // Authoritative onboarding-form creation.
    // Atomic claim → build fields/prefill → conditional real send → conditional sent_at.
    // Failures are retried from the durable queue after acknowledgement.
    if (prop?.user_id) {
      try {
        {
          const formId = (claim as any)?.form_id as string | null;
          if (formId) {
            // Retry-safe: attempt the welcome send whenever auto-send is on,
            // the canonical form still has sent_at null, and we have an email.
            // Works whether this webhook call created the form or found one
            // claimed by a prior failed attempt.
            const { data: formRow, error: formError } = await supabase
              .from("onboarding_forms")
              .select("access_token, sent_at")
              .eq("id", formId)
              .maybeSingle();
            if (formError) throw formError;
            if (!formRow) throw new Error("Onboarding form not found after creation");
            const token = (formRow as any)?.access_token as string | undefined;
            const alreadySent = !!(formRow as any)?.sent_at;
            const autoSend = ran.onboarding_auto_send === true;
            if (autoSend && clientEmail && token && !alreadySent) {
              const url = await resolvePublicUrl(supabase, prop.user_id, `/onboard/${token}`, "forms");
              let sentOk = false;
              try {
                const { data: sendData, error: sendErr } = await supabase.functions.invoke("send-email", {
                  body: {
                    templateName: "onboarding-welcome",
                    recipientEmail: clientEmail,
                    userId: prop.user_id,
                    idempotencyKey: `onboarding-welcome-${formId}`,
                    data: {
                      client_name: prop.client_name,
                      onboarding_link: url,
                    },
                  },
                });
                if (sendErr) {
                  throw sendErr;
                } else if ((sendData as any)?.ok === true) {
                  // Covers fresh sends and deduped prior successes.
                  sentOk = true;
                } else {
                  if (!sendData?.suppressed) throw new Error("Onboarding email delivery not confirmed");
                }
              } catch (e: any) {
                throw e;
              }
              if (sentOk) {
                const { error: sentUpdateError } = await supabase
                  .from("onboarding_forms")
                  .update({ sent_at: new Date().toISOString() })
                  .eq("id", formId)
                  .is("sent_at", null);
                if (sentUpdateError) throw sentUpdateError;
              }
            }
          }
        }
      } catch (e: any) {
        throw e;
      }
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

    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Invalid retainer payment amount");
    const { error: paymentError } = await supabase.rpc("record_retainer_payment", {
      _environment: env, _event_id: data.id, _retainer_id: retainerId,
      _transaction_id: data.id, _kind: "paid", _amount_cents: amount, _currency: currency,
    });
    if (paymentError) throw paymentError;
    // Email payment confirmation to the client (gated by automation)
    const ran = await automationsHandlePaymentEvent({
      userId: ret.user_id,
      kind: "retainer_paid",
      retainerId,
      amountCents: amount,
      currency,
    });
    if (ret.client_email && ran.payment_auto_confirmation === true) {
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

async function handleTransactionPaymentFailed(data: any, env: PaddleEnv, eventId: string) {
  const cd = data?.customData || {};

  if (cd.kind === "plan_subscription") {
    if (!isAuthoritativePlanEnvironment(env)) return;
    // Paddle retries per its own dunning schedule; if retries are exhausted
    // it fires subscription.canceled, which downgrades the user to Free.
    console.warn("plan_subscription payment failed for user:", cd.userId);
    return;
  }

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

  const amount = Number(
    data?.details?.totals?.total ?? data?.details?.totals?.grandTotal ?? 0,
  );
  const currency = data?.currencyCode || ret.currency || "USD";

  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error("Invalid failed-payment amount");
  const { data: effect, error: paymentError } = await supabase.rpc("record_retainer_payment", {
    _environment: env, _event_id: eventId, _retainer_id: retainerId,
    _transaction_id: data.id, _kind: "failed", _amount_cents: amount, _currency: currency, _reason: reason,
  });
  if (paymentError) throw paymentError;
  if (effect?.ignored) return;
  const newRetryCount = effect.retry_count;
  // Run automation side-effects (owner notification gated by retainer_notify_failed)
  const ran = await automationsHandlePaymentEvent({
    userId: ret.user_id,
    kind: "retainer_failed",
    retainerId,
    amountCents: amount,
    currency,
  });

  // Email the owner only if the failure notification automation is enabled
  if (ran.retainer_notify_failed) {
    const to = await ownerEmail(ret.user_id);
    if (to) {
      await sendEmail({
        templateName: "payment-failed",
        recipientEmail: to,
        userId: ret.user_id,
        idempotencyKey: `payfail-${retainerId}-${eventId}`,
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
}

async function syncPlanSubscription(data: any, env: PaddleEnv, userId: string) {
  if (!isAuthoritativePlanEnvironment(env)) return;
  if (!userId) throw new Error("Plan subscription owner missing");
  const cancelled = data.status === "canceled";
  const { plan, priceId } = cancelled ? { plan: "free", priceId: null } : requirePlanFromEvent(data, env);
  const { error } = await supabase.rpc("apply_paddle_plan_state", {
    _user_id: userId, _subscription_id: data.id, _customer_id: data.customerId,
    _price_id: priceId, _environment: env, _plan: plan,
    _period_end: data.scheduledChange?.effectiveAt || data.currentBillingPeriod?.endsAt || null,
    _cancel_at_period_end: !cancelled && data.scheduledChange?.action === "cancel",
    _updated_at: data.updatedAt,
  });
  if (error) throw error;
}

export async function processPaymentEvent(eventType: string, data: any, env: PaddleEnv, eventId: string) {
  if (eventType === EventName.TransactionCompleted) return handleTransactionCompleted(data, env);
  if (eventType === EventName.TransactionPaymentFailed) return handleTransactionPaymentFailed(data, env, eventId);
  if (![EventName.SubscriptionCreated, EventName.SubscriptionUpdated, EventName.SubscriptionCanceled].includes(eventType as any)) return;
  // Reconcile current provider state rather than applying stale webhook snapshots.
  const current = await getPaddleClient(env).subscriptions.get(data.id);
  const cd = current.customData || data.customData || {};
  const { data: planSub, error: lookupError } = await supabase.from("subscriptions").select("user_id")
    .eq("paddle_subscription_id", current.id).maybeSingle();
  if (lookupError) throw lookupError;
  if (planSub || cd.kind === "plan_subscription") {
    return syncPlanSubscription(current, env, planSub?.user_id || cd.userId);
  }
  let query = supabase.from("retainers").select("id,environment");
  query = cd.retainerId ? query.eq("id", cd.retainerId) : query.eq("paddle_subscription_id", current.id);
  const { data: ret, error } = await query.maybeSingle();
  if (error) throw error;
  if (!ret) return;
  if (ret.environment && ret.environment !== env) throw new Error("Retainer environment mismatch");
  const { error: updateError } = await supabase.from("retainers").update({
    paddle_subscription_id: current.id, paddle_customer_id: current.customerId,
    status: current.status === "canceled" ? "cancelled" : current.status,
    current_period_end: current.currentBillingPeriod?.endsAt || null,
    next_billing_date: current.nextBilledAt ? current.nextBilledAt.slice(0,10) : null,
    cancel_at_period_end: current.scheduledChange?.action === "cancel",
    scheduled_change: current.scheduledChange || null,
    cancelled_at: current.canceledAt || null,
  }).eq("id",ret.id);
  if (updateError) throw updateError;
}
