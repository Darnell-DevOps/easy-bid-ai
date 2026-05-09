import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getPaddleClient } from "../_shared/paddle.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );

    const { data: isAdmin, error: roleErr } = await supabase.rpc("is_super_admin");
    if (roleErr || !isAdmin) return json({ error: "forbidden" }, 403);

    const paddle = getPaddleClient("live");
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

    const fetchMetric = async (path: string) => {
      try {
        // SDK doesn't expose metrics — use raw fetch via gateway
        const res = await fetch(
          `https://connector-gateway.lovable.dev/paddle${path}?from=${from}&to=${to}`,
          {
            headers: {
              "X-Connection-Api-Key": Deno.env.get("PADDLE_LIVE_API_KEY")!,
              "Lovable-API-Key": Deno.env.get("LOVABLE_API_KEY")!,
            },
          },
        );
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    };

    const [revenue, mrr, subs] = await Promise.all([
      fetchMetric("/metrics/revenue"),
      fetchMetric("/metrics/monthly-recurring-revenue"),
      fetchMetric("/metrics/active-subscribers"),
    ]);

    // Suppress unused var warning
    void paddle;

    return json({
      revenue: revenue?.data ?? null,
      mrr: mrr?.data ?? null,
      subscribers: subs?.data ?? null,
      window: { from, to },
    });
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
