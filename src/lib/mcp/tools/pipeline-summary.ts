import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";
import { errorResult, jsonResult, requireUser } from "../helpers";

export default defineTool({
  name: "pipeline_summary",
  title: "Pipeline summary",
  description:
    "Summarise the signed-in user's pipeline: proposal counts by status, accepted and paid value, contracts awaiting signature or countersignature, and onboarding forms still outstanding.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!requireUser(ctx)) return errorResult("Not authenticated.");
    const supabase = supabaseForUser(ctx);

    const [proposals, contracts, onboarding] = await Promise.all([
      supabase
        .from("proposals")
        .select("status, amount_cents, currency, client_paid")
        .is("deleted_at", null),
      supabase.from("contracts").select("status").is("deleted_at", null),
      supabase.from("onboarding_forms").select("status, completed_at, reviewed_at").is("deleted_at", null),
    ]);

    const firstError = proposals.error ?? contracts.error ?? onboarding.error;
    if (firstError) return errorResult(firstError.message);

    const byStatus = (rows: { status: string | null }[] | null) =>
      (rows ?? []).reduce<Record<string, number>>((acc, row) => {
        const key = row.status ?? "unknown";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {});

    const proposalRows = proposals.data ?? [];
    const acceptedValueCents = proposalRows
      .filter((p) => p.status === "accepted")
      .reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);
    const paidValueCents = proposalRows
      .filter((p) => p.client_paid)
      .reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);

    const onboardingRows = onboarding.data ?? [];

    return jsonResult({
      proposals: {
        total: proposalRows.length,
        by_status: byStatus(proposalRows),
        accepted_value_cents: acceptedValueCents,
        paid_value_cents: paidValueCents,
        currency: proposalRows.find((p) => p.currency)?.currency ?? null,
      },
      contracts: {
        total: contracts.data?.length ?? 0,
        by_status: byStatus(contracts.data),
      },
      onboarding: {
        total: onboardingRows.length,
        awaiting_client: onboardingRows.filter((f) => !f.completed_at).length,
        awaiting_review: onboardingRows.filter((f) => f.completed_at && !f.reviewed_at).length,
      },
    });
  },
});
