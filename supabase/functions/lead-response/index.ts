// Authenticated endpoint for the manual AI Sales Assistant (LeadAssistant.tsx).
// Uses the same shared qualification core as the automatic form/email pipelines
// so manually-entered leads get identical intelligence.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  normalizeFitFactors,
  normalizeFitScore,
  normalizeMissingInfo,
  runQualification,
} from "../_shared/qualify-core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = claims.claims.sub;

    const { leadName, leadEmail, message } = await req.json();
    if (!message || typeof message !== "string" || message.trim().length < 5) {
      return json({ error: "Message is required" }, 400);
    }

    // Load the caller's business context so manual qualification matches
    // the automatic pipeline.
    const { data: prefs } = await supabase
      .from("ai_preferences")
      .select("business_name, business_services, business_ideal_client, business_target_audience, custom_instructions")
      .eq("user_id", userId)
      .maybeSingle();

    let ai: any;
    try {
      ai = await runQualification({
        name: leadName || "",
        email: leadEmail || null,
        phone: null,
        company: null,
        source: "manual",
        message,
        prefs: prefs || null,
      });
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("Rate limit")) return json({ error: msg }, 429);
      if (msg.includes("credits")) return json({ error: msg }, 402);
      console.error("lead-response qualification failed", e);
      return json({ error: "AI generation failed" }, 500);
    }

    const missingInfo = normalizeMissingInfo(ai.missing_info);
    const fitScore = normalizeFitScore(ai.fit_score);
    const fitFactors = normalizeFitFactors(ai.factors);

    return json({
      // Legacy fields the frontend already reads
      reply: ai.reply || "",
      service_requested: ai.service_requested || "",
      // The shared core doesn't extract a phone; keep empty for backwards compat.
      phone: "",
      budget: ai.budget || "",
      timeline: ai.timeline || "",
      goals: ai.goals || "",
      notes: ai.notes || "",
      lead_quality: ai.lead_quality || "",
      quality_reason: ai.quality_reason || "",
      ai_recommendation: ai.ai_recommendation || "",
      // New fields at parity with lead-requalify / inbound pipelines
      lead_score: ai.lead_score || null,
      lead_score_reason: ai.lead_score_reason
        ? String(ai.lead_score_reason).slice(0, 200)
        : null,
      missing_info: missingInfo,
      fit_score: fitScore,
      factors: fitFactors,
    });
  } catch (e) {
    console.error("lead-response error:", e);
    return json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500,
    );
  }
});
