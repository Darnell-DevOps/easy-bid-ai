const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { leadName, leadEmail, message } = await req.json();

    if (!message || typeof message !== "string" || message.trim().length < 5) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const systemPrompt = `You are an elite sales assistant for a freelance/agency professional. Your job is to draft a reply to an incoming lead that:
- Sounds professional, warm, friendly, and conversion-focused
- Acknowledges the lead's request specifically (reference what they said)
- Asks 1-2 smart qualification questions (about budget, timeline, scope, or goals — pick the most relevant ones missing)
- Ends with a clear next step (e.g. quick call, sending a proposal)
- Stays concise (under 180 words)
- Uses the lead's name if provided
- Does NOT use placeholders like [Your Name] — sign off as "Best,\\nThe Team" or omit signature

Also extract any qualification info already mentioned in the lead's message.

Then assess lead quality based on:
- Message clarity (is the request specific?)
- Budget (mentioned and realistic?)
- Urgency / timeline
- Service fit (sounds like a fit for a freelancer/agency?)

Pick exactly one quality: "High", "Medium", or "Low".
Pick exactly one recommendation:
- "High" -> "Recommend generating proposal"
- "Medium" -> "Recommend asking more questions"
- "Low" -> "May not be worth pursuing"

Respond ONLY by calling the provided tool.`;

    const userPrompt = `Lead name: ${leadName || "(not provided)"}
Lead email: ${leadEmail || "(not provided)"}

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
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "draft_lead_reply",
              description: "Draft a reply to the lead and extract qualification details",
              parameters: {
                type: "object",
                properties: {
                  reply: {
                    type: "string",
                    description: "The full email/message reply to the lead",
                  },
                  service_requested: {
                    type: "string",
                    description: "Service the lead is asking about, or empty string if unclear",
                  },
                  budget: {
                    type: "string",
                    description: "Mentioned budget, or empty string",
                  },
                  timeline: {
                    type: "string",
                    description: "Mentioned timeline/deadline, or empty string",
                  },
                  notes: {
                    type: "string",
                    description: "Short summary of key context, goals, or anything notable",
                  },
                  lead_quality: {
                    type: "string",
                    enum: ["High", "Medium", "Low"],
                    description: "Overall lead quality rating",
                  },
                  quality_reason: {
                    type: "string",
                    description: "One short sentence explaining the quality rating",
                  },
                  ai_recommendation: {
                    type: "string",
                    description: "Recommended next action based on lead quality",
                  },
                },
                required: ["reply", "service_requested", "budget", "timeline", "notes", "lead_quality", "quality_reason", "ai_recommendation"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "draft_lead_reply" } },
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit reached. Please try again in a moment." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (response.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }), {
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
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call returned");

    const args = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("lead-response error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
