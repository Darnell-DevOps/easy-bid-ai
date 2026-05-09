// AI Reply Drafter — generates tone-tuned reply drafts for any client message.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Body {
  message: string;
  tone?: "warm" | "firm" | "negotiation";
  context?: {
    clientName?: string;
    senderName?: string;
    scenario?: string; // e.g. "incoming lead", "proposal rejected", "general reply"
    notes?: string;
  };
}

const TONE_GUIDE: Record<string, string> = {
  warm: "Warm, friendly, human. Acknowledge their message, keep it conversational, and end with an inviting next step. No corporate jargon.",
  firm: "Polite but confident and direct. Reaffirm value, defend pricing/scope where relevant, and propose a clear next step. No apology for pricing.",
  negotiation: "Open and collaborative. Acknowledge their concern, offer one concrete option to move forward (compromise on scope, timing, or payment terms), end with a question that invites a yes.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    const tone = body.tone || "warm";
    const message = (body.message || "").trim();
    if (message.length < 3) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const ctx = body.context || {};
    const system = `You draft email replies on behalf of a freelancer/agency owner replying to a client or prospect.
Rules:
- Under 160 words.
- Match the requested tone: ${TONE_GUIDE[tone]}
- Reference something specific from their message so it feels personal.
- End with a single concrete next step (call, sending something, a yes/no question).
- Do NOT use placeholders like [Your Name] — sign off as "${ctx.senderName || "Best,"}" or omit signature.
- Do NOT invent facts (don't promise specific prices, dates, or features unless mentioned).
Return ONLY by calling the tool.`;

    const user = `Tone: ${tone}
Scenario: ${ctx.scenario || "general client reply"}
Client/Prospect: ${ctx.clientName || "(unknown)"}
${ctx.notes ? `Extra notes: ${ctx.notes}` : ""}

Their message:
"""
${message}
"""`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "draft_reply",
              description: "Draft a reply to the client message",
              parameters: {
                type: "object",
                properties: {
                  subject: { type: "string", description: "Short email subject line" },
                  body: { type: "string", description: "Full reply body, 80–160 words" },
                  one_liner: {
                    type: "string",
                    description: "One-sentence summary of the angle taken",
                  },
                },
                required: ["subject", "body", "one_liner"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "draft_reply" } },
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit reached. Try again in a moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const args = JSON.parse(data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments || "{}");
    return new Response(JSON.stringify({ ...args, tone }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-reply-drafter error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
