import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2";
import { logSecurityEvent } from "./security-telemetry.ts";

type AdminClient = SupabaseClient<any, any, any, any, any>;

type AiRateLimitOptions = {
  source: string;
  cost?: number;
};

type RateLimitWindow = {
  maxRequests: number;
  windowSeconds: number;
};

type UserRateLimitOptions = {
  source: string;
  windows: Array<RateLimitWindow & { name: string }>;
  errorMessage?: string;
};

type PublicRateLimitOptions = {
  source: string;
  resource?: string | null;
  ipLimit?: RateLimitWindow;
  resourceLimit?: RateLimitWindow;
};

type RateLimitRow = {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
};

const AI_BURST_LIMIT = 10;
const AI_BURST_WINDOW_SECONDS = 10 * 60;
const AI_DAILY_LIMIT = 100;
const AI_DAILY_WINDOW_SECONDS = 24 * 60 * 60;

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function jsonError(message: string, status: number, retryAfter?: number): Response {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
  if (retryAfter) headers["Retry-After"] = String(retryAfter);
  return new Response(JSON.stringify({ error: message }), { status, headers });
}

function getRequestAddress(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwarded ||
    req.headers.get("cf-connecting-ip")?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  ).slice(0, 128);
}

async function consumeWindow(
  admin: AdminClient,
  bucket: string,
  subjectHash: string,
  maxRequests: number,
  windowSeconds: number,
  requestCost: number,
): Promise<RateLimitRow> {
  const { data, error } = await admin.rpc("consume_abuse_rate_limit", {
    _bucket: bucket,
    _subject_hash: subjectHash,
    _max_requests: maxRequests,
    _window_seconds: windowSeconds,
    _request_cost: requestCost,
  });
  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as RateLimitRow | null;
  if (!row || typeof row.allowed !== "boolean") {
    throw new Error("Rate limiter returned an invalid response");
  }
  return row;
}

/**
 * Enforces both burst and sustained per-user AI limits before a paid gateway
 * call. The database RPC is atomic, so parallel requests cannot race past it.
 */
export async function enforceAiRateLimit(
  req: Request,
  userId: string,
  options: AiRateLimitOptions,
): Promise<Response | null> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const salt = Deno.env.get("ERROR_HASH_SALT") || serviceKey?.slice(-32);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const requestCost = Math.max(1, Math.min(options.cost || 1, AI_BURST_LIMIT));

  if (!serviceKey || !salt || !supabaseUrl) {
    console.error("AI rate limiter is missing required server configuration");
    return jsonError("AI generation is temporarily unavailable", 503);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const subjectHash = await sha256(`${salt}:user:${userId}`);
  const windows = [
    {
      bucket: "ai_generation:burst",
      maxRequests: AI_BURST_LIMIT,
      windowSeconds: AI_BURST_WINDOW_SECONDS,
    },
    {
      bucket: "ai_generation:daily",
      maxRequests: AI_DAILY_LIMIT,
      windowSeconds: AI_DAILY_WINDOW_SECONDS,
    },
  ];

  try {
    for (const window of windows) {
      const result = await consumeWindow(
        admin,
        window.bucket,
        subjectHash,
        window.maxRequests,
        window.windowSeconds,
        requestCost,
      );
      if (result.allowed) continue;

      await logSecurityEvent(admin, req, {
        eventType: "rate_limit_exceeded",
        source: options.source,
        statusCode: 429,
        userId,
        metadata: {
          bucket: window.bucket,
          limit: window.maxRequests,
          window_seconds: window.windowSeconds,
          request_cost: requestCost,
        },
      });
      return jsonError(
        "Too many AI generation requests. Please try again later.",
        429,
        result.retry_after_seconds,
      );
    }
  } catch (error) {
    console.error(
      "AI rate limiter failed",
      error instanceof Error ? error.message : "unknown error",
    );
    await logSecurityEvent(admin, req, {
      eventType: "security_configuration_error",
      source: options.source,
      severity: "error",
      outcome: "failed",
      statusCode: 503,
      userId,
      metadata: { reason: "ai_rate_limiter_unavailable" },
    });
    return jsonError("AI generation is temporarily unavailable", 503);
  }

  return null;
}

/**
 * Applies configurable atomic limits to authenticated, user-triggered actions.
 * Internal service-role workflows should bypass this at their call site.
 */
