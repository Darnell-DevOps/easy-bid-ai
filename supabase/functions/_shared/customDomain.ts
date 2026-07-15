// Deno-side equivalent of src/lib/customDomain.ts — resolves a user's
// verified primary custom domain (if configured and enabled for this use)
// and builds the correct public URL, falling back to the canonical app URL.
const FALLBACK_ORIGIN = "https://app.closesync.io";

export async function resolvePublicUrl(
  supabase: any,
  userId: string | null | undefined,
  path: string,
  kind: "portal" | "forms",
): Promise<string> {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const fallback = `${FALLBACK_ORIGIN}${cleanPath}`;
  if (!userId) return fallback;
  try {
    const { data, error } = await supabase.rpc("get_primary_custom_domain", { p_user_id: userId });
    if (error) return fallback;
    const row = Array.isArray(data) ? data[0] : null;
    if (!row?.domain) return fallback;
    const applies = kind === "portal" ? !!row.use_for_portal : !!row.use_for_forms;
    if (!applies) return fallback;
    const cleanDomain = String(row.domain).replace(/^https?:\/\//, "").replace(/\/$/, "");
    return `https://${cleanDomain}${cleanPath}`;
  } catch {
    return fallback;
  }
}
