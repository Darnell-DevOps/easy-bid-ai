// Resolves human-readable price ID -> Paddle internal price ID
import { createClient } from "npm:@supabase/supabase-js@2";
import { gatewayFetch, getServerPaddleEnv } from "../_shared/paddle.ts";
import { enforcePublicRateLimit } from "../_shared/abuse-rate-limit.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: cors,
    });
  }
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: cors,
      });
    }
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: userData, error: userError } = await authClient.auth.getUser(
      authHeader.slice("Bearer ".length),
    );
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: cors,
      });
    }

    const { priceId } = await req.json();
    if (
      typeof priceId !== "string" ||
      priceId.length < 1 ||
      priceId.length > 64 ||
      !/^[a-zA-Z0-9_-]+$/.test(priceId)
    ) {
      return new Response(JSON.stringify({ error: "Invalid priceId" }), {
        status: 400,
        headers: cors,
      });
    }
    const limited = await enforcePublicRateLimit(req, {
      source: "get-paddle-price",
      resource: `${userData.user.id}:${priceId}`,
      ipLimit: { maxRequests: 60, windowSeconds: 10 * 60 },
      resourceLimit: { maxRequests: 20, windowSeconds: 10 * 60 },
    });
    if (limited) return limited;

    const env = getServerPaddleEnv();
    const res = await gatewayFetch(
      env,
      `/prices?external_id=${encodeURIComponent(priceId)}`,
    );
    const data = await res.json();
    if (!data.data?.length) {
      return new Response(JSON.stringify({ error: "Price not found" }), {
        status: 404,
        headers: cors,
      });
    }
    return new Response(JSON.stringify({ paddleId: data.data[0].id }), {
      headers: cors,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: cors,
    });
  }
});
