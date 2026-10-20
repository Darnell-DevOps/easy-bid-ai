/**
 * Client-side interpretation of the stripe-connect-account Edge Function.
 * The function is the only source of truth; anything unexpected is treated
 * as an error rather than guessed into a "ready" state.
 */
import { FunctionsHttpError } from "@supabase/supabase-js";

export type ConnectState =
  | { kind: "not_configured" }
  | { kind: "unconnected" }
  | { kind: "incomplete"; chargesEnabled: boolean; payoutsEnabled: boolean }
  | { kind: "ready" }
  | { kind: "error"; message: string };

export const CONNECT_ERROR_FALLBACK = "We couldn't check your Stripe connection. Please retry.";
export const CONNECT_ONBOARDING_ERROR = "We couldn't start Stripe onboarding. Please retry.";

const CONNECT_FAILURE_MESSAGES: Record<string, string> = {
  stripe_connect_setup_required: "Stripe Connect isn't enabled for CloseSync's Stripe account. The CloseSync owner needs to finish Connect setup in Stripe.",
  stripe_credentials_invalid: "CloseSync's Stripe test credentials need attention. Contact CloseSync support.",
  stripe_permission_denied: "CloseSync's Stripe connection doesn't have permission to set up accounts. Contact CloseSync support.",
  stripe_country_rejected: "Stripe couldn't set up an account in the selected country. Check your legal business country or contact CloseSync support.",
  stripe_request_rejected: "Stripe rejected account setup. Contact CloseSync support.",
  stripe_temporarily_unavailable: "Stripe is temporarily unavailable. Please wait a moment and retry.",
  connect_return_origin_missing: "CloseSync's Stripe return address needs configuration. Contact CloseSync support.",
  connect_not_configured: "Stripe Connect isn't configured for this CloseSync deployment. Contact CloseSync support.",
  connect_setup_failed: "Could not prepare the connected account. Please retry.",
  session_expired: "Your session has expired. Sign in again before connecting Stripe.",
};

function connectFailureMessage(data: unknown, fallback: string, status?: number): string {
  if (status === 401) return CONNECT_FAILURE_MESSAGES.session_expired;
  if (status === 429) return "Too many setup attempts. Please wait a few minutes before retrying.";
  const d = data && typeof data === "object" ? data as Record<string, unknown> : {};
  // Only known application codes reach the user; provider messages can contain PII.
  const message = typeof d.code === "string" && Object.prototype.hasOwnProperty.call(CONNECT_FAILURE_MESSAGES, d.code)
    ? CONNECT_FAILURE_MESSAGES[d.code] : fallback;
  const requestId = typeof d.requestId === "string" && /^req_[A-Za-z0-9]{1,100}$/.test(d.requestId)
    ? d.requestId : undefined;
  return requestId ? `${message} Reference: ${requestId}.` : message;
}

/** Supabase places non-2xx JSON on FunctionsHttpError.context, not on data. */
export async function connectInvocationError(error: unknown, fallback: string): Promise<string> {
  if (!(error instanceof FunctionsHttpError)) return fallback;
  const response = error.context as Response;
  try {
    return connectFailureMessage(await response.clone().json(), fallback, response.status);
  } catch {
    return connectFailureMessage(null, fallback, response.status);
  }
}

export function interpretConnectResponse(data: unknown): ConnectState {
  if (!data || typeof data !== "object") return { kind: "error", message: CONNECT_ERROR_FALLBACK };
  const d = data as Record<string, unknown>;
  if (typeof d.error === "string") return { kind: "error", message: connectFailureMessage(d, CONNECT_ERROR_FALLBACK) };
  if (d.environment !== "test") return { kind: "error", message: CONNECT_ERROR_FALLBACK };
  if (d.configured === false) return { kind: "not_configured" };
  if (d.configured !== true) return { kind: "error", message: CONNECT_ERROR_FALLBACK };
  if (d.connected === false) return { kind: "unconnected" };
  if (d.connected !== true) return { kind: "error", message: CONNECT_ERROR_FALLBACK };
  const chargesEnabled = d.chargesEnabled === true;
  const payoutsEnabled = d.payoutsEnabled === true;
  // Only an explicit ready flag with both capabilities counts as ready.
  if (d.ready === true && chargesEnabled && payoutsEnabled) return { kind: "ready" };
  return { kind: "incomplete", chargesEnabled, payoutsEnabled };
}

/** Accept only Stripe-hosted onboarding URLs. */
export function safeStripeOnboardingUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "connect.stripe.com") return null;
    if (url.username || url.password || url.port) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Countries where Stripe supports Standard connected accounts (ISO 3166-1 alpha-2). */
export const STRIPE_CONNECT_COUNTRIES = [
  "AE", "AT", "AU", "BE", "BG", "BR", "CA", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "FI",
  "FR", "GB", "GI", "GR", "HK", "HR", "HU", "IE", "IN", "IT", "JP", "LI", "LT", "LU", "LV",
  "MT", "MX", "MY", "NL", "NO", "NZ", "PL", "PT", "RO", "SE", "SG", "SI", "SK", "TH", "US",
] as const;

export function isSupportedConnectCountry(code: string): boolean {
  return (STRIPE_CONNECT_COUNTRIES as readonly string[]).includes(code);
}

export function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
