/**
 * Centralised handling for expired / invalid sessions.
 *
 * When a refresh token expires or is revoked server-side, the Supabase client
 * emits `SIGNED_OUT` / `TOKEN_REFRESH_FAILED`. We treat that as an expiry
 * (unless the user deliberately logged out) and bounce them to /login with a
 * friendly message plus the path they were on so we can return them there.
 */

const WAS_SIGNED_IN_KEY = "cs.auth.was_signed_in";
const RETURN_KEY = "cs.auth.return_to";

export function markSignedIn() {
  try {
    window.localStorage.setItem(WAS_SIGNED_IN_KEY, "1");
  } catch {
    /* storage unavailable */
  }
}

/** Called on deliberate logout so the next /login visit shows no expiry notice. */
export function clearSignedInMarker() {
  try {
    window.localStorage.removeItem(WAS_SIGNED_IN_KEY);
    window.sessionStorage.removeItem(RETURN_KEY);
  } catch {
    /* ignore */
  }
}

function wasSignedIn(): boolean {
  try {
    return window.localStorage.getItem(WAS_SIGNED_IN_KEY) === "1";
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

/**
 * Handle a protected route losing its session.
 * If the user had an active session before, treat it as an expiry: remember the
 * current path and send them to /login?expired=1. Otherwise just go to /login.
 */
export function handleLostSession(navigate?: (to: string, opts?: { replace?: boolean }) => void) {
  if (redirecting) return;
  redirecting = true;

  const expired = wasSignedIn();
  clearSignedInMarker();

  const path = window.location.pathname + window.location.search;
  if (expired && !path.startsWith("/login")) {
    try {
      window.sessionStorage.setItem(RETURN_KEY, path);
    } catch {
      /* ignore */
    }
  }

  const target = expired ? "/login?expired=1" : "/login";
  if (navigate) {
    navigate(target, { replace: true });
    // allow future redirects after this navigation settles
    setTimeout(() => {
      redirecting = false;
    }, 500);
  } else {
    window.location.replace(target);
  }
}
