// AI Coach Feed: produces a ranked list of next actions across the whole account,
// plus a separate weekly briefing card.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  corsHeaders,
  callAITool,
  getServiceClient,
  getUserId,
  handleError,
  errorResponse,
  jsonResponse,
  saveInsight,
} from "../_shared/ai-coach.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const userId = await getUserId(req);
    if (!userId) return errorResponse("Unauthorized", 401);

    const supabase = getServiceClient();

    // Build context — last 60d of activity.
    const since = new Date(Date.now() - 60 * 86400000).toISOString();

    const [{ data: proposals }, { data: retainers }, { data: clients }, { data: bookings }] =
      await Promise.all([
        supabase
          .from("proposals")
          .select(
            "id, client_name, company_name, service_type, status, client_paid, amount_cents, currency, sent_at, viewed_at, accepted_at, paid_at, created_at",
          )
          .eq("user_id", userId)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("retainers")
          .select(
            "id, client_name, status, billing_interval, amount_cents, currency, has_failed_payment, cancel_at_period_end, next_billing_date, total_billed_cents, total_payments_count, start_date",
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("clients")
          .select("id, name, status, created_at, service_requested")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("bookings")
          .select("scheduled_at, client_name, meeting_name, status")
          .eq("user_id", userId)
          .neq("status", "cancelled")
          .gte("scheduled_at", new Date().toISOString())
          .lte("scheduled_at", new Date(Date.now() + 7 * 86400000).toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(20),
      ]);

    const upcomingBookings = bookings || [];

    const won = (proposals || []).filter((p) => p.client_paid).length;
    const lost = (proposals || []).filter((p) => p.status === "rejected").length;
    const sent = (proposals || []).filter((p) => p.status !== "draft").length;
    const winRate = sent > 0 ? Math.round((won / sent) * 100) : 0;
    const mrrCents = (retainers || [])
      .filter((r) => r.status === "active")
      .reduce((acc, r) => {
        const monthly = r.billing_interval === "weekly"
          ? r.amount_cents * 4.33
          : r.billing_interval === "quarterly"
            ? r.amount_cents / 3
            : r.amount_cents;
        return acc + monthly;
      }, 0);

    const summary = `
Account snapshot (last 60d):
- Proposals: ${proposals?.length || 0} created, ${sent} sent, ${won} paid, ${lost} rejected, win rate ${winRate}%
- Active retainers: ${(retainers || []).filter((r) => r.status === "active").length}
- Estimated MRR: ${(mrrCents / 100).toFixed(0)}
- New leads: ${(clients || []).filter((c) => (c.status || "").toLowerCase() === "new").length}
- Confirmed bookings in next 7d: ${upcomingBookings.length}

Upcoming bookings (next 7d, excludes cancelled):
${upcomingBookings.length === 0 ? "NONE — do not suggest preparing for meetings or following up on calls." : JSON.stringify(upcomingBookings, null, 2)}

Recent proposals (top 20):
${JSON.stringify((proposals || []).slice(0, 20), null, 2)}

Active retainers:
${JSON.stringify((retainers || []).filter((r) => r.status === "active").slice(0, 10), null, 2)}

New leads with no proposal yet:
${JSON.stringify((clients || []).filter((c) => (c.status || "").toLowerCase() === "new").slice(0, 10), null, 2)}
`.trim();

    // 1. Coach feed — ranked next actions.
    const feed = await callAITool({
      model: "google/gemini-2.5-pro",
      system:
        "You are an elite sales coach embedded inside a proposal/CRM SaaS. You scan the user's actual data and produce 3-6 prioritised next actions that move money this week. STRICT RULES: (1) Every action MUST reference a specific entity (client name, proposal, retainer, or lead) that appears in the data provided. (2) NEVER invent meetings, bookings, calls, emails, or events that are not in the data. (3) If a category has no data (e.g. no upcoming bookings, no failed payments), do not produce actions for it. (4) If the account is mostly empty, return 1-3 onboarding-style actions like 'Create your first proposal' or 'Add your first client' instead of fabricating activity. (5) No motivational fluff, no generic advice. Cite numbers and names from the data.",
      user: summary,
      toolName: "build_coach_feed",
      toolDescription: "Return a ranked list of next actions for the user this week.",
      parameters: {
        type: "object",
        properties: {
          actions: {
            type: "array",
            minItems: 1,
            maxItems: 6,
            items: {
              type: "object",
              properties: {
                title: { type: "string", description: "Punchy headline (max 100 chars), name the client/deal" },
                reasoning: { type: "string", description: "Why this matters now (max 180 chars)" },
                recommended_action: { type: "string", description: "Concrete next step (max 80 chars)" },
                severity: { type: "string", enum: ["info", "warning", "critical"] },
                category: {
                  type: "string",
                  enum: ["follow_up", "pricing", "churn", "lead", "retainer", "opportunity", "habit"],
                },
              },
              required: ["title", "reasoning", "recommended_action", "severity", "category"],
            },
          },
        },
        required: ["actions"],
      },
    });

    await saveInsight({
      userId,
      entityType: "dashboard",
      entityId: null,
      kind: "coach_feed",
      severity: "info",
      summary: `${feed.actions.length} actions ready`,
      details: feed,
    });

    // 2. Weekly briefing — only regenerate if last one is >7 days old (handled by client TTL).
    const briefing = await callAITool({
      model: "google/gemini-2.5-pro",
      system:
        "You are an executive briefing writer. Produce a short weekly summary for a solo founder. 3 sentences max for the headline summary. Be specific and use numbers from the data. Never invent meetings, clients, or events that are not present in the data. If the account is nearly empty, say so honestly and suggest a starting action.",
      user: summary,
      toolName: "build_briefing",
      toolDescription: "Weekly executive briefing.",
      parameters: {
        type: "object",
        properties: {
          headline: { type: "string", description: "One-line state of the business (max 120 chars)" },
          wins: {
            type: "array",
            items: { type: "string" },
            description: "1-3 concrete wins this period",
          },
          worries: {
            type: "array",
            items: { type: "string" },
            description: "1-3 concrete things to worry about",
          },
          one_thing: {
            type: "string",
            description: "The single most important thing to do this week (max 160 chars)",
          },
        },
        required: ["headline", "wins", "worries", "one_thing"],
      },
    });

    await saveInsight({
      userId,
      entityType: "dashboard",
      entityId: null,
      kind: "weekly_briefing",
      severity: "info",
      summary: briefing.headline,
      details: briefing,
      recommendedAction: briefing.one_thing,
    });

    return jsonResponse({ ok: true, actions: feed.actions.length });
  } catch (e) {
    return handleError(e);
  }
});
