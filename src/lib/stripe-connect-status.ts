/**
 * Client-side interpretation of the stripe-connect-account Edge Function.
 * The function is the only source of truth; anything unexpected is treated
 * as an error rather than guessed into a "ready" state.
 */
export type ConnectState =
  | { kind: "not_configured" }
  | { kind: "unconnected" }
  | { kind: "incomplete"; chargesEnabled: boolean; payoutsEnabled: boolean }
  | { kind: "ready" }
  | { kind: "error"; message: string };

export const CONNECT_ERROR_FALLBACK = "We couldn't check your Stripe connection. Please retry.";

export function interpretConnectResponse(data: unknown): ConnectState {
  if (!data || typeof data !== "object") return { kind: "error", message: CONNECT_ERROR_FALLBACK };
  const d = data as Record<string, unknown>;
  if (typeof d.error === "string") return { kind: "error", message: d.error };
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
