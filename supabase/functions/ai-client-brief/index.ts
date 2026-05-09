// AI Client Brief — "Explain this client" — 4-line snapshot for the user.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { clientId } = await req.json();
    if (!clientId || typeof clientId !== "string") {
      return new Response(JSON.stringify({ error: "clientId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const auth = req.headers.get("Authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = u.user.id;

    const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: client } = await svc.from("clients").select("*").eq("id", clientId).eq("user_id", userId).maybeSingle();
    if (!client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: proposals } = await svc
      .from("proposals")
      .select("id, status, client_paid, amount_cents, currency, budget, created_at, viewed_at, accepted_at, rejected_at, paid_at, client_response_message")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    const { data: bookings } = await svc
      .from("bookings")
      .select("id, scheduled_at, status, meeting_name")
      .eq("client_id", clientId)
      .order("scheduled_at", { ascending: false })
      .limit(5);

    const { data: contracts } = await svc
      .from("contracts")
      .select("id, status, signed_at, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    const totalPaidCents = (proposals || [])
      .filter((p: any) => p.client_paid)
      .reduce((acc: number, p: any) => acc + (p.amount_cents || 0), 0);

    const lastTouchCandidates: Array<{ when: string; what: string }> = [];
    if (client.updated_at) lastTouchCandidates.push({ when: client.updated_at, what: "client record updated" });
    (proposals || []).forEach((p: any) => {
      if (p.viewed_at) lastTouchCandidates.push({ when: p.viewed_at, what: "viewed proposal" });
      if (p.accepted_at) lastTouchCandidates.push({ when: p.accepted_at, what: "accepted proposal" });
      if (p.rejected_at) lastTouchCandidates.push({ when: p.rejected_at, what: "rejected proposal" });
      if (p.paid_at) lastTouchCandidates.push({ when: p.paid_at, what: "paid invoice" });
      if (p.client_response_message) lastTouchCandidates.push({ when: p.created_at, what: "left a response message" });
    });
    (bookings || []).forEach((b: any) => {
      if (b.scheduled_at) lastTouchCandidates.push({ when: b.scheduled_at, what: `booked ${b.meeting_name || "a call"}` });
    });
    (contracts || []).forEach((c: any) => {
      if (c.signed_at) lastTouchCandidates.push({ when: c.signed_at, what: "signed contract" });
    });
    lastTouchCandidates.sort((a, b) => (b.when || "").localeCompare(a.when || ""));
    const lastTouch = lastTouchCandidates[0];

    const summaryInput = {
      name: client.name,
      company: client.company,
      status: client.status,
      lead_quality: client.lead_quality,
      lead_source: client.lead_source,
      service_requested: client.service_requested,
      project_description: client.project_description,
      budget: client.budget,
      timeline: client.timeline,
      goals: client.goals,
      original_lead_message: client.original_lead_message,
      created_at: client.created_at,
      total_paid_cents: totalPaidCents,
      proposals_count: proposals?.length || 0,
      proposals: (proposals || []).slice(0, 5).map((p: any) => ({
        status: p.status,
        paid: p.client_paid,
        amount_cents: p.amount_cents,
        budget: p.budget,
        created_at: p.created_at,
        viewed: !!p.viewed_at,
        client_response_message: p.client_response_message,
      })),
      bookings_count: bookings?.length || 0,
      contracts_signed: (contracts || []).filter((c: any) => c.status === "signed").length,
      last_touch: lastTouch || null,
      now: new Date().toISOString(),
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const system = `You write a 4-line client briefing for the freelancer/agency owner. Be concrete, use numbers/dates from the data. No fluff. No greetings. No restating the name. Return ONLY by calling the tool.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Client data:\n${JSON.stringify(summaryInput, null, 2)}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "client_brief",
            description: "Return a 4-line briefing on this client",
            parameters: {
              type: "object",
              properties: {
                relationship: { type: "string", description: "1 sentence: where this relationship stands right now" },
                lifetime_value: { type: "string", description: "1 sentence: revenue earned + open opportunity if any" },
                last_touch: { type: "string", description: "1 sentence: when they last engaged and how" },
                risk: { type: "string", description: "1 sentence: any risk signal (silence, rejection, churn) or 'No risk signals.'" },
                next_move: { type: "string", description: "1 sentence: the single best next action to take, specific and time-bound" },
              },
              required: ["relationship", "lifetime_value", "last_touch", "risk", "next_move"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "client_brief" } },
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
      console.error("ai-client-brief gateway error:", aiResp.status, t);
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
    console.error("ai-client-brief error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
