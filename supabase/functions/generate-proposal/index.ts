import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  calculateCommercialTotals,
  currencySymbolFor,
  formatCents,
  CURRENCY_SYMBOLS,
  paymentTermsPhrase,
  type TaxMode,
} from "../_shared/commercial-calc.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Plan proposal-per-month limits. MUST be kept in sync with src/lib/plans.ts
// (free=2, starter=10, pro=unlimited) until plan limits are unified in one place.
const PLAN_MONTHLY_PROPOSAL_LIMIT: Record<string, number | "unlimited"> = {
  free: 2,
  starter: 10,
  pro: "unlimited",
};

async function enforcePlanLimit(req: Request, payload: any): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: userData } = await supabase.auth.getUser(token);
  const user = userData?.user;
  if (!user) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // If this is a regeneration of an existing proposal owned by the caller, skip the limit.
  const proposalId = payload?.proposal_id;
  if (proposalId && typeof proposalId === "string") {
    const { data: existing } = await supabase
      .from("proposals").select("user_id").eq("id", proposalId).maybeSingle();
    if (existing && existing.user_id === user.id) return null;
  }

  const { data: sub } = await supabase
    .from("subscriptions").select("plan").eq("user_id", user.id).maybeSingle();
  const plan = (sub?.plan as string) ?? "pro";
  const limit = PLAN_MONTHLY_PROPOSAL_LIMIT[plan] ?? "unlimited";
  if (limit === "unlimited") return null;

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("proposals")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", monthStart.toISOString());
  if ((count ?? 0) >= (limit as number)) {
    return new Response(JSON.stringify({
      error: `You've reached your ${plan} plan limit of ${limit} proposals this month. Upgrade to keep generating.`,
    }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
  return null;
}


const SECTION_HEADINGS = [
  "What You'll Get",
  "Introduction",
  "Your Current Challenge",
  "How We'll Solve This",
  "Scope of Work",
  "Deliverables",
  "Timeline",
  "Expected Outcomes",
  "Investment",
  "Why Choose Us",
  "Next Steps",
];

const toneInstruction = (tone?: string) => {
  switch ((tone || "").toLowerCase()) {
    case "concise":
      return "TONE OVERRIDE: Make this version noticeably MORE CONCISE. Trim filler. Use shorter sentences and tighter bullets. Cut to the essentials while keeping every section.";
    case "persuasive":
      return "TONE OVERRIDE: Make this version MORE PERSUASIVE and outcome-driven. Lead with bold value statements, emphasise ROI and transformation, and make the client feel the cost of inaction.";
    case "alternative":
      return "TONE OVERRIDE: Produce a clearly DIFFERENT alternative version — fresh angle, new opening, varied structure within sections, different metaphors. Same facts, new voice.";
    default:
      return "";
  }
};

// currencySymbolFor / CURRENCY_SYMBOLS are imported from ../_shared/commercial-calc.ts —
// single source of truth shared with the frontend (src/lib/commercial-calc.ts).

function currencyCodeFor(code?: string | null): string {
  const c = (code || "").toString().toUpperCase().trim();
  return c && CURRENCY_SYMBOLS[c] ? c : "GBP";
}

// Build the actual CloseSync onboarding journey steps. Flag-driven so per-section
// regeneration can call the same helper and produce identical bullets.
function buildNextSteps(p: any): string[] {
  const isRetainer = /retainer/i.test(p?.service_type || "");
  if (isRetainer) {
    return [
      "Accept this proposal",
      "Review and sign the retainer agreement",
      "Start your subscription",
      "Complete onboarding",
      "Ongoing service begins",
    ];
  }
  return [
    "Accept this proposal",
    "Review and sign your agreement",
    "Complete payment",
    "Complete onboarding",
    "Project begins",
  ];
}

// Derive exact commercial figures once, deterministically, from amount_cents +
// tax_rate + tax_mode. Any subtotal_cents/tax_amount_cents/total_cents that the
// caller happens to send are intentionally ignored — one calculation site only.
function deriveExactCommercials(p: any):
  | { subtotalCents: number; taxAmountCents: number; totalCents: number; taxRatePercent: number; taxMode: TaxMode; hasTax: boolean }
  | null {
  const amountCents = typeof p?.amount_cents === "number" ? p.amount_cents : NaN;
  if (!Number.isFinite(amountCents) || amountCents <= 0) return null;
  const taxRatePercent = typeof p?.tax_rate === "number" ? p.tax_rate : parseFloat(p?.tax_rate);
  const taxMode: TaxMode = (p?.tax_mode ?? null) as TaxMode;
  const totals = calculateCommercialTotals(amountCents, Number.isFinite(taxRatePercent) ? taxRatePercent : null, taxMode);
  const hasTax =
    (taxMode === "exclusive" || taxMode === "inclusive") &&
    Number.isFinite(taxRatePercent) &&
    (taxRatePercent as number) > 0;
  return { ...totals, taxRatePercent: Number.isFinite(taxRatePercent) ? (taxRatePercent as number) : 0, taxMode, hasTax };
}

// Mirrors PAYMENT_TERMS in src/components/settings/BusinessInformationSettings.tsx
function paymentTermsPhrase(code?: string | null, dueDays?: number | null): string | null {
  const raw = (code || "").toString().trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  const netMatch = key.match(/^net[_\s-]?(\d+)$/);
  if (netMatch) {
    const days = dueDays && dueDays > 0 ? dueDays : parseInt(netMatch[1], 10);
    return `Payment due within ${days} days of invoice.`;
  }
  if (key === "due_immediately" || key === "immediate" || key === "on_receipt") {
    return "Payment due immediately upon receipt of invoice.";
  }
  // If the stored value is already a human-readable phrase (e.g. legacy "50% deposit, 50% on completion"), pass it through.
  if (raw.length > 3 && /\s/.test(raw)) return raw.endsWith(".") ? raw : `${raw}.`;
  return null;
}

function buildClientContext(p: any) {

  const lines = [
    `- Client: ${p.client_name}`,
    `- Company: ${p.company_name}`,
    `- Service: ${p.service_type}`,
    `- Scope: ${p.project_scope}`,
    `- Budget: ${p.budget}`,
    `- Timeline: ${p.timeline}`,
  ];
  if (p.goals) lines.push(`- Client goals/desired outcomes: ${p.goals}`);
  if (p.deliverables) lines.push(`- Confirmed deliverables: ${p.deliverables}`);
  if (p.original_lead_message) lines.push(`- Original lead enquiry: ${p.original_lead_message}`);
  if (p.recent_thread) lines.push(`- Later clarification from client: ${p.recent_thread}`);
  if (p.notes) lines.push(`- Additional context: ${p.notes}`);
  return lines.join("\n");
}


function buildSystemPrompt() {
  return `You are an elite business proposal writer for agencies and consultants. You produce polished, client-ready proposals that read as if crafted by a top-tier agency strategist.

VOICE & TONE RULES:
- Professional, confident, and direct — never robotic or generic
- Client-focused: frame everything around the client's goals, challenges, and outcomes
- Concise: short paragraphs (2-3 sentences max), no filler or waffle
- British English spelling and phrasing
- CRITICAL: Never repeat the same phrases across proposals. Vary vocabulary, sentence structure, and opening lines every time.
- Never use clichés like "It is a pleasure", "We are delighted", "In today's fast-paced world", "look no further", "cutting-edge", "synergy", "leverage" (as a verb), "utilize"
- Lead with outcomes and results, not process descriptions

TRUTHFULNESS RULES (apply to the entire document — every section):
- NEVER invent specific percentage improvements, ROI figures, conversion uplifts, revenue numbers, or any quantified guarantees that were not provided in the client details.
- NEVER fabricate case studies, testimonials, past client names, past client results, awards, certifications, years of experience, team size, or delivery/turnaround guarantees.
- You may describe intended outcomes, goals, process, and success criteria that could be measured — framed as things the client and business would agree on, NOT as promised numbers.
- If a fact is not supplied in the client details, do not confidently assert it. Prefer neutral, honest framing over impressive-sounding fabrication.`;
}

function buildFullPrompt(p: any) {
  const tone = toneInstruction(p.tone);
  const currency = currencyCodeFor(p.currency);
  const symbol = currencySymbolFor(currency);
  const paymentPhrase = paymentTermsPhrase(p.payment_terms, p.invoice_due_days);

  // Authoritative commercial figures — derived once from amount_cents/tax_rate/tax_mode.
  // If amount_cents is missing (legacy regeneration path), we degrade to the older
  // soft "align with the stated budget" wording.
  const exact = deriveExactCommercials(p);
  const hasTax = exact ? exact.hasTax : (Number.isFinite(parseFloat(p.tax_rate)) && parseFloat(p.tax_rate) > 0);
  const taxRate = exact ? exact.taxRatePercent : parseFloat(p.tax_rate);

  const commercialBlock = exact
    ? `COMMERCIAL PARAMETERS (exact figures — display these precisely, do not recalculate or alter them):
- Currency: ${currency} (use the symbol "${symbol}" for every price shown anywhere in the proposal, pricing table, and invoice — never mix symbols).
- Subtotal: ${formatCents(exact.subtotalCents, currency)}
- Tax mode: ${exact.taxMode ?? "none"}${exact.hasTax ? `
- Tax rate: ${exact.taxRatePercent}%
- Tax amount: ${formatCents(exact.taxAmountCents, currency)}` : ""}
- Total payable: ${formatCents(exact.totalCents, currency)}
- Payment terms phrasing: ${paymentPhrase ?? "not specified — use neutral 'Payment terms as agreed'"}.`
    : `COMMERCIAL PARAMETERS (use these EXACTLY — do not substitute your own defaults):
- Currency: ${currency} (use the symbol "${symbol}" for every price shown anywhere in the proposal, pricing table, and invoice — never mix symbols).
- Tax: ${hasTax ? `${taxRate}% applied to subtotal` : "no tax applies"}.
- Payment terms phrasing: ${paymentPhrase ?? "not specified — use neutral 'Payment terms as agreed'"}.`;

  const taxInvestmentInstruction = exact
    ? exact.hasTax
      ? `In the pricing table and invoice, use EXACTLY ${formatCents(exact.subtotalCents, currency)} as the Subtotal row, ${formatCents(exact.taxAmountCents, currency)} as the Tax row (labeled "Tax (${exact.taxRatePercent}%)" — do NOT call it "VAT" unless the client details explicitly reference VAT), and ${formatCents(exact.totalCents, currency)} as the Total row. Do not compute your own split or alter these numbers.`
      : `Do NOT include any tax row anywhere. Use EXACTLY ${formatCents(exact.totalCents, currency)} as both the Subtotal and Total. Do not invent a tax rate.`
    : hasTax
      ? `A tax row must be included in the pricing table and invoice, labeled "Tax (${taxRate}%)", applied to the subtotal. Do NOT call it "VAT" unless the client details explicitly reference VAT.`
      : `Do NOT include any tax row anywhere. The subtotal equals the total. Do not invent a tax rate.`;

  const paymentTermsInstruction = paymentPhrase
    ? `**Payment terms:** ${paymentPhrase}`
    : `**Payment terms:** Payment terms as agreed.`;

  const investmentPriceLine = exact
    ? `**${formatCents(exact.totalCents, currency)}** (use this exact figure as the headline total)`
    : `**[Total price using the "${symbol}" symbol and comma formatting]**`;

  const investmentAlignLine = exact
    ? `Use exactly ${formatCents(exact.totalCents, currency)} as the total shown here — do not alter or round it.`
    : `The total must align with the stated budget.`;

  const investmentTaxNote = exact
    ? exact.hasTax
      ? `Tax note: ${formatCents(exact.taxAmountCents, currency)} tax (${exact.taxRatePercent}%, ${exact.taxMode}) is already reflected in the pricing table and invoice.`
      : ""
    : hasTax
      ? `Tax note: a ${taxRate}% tax applies on top of the subtotal (already reflected in the pricing table and invoice).`
      : "";

  const invoiceLineItemsInstruction = exact
    ? `- Subtotal row showing EXACTLY ${formatCents(exact.subtotalCents, currency)}${exact.hasTax ? `, then a Tax (${exact.taxRatePercent}%) row showing EXACTLY ${formatCents(exact.taxAmountCents, currency)}` : ""}, then a Total row showing EXACTLY ${formatCents(exact.totalCents, currency)}`
    : `- Subtotal${hasTax ? `, Tax (${taxRate}%)` : ""}, Total`;

  const qualityChecklistTax = exact
    ? exact.hasTax
      ? `Tax row present at ${exact.taxRatePercent}% showing exactly ${formatCents(exact.taxAmountCents, currency)}`
      : "No tax row anywhere (tax was not configured)"
    : hasTax
      ? `Tax row present at ${taxRate}%`
      : "No tax row anywhere (tax was not configured)";

  const nextSteps = buildNextSteps(p);
  const nextStepsInstruction = `## Next Steps
Use exactly these ${nextSteps.length} bullets in this order — this reflects the real client onboarding journey and must not be shortened or reworded to imply work begins immediately upon payment:
${nextSteps.map((s) => `- ${s}`).join("\n")}`;

  return `Write a professional, client-ready proposal for this project. Make it specific, practical, and compelling.

CLIENT DETAILS:
${buildClientContext(p)}

${commercialBlock}

${tone ? tone + "\n\n" : ""}Return valid JSON with exactly three keys: "proposal", "pricing", "invoice".

"proposal" must be a Markdown document with these sections IN THIS EXACT ORDER. Every section is mandatory and uses "## " heading. DO NOT include a "Project Proposal" or generic title section — the page already shows a hero.

## What You'll Get
A bullet list of 3-4 short, outcome-driven statements describing what the client will walk away with. Each bullet starts with a strong verb or tangible result (e.g. "A conversion-optimised website that turns visitors into leads"). Keep each bullet to one line.

## Introduction
2-3 lines maximum. Direct and outcome-focused. State the goal of this engagement and the result the client can expect. No greetings, no filler.

## Your Current Challenge
A bullet list of 3-5 specific pain points, problems, or missed opportunities the client is facing. Reference details from their goals or original enquiry where available. Each bullet is one short sentence — concrete and recognisable.

## How We'll Solve This
A bullet list of 3-5 short bullet points describing your approach. Each bullet starts with an action verb (e.g. "Audit your current funnel to find drop-off points"). No long paragraphs.

## Scope of Work
A clean bullet list of every specific deliverable and activity. Be concrete — name actual outputs (e.g. "12 branded social media templates" not "content creation"). Group related items logically. No prose explanation between bullets.

## Deliverables
A bullet list of the final tangible assets the client will receive. Different from Scope of Work — these are the artefacts handed over (files, accounts, reports, designs, code, training). One line each, no extra explanation.

## Timeline
Break the project into clear phases with durations. Use bold phase names with hyphenated descriptions (e.g. **Phase 1: Discovery** — Week 1-2: Stakeholder interviews and audit). Be realistic and specific to the stated timeline.

## Expected Outcomes
List 4-6 specific outcomes the engagement is aimed at achieving, as bullets, each tailored to this client's stated goals. Describe intended outcomes and success criteria the client and business would agree on — NOT confident numeric guarantees. Frame as agreed measurable signals rather than promised percentages (e.g. "Success can be measured through agreed metrics such as qualified leads generated, engagement rate, and time saved"). Do not invent specific percentages, ROI figures, or timeframes that were not supplied in the client details.

## Investment
Format EXACTLY as follows:

${investmentPriceLine}

A 1-2 sentence description of what's included at this price, framed in terms of value the client gets — no fabricated ROI numbers.

${paymentTermsInstruction}

${investmentTaxNote}

${investmentAlignLine}

## Why Choose Us
3-4 bullet points. Each one short sentence. Frame this section around genuine working principles the business commits to — for example: clear communication, defined deliverables, transparent milestones, collaborative process, and focused project management. Do NOT invent expertise, years in business, past client results, awards, or testimonials unless the client details explicitly provide verified business proof — in which case you may reference that specifically.

${nextStepsInstruction}

"pricing" — A Markdown table with columns: Item | Description | Cost. All costs must use the "${symbol}" symbol. ${taxInvestmentInstruction} No prose before or after the table.

"invoice" — A professional Markdown invoice with:
- Invoice number: Draft — to be assigned (this is a proposal preview only, not a live invoice; do NOT invent a specific invoice number like "INV-2026-001")
- Date: today's date
- Bill to: client name and company
- Table of line items with costs using the "${symbol}" symbol (consistent with the pricing breakdown)
${invoiceLineItemsInstruction}
- Payment terms: ${paymentPhrase ?? "As agreed"}

QUALITY CHECKLIST:
- Every section references this client's specific project, never generic templates
- No repeated phrases or sentence patterns across sections
- Bullet points are concrete, scannable, and actionable
- Numbers and timelines are realistic for the stated budget
- Every price uses the "${symbol}" symbol consistently — no mixed currency symbols anywhere
- ${qualityChecklistTax}
- No fabricated statistics, testimonials, case studies, or guarantees
- Reads as ready to send — no placeholder text
- DO NOT add a top-level title or "Project Proposal" heading

Return ONLY the JSON object. No markdown code fences. No extra text.`;
}

function extractSection(fullMarkdown: string, sectionTitle: string): string {
  if (!fullMarkdown) return "";
  const escaped = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`##\\s+${escaped}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "i");
  const m = fullMarkdown.match(re);
  return m ? m[0].trim() : "";
}

function buildSectionPrompt(p: any, section: string) {
  const tone = toneInstruction(p.tone);
  const currentSectionText = extractSection(p.existing_proposal || "", section);
  const previousBlock = currentSectionText
    ? `PREVIOUS VERSION OF THIS SECTION (this is a regeneration request — produce a genuinely different take: new opening line, different structure or ordering of points, different specific phrasing and word choice — do not restate this almost verbatim, but keep it factually consistent with the client details):\n${currentSectionText}\n\n`
    : "";
  const currency = currencyCodeFor(p.currency);
  const symbol = currencySymbolFor(currency);
  const exact = deriveExactCommercials(p);
  const hasTax = exact ? exact.hasTax : (Number.isFinite(parseFloat(p.tax_rate)) && parseFloat(p.tax_rate) > 0);
  const taxRate = exact ? exact.taxRatePercent : parseFloat(p.tax_rate);
  const paymentPhrase = paymentTermsPhrase(p.payment_terms, p.invoice_due_days);

  // Deterministic Next Steps — regenerating this section must produce the exact
  // same journey bullets, not an improvised alternative.
  if (section === "Next Steps") {
    const steps = buildNextSteps(p);
    return `Rewrite the "Next Steps" section of the proposal. You MUST output EXACTLY the following ${steps.length} bullets, in this order, with no additions, removals, rewording, or reordering — this reflects the real CloseSync client onboarding journey:
${steps.map((s) => `- ${s}`).join("\n")}

${tone ? tone + "\n\n" : ""}Return valid JSON with a single key "section" whose value is Markdown starting with "## Next Steps" as the heading, followed by exactly those bullets. No code fences. No commentary.`;
  }

  const commercialBlock = exact
    ? `COMMERCIAL PARAMETERS (exact figures — must remain consistent with the rest of the proposal; display precisely, do not recalculate):
- Currency: ${currency} — use the "${symbol}" symbol for any price shown.
- Subtotal: ${formatCents(exact.subtotalCents, currency)}
- Tax mode: ${exact.taxMode ?? "none"}${exact.hasTax ? `
- Tax rate: ${exact.taxRatePercent}%
- Tax amount: ${formatCents(exact.taxAmountCents, currency)}` : ""}
- Total payable: ${formatCents(exact.totalCents, currency)}
- Payment terms: ${paymentPhrase ?? "not specified — use neutral 'Payment terms as agreed'"}.`
    : `COMMERCIAL PARAMETERS (must remain consistent with the rest of the proposal):
- Currency: ${currency} — use the "${symbol}" symbol for any price shown.
- Tax: ${hasTax ? `${taxRate}% applied to subtotal` : "no tax applies"}.
- Payment terms: ${paymentPhrase ?? "not specified — use neutral 'Payment terms as agreed'"}.`;

  return `Rewrite ONLY the "${section}" section of a proposal for this project. Keep it consistent with the rest of the proposal.

CLIENT DETAILS:
${buildClientContext(p)}

${commercialBlock}

TRUTHFULNESS: Do not invent specific percentages, ROI figures, testimonials, awards, years of experience, or delivery guarantees not provided in the client details.

${previousBlock}EXISTING PROPOSAL CONTEXT (for reference — do NOT rewrite anything other than the "${section}" section):
${(p.existing_proposal || "").slice(0, 4000)}

${tone ? tone + "\n\n" : ""}Return valid JSON with a single key "section" whose value is the new Markdown for the "${section}" section, starting with "## ${section}" as the heading. No other sections. No code fences. No commentary.`;
}


async function callAI(systemPrompt: string, userPrompt: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      temperature: 0.9,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],

    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      throw new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const text = await response.text();
    console.error("AI gateway error:", response.status, text);
    throw new Error("AI generation failed");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

function parseJSON(content: string) {
  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  return JSON.parse(cleaned);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();
    const { section } = payload;

    // Section-only regeneration
    if (section && typeof section === "string") {
      if (!SECTION_HEADINGS.includes(section)) {
        return new Response(JSON.stringify({ error: `Unknown section: ${section}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const content = await callAI(buildSystemPrompt(), buildSectionPrompt(payload, section));
      try {
        const parsed = parseJSON(content);
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        return new Response(JSON.stringify({ section: content.trim() }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Full proposal generation (preserves original API contract)
    const limitResponse = await enforcePlanLimit(req, payload);
    if (limitResponse) return limitResponse;

    const content = await callAI(buildSystemPrompt(), buildFullPrompt(payload));

    let parsed;
    try {
      parsed = parseJSON(content);
    } catch {
      parsed = {
        proposal: content,
        pricing: "Pricing breakdown not available. Please edit manually.",
        invoice: "Invoice not available. Please edit manually.",
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("generate-proposal error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
