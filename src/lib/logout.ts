import { supabase } from "@/integrations/supabase/client";

/**
 * Fully clear the current session, regardless of which provider signed the
 * user in (email, Google, Apple).
 *
 * 1. Revoke the refresh token server-side (global scope).
 * 2. Fall back to a local sign-out if the network call fails, so the browser
 *    never keeps a stale token.
 * 3. Wipe every Supabase auth key plus our own OAuth bookkeeping from
 *    localStorage/sessionStorage.
 * 4. Hard-navigate so all in-memory React/query state is discarded.
 */
export async function performSignOut(redirectTo = "/login") {
  try {
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) await supabase.auth.signOut({ scope: "local" });
  } catch {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* offline — local storage cleanup below still applies */
    }
  }

  const purge = (store: Storage) => {
    try {
      for (const key of Object.keys(store)) {
        if (key.startsWith("sb-") || key.startsWith("supabase.auth")) {
          store.removeItem(key);
        }
      }
    } catch {
      /* storage unavailable */
    }
  };

  purge(window.localStorage);
  purge(window.sessionStorage);

  try {
    window.sessionStorage.removeItem("post_oauth_redirect");
  } catch {
    /* ignore */
  }

  window.location.replace(redirectTo);
}
