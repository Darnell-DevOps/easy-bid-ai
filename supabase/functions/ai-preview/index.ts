// AI Preview — generates short sample outputs based on user's AI preferences.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Prefs = {
  default_tone?: string;
  proposal_length?: string;
  proposal_style?: string;
  lead_reply_tone?: string;
  lead_reply_length?: string;
  email_tone?: string;
  email_length?: string;
  business_what_you_do?: string;
  business_services?: string;
  business_target_audience?: string;
  business_ideal_client?: string;
  custom_instructions?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { prefs } = (await req.json()) as { prefs: Prefs };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const business = [
      prefs.business_what_you_do && `What they do: ${prefs.business_what_you_do}`,
      prefs.business_services && `Services: ${prefs.business_services}`,
      prefs.business_target_audience && `Target audience: ${prefs.business_target_audience}`,
      prefs.business_ideal_client && `Ideal client: ${prefs.business_ideal_client}`,
    ].filter(Boolean).join("\n");

    const system =
`You are generating SHORT sample previews to demonstrate the user's AI writing settings.
You MUST follow the tone, length and style settings exactly.
Use the user's business context to make the samples feel personalised.
Do not invent specific client names — use a generic placeholder like "the client".
Return ONLY by calling the tool. Each preview should be 2-4 sentences.`;

    const userMsg =
`User business context:
${business || "(not provided)"}

Default writing tone: ${prefs.default_tone || "professional"}
Proposal style: ${prefs.proposal_style || "professional"} | length: ${prefs.proposal_length || "standard"}
Lead reply tone: ${prefs.lead_reply_tone || "friendly"} | length: ${prefs.lead_reply_length || "standard"}
Email tone: ${prefs.email_tone || "professional"} | length: ${prefs.email_length || "standard"}
Custom instructions: ${prefs.custom_instructions || "(none)"}

Generate 3 short samples that demonstrate these settings:
1. proposal_intro — opening paragraph of a new proposal
2. lead_response — friendly reply to a new lead enquiry
3. follow_up_email — short follow-up email after sending a proposal`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userMsg },
        ],
        tools: [{
          type: "function",
          function: {
            name: "ai_preview",
            description: "Return 3 short preview samples matching the user's AI writing settings.",
            parameters: {
              type: "object",
              properties: {
                proposal_intro: { type: "string", description: "Opening paragraph of a new proposal (2-4 sentences)." },
                lead_response: { type: "string", description: "Friendly reply to a new lead enquiry (2-4 sentences)." },
                follow_up_email: { type: "string", description: "Short follow-up email after sending a proposal (2-4 sentences)." },
              },
              required: ["proposal_intro", "lead_response", "follow_up_email"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "ai_preview" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit reached. Try again in a moment." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("ai-preview gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI generation failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const args = JSON.parse(data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments || "{}");

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-preview error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
