/**
 * Centralised handling for expired / invalid sessions.
 *
 * When a refresh token expires or is revoked server-side, the Supabase client
 * emits `SIGNED_OUT` / `TOKEN_REFRESH_FAILED`. We treat that as an expiry
 * (unless the user deliberately logged out) and bounce them to /login with a
 * friendly message plus the path they were on so we can return them there.
 */

const DELIBERATE_KEY = "cs.auth.deliberate_signout";
const RETURN_KEY = "cs.auth.return_to";

export function markDeliberateSignOut() {
  try {
    window.sessionStorage.setItem(DELIBERATE_KEY, "1");
  } catch {
    /* storage unavailable */
  }
}

function consumeDeliberateSignOut(): boolean {
  try {
    const v = window.sessionStorage.getItem(DELIBERATE_KEY);
    window.sessionStorage.removeItem(DELIBERATE_KEY);
    return v === "1";
  } catch {
    return false;
  }
}

export function consumeReturnPath(): string | null {
  try {
    const v = window.sessionStorage.getItem(RETURN_KEY);
    window.sessionStorage.removeItem(RETURN_KEY);
    return v;
  } catch {
    return null;
  }
}

let redirecting = false;

/** Send the user to /login with the "session expired" notice. */
export function redirectToLoginExpired() {
  if (redirecting) return;
  redirecting = true;

  const path = window.location.pathname + window.location.search;
  try {
    if (!path.startsWith("/login")) window.sessionStorage.setItem(RETURN_KEY, path);
  } catch {
    /* ignore */
  }

  if (window.location.pathname === "/login") {
    window.location.replace("/login?expired=1");
  } else {
    window.location.replace("/login?expired=1");
  }
}

/**
 * Decide what to do when the client reports no session on a protected route.
 * Returns true when the redirect was treated as an expiry.
 */
export function handleLostSession(): boolean {
  if (consumeDeliberateSignOut()) return false;
  redirectToLoginExpired();
  return true;
}
