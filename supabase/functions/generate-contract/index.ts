import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { formatCents, paymentTermsPhrase } from "../_shared/commercial-calc.ts";

function buildFeesBlock(payload: any): { promptLines: string[]; templateLines: string[] } {
  const total = typeof payload.total_cents === "number" ? payload.total_cents : null;
  const subtotal = typeof payload.subtotal_cents === "number" ? payload.subtotal_cents : null;
  const taxAmount = typeof payload.tax_amount_cents === "number" ? payload.tax_amount_cents : 0;
  const taxRate = typeof payload.tax_rate === "number" ? payload.tax_rate : null;
  const currency = payload.currency || "USD";
  const phrase = paymentTermsPhrase(payload.payment_terms, payload.invoice_due_days);

  const promptLines: string[] = [];
  const templateLines: string[] = [];

  if (total && total > 0) {
    const hasTax = taxAmount && taxAmount > 0 && subtotal !== null;
    const subLine = hasTax ? `- Subtotal: ${formatCents(subtotal as number, currency)}` : null;
    const taxLabel = hasTax
      ? `- Tax${taxRate ? ` (${taxRate}%)` : ""}: ${formatCents(taxAmount, currency)}`
      : null;
    const totalLine = `- Total: ${formatCents(total, currency)}`;

    if (subLine) { promptLines.push(subLine); templateLines.push(subLine); }
    if (taxLabel) { promptLines.push(taxLabel); templateLines.push(taxLabel); }
    promptLines.push(totalLine);
    templateLines.push(totalLine);

    promptLines.push(
      `- Include the Subtotal (if listed), Tax (if listed) and Total lines above VERBATIM in the "## 5. Fees & Payment Terms" section. Do not recalculate, adjust, or add commentary that changes these numbers.`
    );
  } else {
    // Backward-compatible fallback path — behave as before.
    const legacy = `- Total Fee: ${payload.budget || ""}`;
    promptLines.push(legacy);
    templateLines.push(`- Total Fee: ${payload.budget || "[Total Fee]"}`);
  }

  const paymentLine = `- Payment Terms: ${phrase || "Payment terms are as agreed between the parties."}`;
  promptLines.push(paymentLine);
  templateLines.push(paymentLine);

  return { promptLines, templateLines };
}


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CONTRACT_TYPES: Record<string, { title: string; intro: string }> = {
  service_agreement: {
    title: "Service Agreement",
    intro: "This Service Agreement governs the professional services to be provided by the Service Provider to the Client.",
  },
  project_agreement: {
    title: "Project Agreement",
    intro: "This Project Agreement defines the scope, deliverables and terms for a defined project engagement.",
  },
  retainer_agreement: {
    title: "Retainer Agreement",
    intro: "This Retainer Agreement establishes ongoing services provided by the Service Provider on a recurring basis.",
  },
  web_design_agreement: {
    title: "Web Design Agreement",
    intro: "This Web Design Agreement governs the design, development and launch of the Client's website by the Service Provider.",
  },
  marketing_agreement: {
    title: "Marketing Services Agreement",
    intro: "This Marketing Services Agreement sets out the marketing activities the Service Provider will deliver for the Client and the related performance commitments.",
  },
  consulting_agreement: {
    title: "Consulting Agreement",
    intro: "This Consulting Agreement governs the strategic advisory services the Service Provider will provide to the Client.",
  },
  maintenance_agreement: {
    title: "Maintenance & Support Agreement",
    intro: "This Maintenance & Support Agreement defines the ongoing support, monitoring and maintenance services provided to the Client.",
  },
  social_media_agreement: {
    title: "Social Media Management Agreement",
    intro: "This Social Media Management Agreement governs the planning, content creation, scheduling, community management and reporting of the Client's social media channels.",
  },
  freelancer_agreement: {
    title: "Freelancer Agreement",
    intro: "This Freelancer Agreement governs the freelance services provided by the Service Provider to the Client as an independent contractor.",
  },
  discovery_agreement: {
    title: "Discovery Agreement",
    intro: "This Discovery Agreement covers a paid discovery phase that produces a written recommendation and roadmap for a potential follow-on engagement.",
  },
  nda: {
    title: "Mutual Non-Disclosure Agreement",
    intro: "This Agreement protects confidential information shared between both parties.",
  },
  scope_of_work: {
    title: "Scope of Work Agreement",
    intro: "This Scope of Work defines the specific deliverables, timeline, and acceptance criteria for the engagement.",
  },
};

function buildSystemPrompt() {
  return `You are an experienced contracts specialist who drafts clear, professional, plain-language client agreements for freelancers and agencies. Output is Markdown only — no preamble, no commentary. Use formal but readable language. Use British English. Never invent legal jurisdictions, registered company numbers, or laws not provided. If a field is unknown, use a clearly marked placeholder like [TBD].`;
}

