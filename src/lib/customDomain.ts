import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, { domain: string | null; portal: boolean; forms: boolean; ts: number }>();
const TTL_MS = 60_000;

/**
 * Returns the verified primary custom domain for a user, or null.
 * Used to rewrite public share URLs (client portal, lead forms) onto the user's own domain.
 */
export async function getPrimaryCustomDomain(userId: string | null | undefined): Promise<{
  domain: string | null;
  useForPortal: boolean;
  useForForms: boolean;
}> {
  if (!userId) return { domain: null, useForPortal: false, useForForms: false };
  const cached = cache.get(userId);
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return { domain: cached.domain, useForPortal: cached.portal, useForForms: cached.forms };
  }
  const { data } = await supabase.rpc("get_primary_custom_domain" as any, { p_user_id: userId });
  const row = Array.isArray(data) ? data[0] : null;
  const result = {
    domain: (row?.domain as string | undefined) ?? null,
    useForPortal: !!row?.use_for_portal,
    useForForms: !!row?.use_for_forms,
  };
  cache.set(userId, { domain: result.domain, portal: result.useForPortal, forms: result.useForForms, ts: Date.now() });
  return result;
}

export function buildPublicUrl(opts: {
  customDomain?: string | null;
  path: string;
}): string {
  const path = opts.path.startsWith("/") ? opts.path : `/${opts.path}`;
  if (opts.customDomain) {
    return `https://${opts.customDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")}${path}`;
  }
  if (typeof window !== "undefined") return `${window.location.origin}${path}`;
  return path;
}
