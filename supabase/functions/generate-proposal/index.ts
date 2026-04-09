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

    const systemPrompt = `You are an expert business proposal writer for agencies and consultants. You write polished, client-ready proposals that are professional, confident, and clear. Use British English and £ for currency. Keep content concise — avoid long blocks of text. Use short paragraphs and clear structure.`;

    const userPrompt = `Generate a professional, client-ready proposal for the following lead:

Client: ${client_name}
Company: ${company_name}
Service: ${service_type}
Scope: ${project_scope}
Budget: ${budget}
Timeline: ${timeline}
${notes ? `Additional notes: ${notes}` : ""}

Return your response as valid JSON with exactly these three keys:

1. "proposal" — A structured proposal document using Markdown formatting with clear section headings (##). Include these sections in order:
   ## Project Proposal
   A one-line subtitle with client name and company.

   ## Introduction
   A brief, warm opening (2-3 sentences) introducing who you are and the purpose of this proposal.

   ## Understanding of Your Needs
   Show you understand the client's situation and goals (2-3 short paragraphs max).

   ## Proposed Solution
   Describe your recommended approach clearly and confidently (2-3 short paragraphs).

   ## Scope of Work
   List the specific deliverables and activities using bullet points.

   ## Timeline
   A clear breakdown of phases or milestones.

   ## Next Steps
   2-3 sentences on how to proceed (e.g. sign-off, kick-off call).

2. "pricing" — A clear pricing breakdown in Markdown. Use a table with columns: Item, Description, Cost. Include a subtotal, VAT (20%), and total. Keep it clean and professional.

3. "invoice" — A professional invoice in Markdown. Include:
   - Invoice number (format: INV-2026-001)
   - Date (today)
   - Bill to: client name and company
   - A table of line items with costs
   - Subtotal, VAT at 20%, and Total
   - Payment terms: "Due within 14 days"

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