function buildPrompt(payload: any) {
  const type = CONTRACT_TYPES[payload.contract_type] || CONTRACT_TYPES.service_agreement;
  const fees = buildFeesBlock(payload);
  const lines = [
    `Generate a complete ${type.title} as polished Markdown.`,
    "",
    "PARTIES & PROJECT DETAILS:",
    `- Service Provider: ${payload.provider_name || "[Service Provider]"}`,
    `- Client: ${payload.client_name || "[Client]"}`,
    `- Client Company: ${payload.company_name || ""}`,
    `- Project / Service: ${payload.service_type || ""}`,
    `- Scope: ${payload.project_scope || ""}`,
    `- Timeline: ${payload.timeline || ""}`,
    ...fees.promptLines,
    `- Effective Date: ${payload.effective_date || new Date().toISOString().slice(0, 10)}`,
  ];
  if (payload.extra_clauses) {
    lines.push("", "ADDITIONAL CLAUSES (must be incorporated naturally and faithfully into the relevant section):");
    lines.push(payload.extra_clauses);
  }
  if (payload.policies_text) {
    lines.push("", "ATTACHED POLICIES (incorporate naturally as clauses):");
    lines.push(payload.policies_text);
  }
  lines.push(
    "",
    "STRUCTURE (use ## headings, in this order, all required):",
    "## 1. Parties",
    "## 2. Scope of Work",
    "## 3. Deliverables",
    "## 4. Timeline",
    "## 5. Fees & Payment Terms",
    "## 6. Revisions & Acceptance",
    "## 7. Intellectual Property",
    "## 8. Confidentiality",
    "## 9. Termination",
    "## 10. Limitation of Liability",
    "## 11. Governing Law",
    "## 12. Entire Agreement",
    "## 13. Signatures",
    "",
    "Under '## 13. Signatures' write a short closing line that both parties acknowledge and agree to the terms above by signing electronically.",
    "Keep paragraphs short (2-3 sentences). Use bullet lists for deliverables and payment milestones."
  );
  return lines.join("\n");
}

function templateFallback(payload: any): string {
  const type = CONTRACT_TYPES[payload.contract_type] || CONTRACT_TYPES.service_agreement;
  const today = payload.effective_date || new Date().toISOString().slice(0, 10);
  const fees = buildFeesBlock(payload);
  return `# ${type.title}

**Effective Date:** ${today}

${type.intro}

## 1. Parties
This agreement is made between **${payload.provider_name || "[Service Provider]"}** ("Service Provider") and **${payload.client_name || "[Client]"}**${payload.company_name ? ` of ${payload.company_name}` : ""} ("Client").

## 2. Scope of Work
The Service Provider will deliver: ${payload.service_type || "[Service]"}.

${payload.project_scope || "Detailed scope to be agreed in writing."}

## 3. Deliverables
The agreed deliverables form part of this agreement and will be delivered in accordance with the timeline below.

## 4. Timeline
${payload.timeline || "To be agreed."}

## 5. Fees & Payment Terms
${fees.templateLines.join("\n")}

## 6. Revisions & Acceptance
The Client may request reasonable revisions within scope. Material changes outside the agreed scope will be quoted separately.

## 7. Intellectual Property
On full payment, ownership of the final deliverables transfers to the Client. The Service Provider retains the right to display the work in their portfolio.

## 8. Confidentiality
Both parties agree to keep all non-public information shared during this engagement strictly confidential.

## 9. Termination
Either party may terminate with written notice. The Client remains liable for work completed up to the termination date.

## 10. Limitation of Liability
The Service Provider's liability under this agreement is limited to the total fees paid by the Client.

## 11. Governing Law
This agreement is governed by the laws applicable to the Service Provider's place of business.

## 12. Entire Agreement
This document represents the full agreement between the parties and supersedes all prior discussions.

${payload.extra_clauses ? `\n## Additional Clauses\n${payload.extra_clauses}\n` : ""}${payload.policies_text ? `\n## Attached Policies\n${payload.policies_text}\n` : ""}
## 13. Signatures
By signing electronically below, both parties acknowledge they have read, understood, and agree to the terms set out in this agreement.`;
}

async function callAI(payload: any): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: buildSystemPrompt() },
          { role: "user", content: buildPrompt(payload) },
        ],
      }),
    });
    if (res.status === 429 || res.status === 402) {
      const err = await res.text();
      console.warn("AI rate/credits", res.status, err);
      return null;
    }
    if (!res.ok) {
      console.error("AI gateway error", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content as string | undefined;
    return content?.trim() || null;
  } catch (e) {
    console.error("callAI threw", e);
    return null;
  }
}

// Dashboard calls require a real user JWT. Acceptance-triggered generation is
// server-owned and uses the service-role credential; a proposal ID alone no
// longer authorizes an AI generation request.
async function isAuthorized(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("Authorization");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (serviceKey && authHeader === `Bearer ${serviceKey}`) return true;
  if (authHeader) {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (userData?.user) return true;
  }

  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();

    if (!(await isAuthorized(req))) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiContent = await callAI(payload);
    const body = aiContent || templateFallback(payload);
    const usedTemplate = !aiContent;
    const type = CONTRACT_TYPES[payload.contract_type] || CONTRACT_TYPES.service_agreement;

    return new Response(
      JSON.stringify({
        body,
        title: type.title,
        usedTemplate,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-contract error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
