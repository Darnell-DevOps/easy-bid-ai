// Shared Paddle helpers for edge functions.
// All API calls go through the Lovable connector gateway.

export type PaddleEnv = "sandbox" | "live";

const GATEWAY_BASE = "https://gateway.lovable.dev/v1/paddle";

function getKeys(env: PaddleEnv) {
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const connectionKey =
    env === "live"
      ? Deno.env.get("PADDLE_LIVE_API_KEY")
      : Deno.env.get("PADDLE_SANDBOX_API_KEY");
  if (!lovableApiKey || !connectionKey) {
    throw new Error(`Missing Paddle credentials for env=${env}`);
  }
  return { lovableApiKey, connectionKey };
}

export async function gatewayFetch(
  env: PaddleEnv,
  path: string,
  init: RequestInit = {},
) {
  const { lovableApiKey, connectionKey } = getKeys(env);
  const url = `${GATEWAY_BASE}${path}`;
  const headers = new Headers(init.headers);
  headers.set("Lovable-API-Key", lovableApiKey);
  headers.set("X-Connection-Api-Key", connectionKey);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(url, { ...init, headers });
}

export async function verifyWebhook(
  req: Request,
  env: PaddleEnv,
): Promise<{ eventType: string; data: any }> {
  const secret =
    env === "live"
      ? Deno.env.get("PAYMENTS_LIVE_WEBHOOK_SECRET")
      : Deno.env.get("PAYMENTS_SANDBOX_WEBHOOK_SECRET");
  if (!secret) throw new Error("Missing webhook secret");

  const sigHeader = req.headers.get("paddle-signature") || "";
  const rawBody = await req.text();

  // Parse "ts=...;h1=..."
  const parts = Object.fromEntries(
    sigHeader.split(";").map((kv) => {
      const idx = kv.indexOf("=");
      return [kv.slice(0, idx), kv.slice(idx + 1)];
    }),
  );
  const ts = parts["ts"];
  const h1 = parts["h1"];
  if (!ts || !h1) throw new Error("Invalid signature header");

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${ts}:${rawBody}`));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (computed !== h1) throw new Error("Signature mismatch");

  const json = JSON.parse(rawBody);
  return { eventType: json.event_type, data: json.data };
}
