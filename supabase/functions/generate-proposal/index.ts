import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SECTION_HEADINGS = [
  "Project Proposal",
  "Introduction",
  "Understanding of Your Needs",
  "Proposed Solution",
  "Scope of Work",
  "Deliverables",
  "Timeline",
  "Expected Outcomes",
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

function buildSystemPrompt() {
  return `You are an elite business proposal writer for agencies and consultants. You produce polished, client-ready proposals that read as if crafted by a top-tier agency strategist.

VOICE & TONE RULES:
- Professional, confident, and direct — never robotic or generic
- Client-focused: frame everything around the client's goals, challenges, and outcomes
- Concise: short paragraphs (2-3 sentences max), no filler or waffle
- British English, £ for currency
- CRITICAL: Never repeat the same phrases across proposals. Vary vocabulary, sentence structure, and opening lines every time.
- Never use clichés like "It is a pleasure", "We are delighted", "In today's fast-paced world", "look no further", "cutting-edge", "synergy", "leverage" (as a verb), "utilize"
- Lead with outcomes and results, not process descriptions`;
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
  if (p.notes) lines.push(`- Additional context: ${p.notes}`);
  return lines.join("\n");
}

function buildFullPrompt(p: any) {
  const tone = toneInstruction(p.tone);
  return `Write a professional, client-ready proposal for this project. Make it specific, practical, and compelling.

CLIENT DETAILS:
${buildClientContext(p)}

${tone ? tone + "\n\n" : ""}Return valid JSON with exactly three keys: "proposal", "pricing", "invoice".

"proposal" must be a Markdown document with these sections IN THIS EXACT ORDER. Every section is mandatory and uses "## " heading:

## Project Proposal
A one-line subtitle with the client name and company.

## Introduction
Open with a strong, outcome-focused statement specific to this project. State what you will deliver and why it matters. 2-3 sentences max. No generic greetings.

## Understanding of Your Needs
Demonstrate genuine understanding of the client's situation, challenges, and objectives. Reference specifics from their goals or original enquiry where available. 2-3 short paragraphs.

## Proposed Solution
Describe your recommended strategy clearly. Explain approach, methodology, and key decisions. Connect every recommendation back to the client's goals. 2-3 focused paragraphs.

## Scope of Work
List every specific deliverable and activity as bullet points. Be concrete — name actual outputs (e.g. "12 branded social media templates" not "content creation"). Group related items logically.

## Deliverables
A clean bullet list of the final tangible assets the client will receive. Different from Scope of Work — these are the artefacts handed over (files, accounts, reports, designs, code, training).

## Timeline
Break the project into clear phases with durations. Use a structured format (Phase 1: Discovery — Week 1-2). Be realistic and specific to the stated timeline.

## Expected Outcomes
List 4-6 specific, measurable outcomes the client can expect. Each tailored to this project — no generic filler. Frame as tangible results (e.g. "30% increase in engagement within 90 days").

## Why Choose Us
3-4 bullet points. Each one sentence. Cover relevant expertise, results focus, delivery quality, communication.

## Next Steps
2-3 sentences explaining how to proceed. Include a clear call to action.

"pricing" — Start with a 2-3 sentence paragraph framing the investment in terms of ROI and long-term value. Then a Markdown table with columns: Item | Description | Cost. Add subtotal, VAT (20%), and total. Costs must align with the stated budget.

"invoice" — A professional Markdown invoice with:
- Invoice number: INV-2026-001
- Date: today's date
- Bill to: client name and company
- Table of line items with costs (consistent with pricing breakdown)
- Subtotal, VAT at 20%, Total
- Payment terms: Due within 14 days

QUALITY CHECKLIST:
- Every section references this client's specific project, never generic templates
- No repeated phrases or sentence patterns across sections
- Bullet points are concrete and actionable
- Numbers and timelines are realistic for the stated budget
- Reads as ready to send — no placeholder text

Return ONLY the JSON object. No markdown code fences. No extra text.`;
}

function buildSectionPrompt(p: any, section: string) {
  const tone = toneInstruction(p.tone);
  return `Rewrite ONLY the "${section}" section of a proposal for this project. Keep it consistent with the rest of the proposal.

CLIENT DETAILS:
${buildClientContext(p)}

EXISTING PROPOSAL CONTEXT (for reference — do NOT rewrite anything other than the "${section}" section):
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
