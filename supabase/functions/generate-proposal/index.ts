import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { client_name, company_name, service_type, project_scope, budget, timeline, notes } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a professional business proposal writer for agencies and consultants. Generate content in three clearly separated sections. Be professional, concise, and persuasive. Use British English and £ for currency.`;

    const userPrompt = `Generate a professional proposal for the following lead:

Client: ${client_name}
Company: ${company_name}
Service: ${service_type}
Scope: ${project_scope}
Budget: ${budget}
Timeline: ${timeline}
${notes ? `Additional notes: ${notes}` : ""}

Return your response as valid JSON with exactly these three keys:
- "proposal": A professional proposal document (plain text with line breaks, include an executive summary, objectives, approach, deliverables, and timeline)
- "pricing": A detailed pricing breakdown (plain text table format showing line items, quantities, unit prices, and totals)
- "invoice": A simple invoice (plain text with invoice number, date, line items, subtotal, VAT at 20%, and total)

Return ONLY the JSON object, no markdown formatting.`;

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

    // Parse the JSON from AI response
    let parsed;
    try {
      // Remove markdown code fences if present
      const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback: use raw content as proposal
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
