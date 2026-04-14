import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_name, company_name, service_type, project_scope, budget, timeline, notes } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an elite business proposal writer for agencies and consultants. You produce polished, client-ready proposals that read as if crafted by a top-tier agency strategist.

VOICE & TONE RULES:
- Professional, confident, and direct — never robotic or generic
- Client-focused: frame everything around the client's goals, challenges, and outcomes
- Concise: short paragraphs (2-3 sentences max), no filler or waffle
- British English, £ for currency
- CRITICAL: Never repeat the same phrases across proposals. Vary your vocabulary, sentence structure, and opening lines every time. Use synonyms, rephrase ideas, and approach each section from a fresh angle. Imagine you are writing for the 100th time — it must still feel original.
- Never use clichés like "It is a pleasure", "We are delighted", "In today's fast-paced world", "look no further", "cutting-edge", "synergy", "leverage" (as a verb), "utilize"
- Lead with outcomes and results, not process descriptions`;

    const userPrompt = `Write a professional, client-ready proposal for this project. Make it specific, practical, and compelling.

CLIENT DETAILS:
- Client: ${client_name}
- Company: ${company_name}
- Service: ${service_type}
- Scope: ${project_scope}
- Budget: ${budget}
- Timeline: ${timeline}
${notes ? `- Additional context: ${notes}` : ""}

Return valid JSON with exactly three keys: "proposal", "pricing", "invoice".

"proposal" must be a Markdown document with these sections IN THIS EXACT ORDER. Every section is mandatory:

## Project Proposal
A one-line subtitle with the client name and company.

## Introduction
Open with a strong, outcome-focused statement specific to this project. State what you will deliver and why it matters to the client. 2-3 sentences maximum. Do NOT use generic greetings.

## Understanding of Your Needs
Demonstrate genuine understanding of the client's situation, challenges, and objectives. Reference their specific industry, market position, or goals. 2-3 short paragraphs. Be specific — never vague.

## Proposed Solution
Describe your recommended strategy clearly. Explain the approach, methodology, and key decisions. Connect every recommendation back to the client's goals. 2-3 focused paragraphs.

## Scope of Work
List every specific deliverable and activity as bullet points. Be concrete — name actual outputs (e.g. "12 branded social media templates" not "content creation"). Group related items logically.

## Timeline
Break the project into clear phases with durations. Use a structured format (Phase 1: Discovery — Week 1-2). Be realistic and specific.

## Expected Outcomes
List 4-6 specific, measurable outcomes the client can expect. Each must be tailored to this project — no generic filler. Frame as tangible results (e.g. "30% increase in engagement within 90 days" not "improved social media presence").

## Why Choose Us
3-4 bullet points. Each one sentence. Cover: relevant expertise, results focus, delivery quality, communication approach. Be confident but not arrogant.

## Next Steps
2-3 sentences explaining how to proceed. Include a clear call to action.

"pricing" — Start with a 2-3 sentence paragraph framing the investment in terms of ROI and long-term value. Then include a Markdown table with columns: Item | Description | Cost. Add subtotal, VAT (20%), and total. Costs must align with the stated budget.

"invoice" — A professional Markdown invoice with:
- Invoice number: INV-2026-001
- Date: today's date
- Bill to: client name and company
- Table of line items with costs
- Subtotal, VAT at 20%, Total
- Payment terms: Due within 14 days

QUALITY CHECKLIST (follow all):
- Every section references the client's specific project, not generic templates
- No repeated phrases or sentence patterns across sections
- Bullet points are concrete and actionable
- Numbers and timelines are realistic for the stated budget
- The proposal reads as ready to send — no placeholder text

Return ONLY the JSON object. No markdown code fences. No extra text.`;

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
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error("AI generation failed");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
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
    console.error("generate-proposal error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
