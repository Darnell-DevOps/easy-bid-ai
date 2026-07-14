/**
 * Resolve the provider's public-facing identity for contract generation.
 * Priority: legal_name → trading_name → business_name. Empty strings treated
 * as absent. No fallback beyond these three fields.
 */
export interface ProviderIdentityFields {
  legal_name?: string | null;
  trading_name?: string | null;
  business_name?: string | null;
}

export function resolveProviderName(
  branding: ProviderIdentityFields | null | undefined,
): string | null {
  if (!branding) return null;
  const candidates = [branding.legal_name, branding.trading_name, branding.business_name];
  for (const c of candidates) {
    const t = (c || "").trim();
    if (t) return t;
  }
  return null;
}
