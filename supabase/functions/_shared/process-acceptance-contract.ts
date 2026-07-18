import {
  calculateCommercialTotals,
  formatCents,
} from "./commercial-calc.ts";

export type AcceptanceContractResult = {
  id: string;
  title: string;
  status: string;
  signing_token: string;
  signed_at: string | null;
  generation_status: string;
};

async function loadPublicContract(admin: any, contractId: string) {
  const { data, error } = await admin
    .from("contracts")
    .select("id, title, status, signing_token, signed_at, generation_status")
    .eq("id", contractId)
    .single();
  if (error) throw error;
  return data as AcceptanceContractResult;
}

export async function processAcceptanceContract(
  admin: any,
  proposalId: string,
  force = false,
): Promise<AcceptanceContractResult | null> {
  const { data: claimRows, error: claimError } = await admin.rpc(
    "claim_acceptance_contract_generation",
    { _proposal_id: proposalId, _force: force },
  );
  if (claimError) throw claimError;

  const claim = Array.isArray(claimRows) ? claimRows[0] : claimRows;
  if (!claim?.contract_id) return null;
  if (!claim.claimed) return loadPublicContract(admin, claim.contract_id);

  const contractId = claim.contract_id as string;
  try {
    const { data: proposal, error: proposalError } = await admin
      .from("proposals")
      .select(
        "id, user_id, client_name, company_name, service_type, project_scope, timeline, budget, amount_cents, currency, tax_rate, tax_mode, payment_terms",
      )
      .eq("id", proposalId)
      .single();
    if (proposalError || !proposal) throw proposalError || new Error("proposal_not_found");

    const { data: branding } = await admin
      .from("business_branding")
      .select("legal_name, trading_name, business_name")
      .eq("user_id", proposal.user_id)
      .maybeSingle();
    const providerName = [branding?.legal_name, branding?.trading_name, branding?.business_name]
      .map((value) => String(value || "").trim())
      .find(Boolean) || null;

    const totals = calculateCommercialTotals(
      proposal.amount_cents ?? 0,
      proposal.tax_rate,
      proposal.tax_mode,
    );
    const contractType = /retainer/i.test(proposal.service_type || "")
      ? "retainer_agreement"
      : "service_agreement";
    const payload = {
      proposal_id: proposal.id,
      contract_type: contractType,
      client_name: proposal.client_name,
      company_name: proposal.company_name,
      provider_name: providerName,
      service_type: proposal.service_type,
      project_scope: proposal.project_scope || "",
      timeline: proposal.timeline || "",
      budget: totals.totalCents > 0
        ? formatCents(totals.totalCents, proposal.currency || "USD")
        : proposal.budget || "",
      payment_terms: proposal.payment_terms || undefined,
      currency: proposal.currency || "USD",
      subtotal_cents: totals.subtotalCents,
      tax_rate: proposal.tax_rate,
      tax_mode: proposal.tax_mode,
      tax_amount_cents: totals.taxAmountCents,
      total_cents: totals.totalCents,
    };

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) throw new Error("generator_not_configured");

    const generatedResponse = await fetch(`${supabaseUrl}/functions/v1/generate-contract`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!generatedResponse.ok) {
      throw new Error(`generator_http_${generatedResponse.status}`);
    }
    const generated = await generatedResponse.json();
    if (!generated?.body) throw new Error("generator_returned_empty_body");

    const { data: autoSend } = await admin.rpc("automation_enabled", {
      _user_id: proposal.user_id,
      _key: "contract_auto_send",
    });
    const completedAt = new Date().toISOString();
    const { data: ready, error: updateError } = await admin
      .from("contracts")
      .update({
        title: generated.title || (contractType === "retainer_agreement" ? "Retainer Agreement" : "Service Agreement"),
        body: generated.body,
        amount_cents: proposal.amount_cents != null ? totals.totalCents : null,
        currency: proposal.currency || "USD",
        status: autoSend ? "sent" : "draft",
        sent_at: autoSend ? completedAt : null,
        sent_source: autoSend ? "automation" : null,
        generation_status: "ready",
        generation_completed_at: completedAt,
        generation_last_error: null,
        generation_next_retry_at: null,
      })
      .eq("id", contractId)
      .select("id, title, status, signing_token, signed_at, generation_status")
      .single();
    if (updateError) throw updateError;
    return ready as AcceptanceContractResult;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown_error";
    console.error("acceptance contract generation failed", { contractId, proposalId, reason });
    const retryAt = new Date(Date.now() + 5 * 60_000).toISOString();
    await admin
      .from("contracts")
      .update({
        generation_status: "failed",
        generation_last_error: reason.slice(0, 500),
        generation_next_retry_at: retryAt,
      })
      .eq("id", contractId);
    return loadPublicContract(admin, contractId);
  }
}
