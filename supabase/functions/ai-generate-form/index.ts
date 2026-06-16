import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SYSTEM = `You design web forms. Output ONLY JSON matching this exact shape:
{
  "fields": [
    {
      "id": "string (snake_case)",
      "label": "string (question or field label, plain English)",
      "type": "short_text|long_text|url|email|phone|number|date|select|radio|multi_select|checkbox",
      "placeholder": "string (optional)",
      "helpText": "string (optional, short hint)",
      "required": boolean,
      "options": ["..."],
      "group": "string (section header)"
    }
  ]
}
Rules:
- 4 to 12 fields max. Concise, professional labels.
- Use \`select\` or \`radio\` when listing fixed choices; include the \`options\` array.
- Group related fields under the same \`group\` (e.g. "Contact", "Project", "Budget").
- For lead-capture context, include name + email at minimum.
- For onboarding context, skip name/email (already known) and focus on project details.
- Never invent fields the user did not ask for. Stay tight.
- DO NOT wrap your answer in markdown or commentary. Return raw JSON only.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const prompt = String(body?.prompt || "").trim();
    const context = body?.context === "lead" ? "lead" : "onboarding";
    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userPrompt = `Context: ${context === "lead" ? "Public lead-capture form on a marketing website." : "Client onboarding form sent after they pay an invoice."}

User description:
${prompt}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (res.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `AI gateway error: ${text}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    let parsed: any;
    try { parsed = JSON.parse(content); } catch { parsed = { fields: [] }; }
    const fields = Array.isArray(parsed?.fields) ? parsed.fields : [];

    return new Response(JSON.stringify({ fields }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
