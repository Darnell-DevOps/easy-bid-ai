import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      business_name,
      business_type,
      country,
      policy_type,
      services_offered,
      payment_methods,
      refund_rules,
      data_collection,
      special_requirements,
    } = await req.json();

    if (!business_name || !business_type || !country || !policy_type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a professional business policy writer. Generate clear, well-structured ${policy_type} documents tailored to the business's country and industry. Use formal but readable language. Format with markdown: use ## for major section headings and ### for sub-sections, numbered clauses where appropriate, and short paragraphs. Do NOT include a legal disclaimer at the top — the app adds one separately. Do NOT wrap output in code fences.`;

    const userPrompt = `Generate a complete ${policy_type} for the following business:

- Business Name: ${business_name}
- Business Type: ${business_type}
- Country / Jurisdiction: ${country}
- Services Offered: ${services_offered || "Not specified"}
- Payment Methods: ${payment_methods || "Not specified"}
- Refund Rules: ${refund_rules || "Not specified"}
- Data Collected: ${data_collection || "Not specified"}
- Special Requirements: ${special_requirements || "None"}

Tailor terminology, required clauses, and references to relevant frameworks based on the country (e.g. GDPR for EU/UK, CCPA for California, PIPEDA for Canada, etc.) where applicable. Output the policy directly in markdown.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-policy error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
