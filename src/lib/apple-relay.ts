/**
 * Helpers for handling Apple "Hide My Email" private relay addresses.
 *
 * Apple relay addresses (e.g. abc123@privaterelay.appleid.com) are real,
 * deliverable inboxes, but they are per-app, opaque, and change if the user
 * revokes access. They must never be used for identity matching or duplicate
 * detection — use the user's stated contact email instead.
 */

export const APPLE_RELAY_DOMAIN = "privaterelay.appleid.com";

export function isAppleRelayEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(`@${APPLE_RELAY_DOMAIN}`);
}

/**
 * Canonical form used for duplicate detection: lowercased, plus-tags removed,
 * Gmail dots ignored. Mirrors public.normalize_email() in the database.
 * Returns null for relay addresses so they never collide with real accounts.
 */
export function normalizeEmail(email?: string | null): string | null {
  if (!email) return null;
  const e = email.trim().toLowerCase();
  if (!e.includes("@")) return null;
  if (isAppleRelayEmail(e)) return null;
  const [rawLocal, rawDomain] = e.split("@");
  let local = rawLocal.split("+")[0];
  let domain = rawDomain;
  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.replace(/\./g, "");
    domain = "gmail.com";
  }
  if (!local || !domain) return null;
  return `${local}@${domain}`;
}

/** True when two addresses belong to the same person for dedup purposes. */
export function isSameEmailIdentity(a?: string | null, b?: string | null): boolean {
  const na = normalizeEmail(a);
  const nb = normalizeEmail(b);
  return !!na && !!nb && na === nb;
}

/**
 * The address the app should actually use to reach the user: their stated
 * contact email when the auth email is an Apple relay, otherwise the auth email.
 */
export function resolveContactEmail(
  authEmail?: string | null,
  contactEmail?: string | null,
): string | null {
  if (contactEmail && contactEmail.trim()) return contactEmail.trim();
  return authEmail?.trim() || null;
}

/** Short label for showing a relay address in the UI. */
export function describeEmail(email?: string | null): string {
  if (!email) return "No email on file";
  return isAppleRelayEmail(email) ? `${email} (Apple private relay)` : email;
}
