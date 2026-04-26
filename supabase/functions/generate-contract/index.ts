import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    `- Total Fee: ${payload.budget || ""}`,
    `- Payment Terms: ${payload.payment_terms || "50% deposit, 50% on completion"}`,
    `- Effective Date: ${payload.effective_date || new Date().toISOString().slice(0, 10)}`,
  ];
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
- Total Fee: ${payload.budget || "[Total Fee]"}
- Payment Terms: ${payload.payment_terms || "50% deposit upfront, 50% on completion"}
- Invoices are payable within 7 days of issue unless agreed otherwise.

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

${payload.policies_text ? `\n## Attached Policies\n${payload.policies_text}\n` : ""}
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = await req.json();

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