export async function enforceUserRateLimit(
  req: Request,
  userId: string,
  options: UserRateLimitOptions,
): Promise<Response | null> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const salt = Deno.env.get("ERROR_HASH_SALT") || serviceKey?.slice(-32);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  if (!serviceKey || !salt || !supabaseUrl) {
    console.error("User rate limiter is missing required server configuration");
    return jsonError("This action is temporarily unavailable", 503);
  }
  if (!options.windows.length) {
    console.error("User rate limiter has no configured windows");
    return jsonError("This action is temporarily unavailable", 503);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const subjectHash = await sha256(salt + ":user:" + userId);

  try {
    for (const window of options.windows) {
      const bucket = "user:" + options.source + ":" + window.name;
      const result = await consumeWindow(
        admin,
        bucket,
        subjectHash,
        window.maxRequests,
        window.windowSeconds,
        1,
      );
      if (result.allowed) continue;

      await logSecurityEvent(admin, req, {
        eventType: "rate_limit_exceeded",
        source: options.source,
        statusCode: 429,
        userId,
        metadata: {
          bucket,
          dimension: "user",
          limit: window.maxRequests,
          window_seconds: window.windowSeconds,
        },
      });
      return jsonError(
        options.errorMessage ||
          "Too many requests. Please wait before trying again.",
        429,
        result.retry_after_seconds,
      );
    }
  } catch (error) {
    console.error(
      "User rate limiter failed",
      error instanceof Error ? error.message : "unknown error",
    );
    await logSecurityEvent(admin, req, {
      eventType: "security_configuration_error",
      source: options.source,
      severity: "error",
      outcome: "failed",
      statusCode: 503,
      userId,
      metadata: { reason: "user_rate_limiter_unavailable" },
    });
    return jsonError("This action is temporarily unavailable", 503);
  }

  return null;
}

/**
 * Protects anonymous, token-gated workflows with independent per-address and
 * per-resource counters. Resource identifiers and addresses are salted before
 * storage, and the database RPC keeps parallel requests atomic.
 */
export async function enforcePublicRateLimit(
  req: Request,
  options: PublicRateLimitOptions,
): Promise<Response | null> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const salt = Deno.env.get("ERROR_HASH_SALT") || serviceKey?.slice(-32);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  if (!serviceKey || !salt || !supabaseUrl) {
    console.error("Public endpoint rate limiter is missing required server configuration");
    return jsonError("This action is temporarily unavailable", 503);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const ipLimit = options.ipLimit || { maxRequests: 30, windowSeconds: 10 * 60 };
  const resourceLimit = options.resourceLimit || {
    maxRequests: 10,
    windowSeconds: 10 * 60,
  };
  const subjects = [
    {
      dimension: "address",
      bucket: `public:${options.source}:address`,
      subjectHash: await sha256(`${salt}:address:${getRequestAddress(req)}`),
      ...ipLimit,
    },
  ];

  if (options.resource) {
    subjects.push({
      dimension: "resource",
      bucket: `public:${options.source}:resource`,
      subjectHash: await sha256(`${salt}:resource:${options.resource}`),
      ...resourceLimit,
    });
  }

  try {
    for (const subject of subjects) {
      const result = await consumeWindow(
        admin,
        subject.bucket,
        subject.subjectHash,
        subject.maxRequests,
        subject.windowSeconds,
        1,
      );
      if (result.allowed) continue;

      await logSecurityEvent(admin, req, {
        eventType: "rate_limit_exceeded",
        source: options.source,
        statusCode: 429,
        metadata: {
          bucket: subject.bucket,
          dimension: subject.dimension,
          limit: subject.maxRequests,
          window_seconds: subject.windowSeconds,
        },
      });
      return jsonError(
        "Too many requests. Please wait before trying again.",
        429,
        result.retry_after_seconds,
      );
    }
  } catch (error) {
    console.error(
      "Public endpoint rate limiter failed",
      error instanceof Error ? error.message : "unknown error",
    );
    await logSecurityEvent(admin, req, {
      eventType: "security_configuration_error",
      source: options.source,
      severity: "error",
      outcome: "failed",
      statusCode: 503,
      metadata: { reason: "public_rate_limiter_unavailable" },
    });
    return jsonError("This action is temporarily unavailable", 503);
  }

  return null;
}
