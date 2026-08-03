import { supabase } from "@/integrations/supabase/client";

const KEY = "post_oauth_redirect";

/** Remember where to land after a full-page OAuth round-trip. */
export function markOAuthRedirect(path = "/dashboard") {
  try {
    if (path.startsWith("/") && !path.startsWith("//")) {
      sessionStorage.setItem(KEY, path);
    }
  } catch {
    /* storage unavailable — ignore */
  }
}

function readPending(): string | null {
  try {
    const v = sessionStorage.getItem(KEY);
    return v && v.startsWith("/") && !v.startsWith("//") ? v : null;
  } catch {
    return null;
  }
}

function clearPending() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * If an OAuth sign-in was started from this tab, wait for the session to be
 * hydrated and then hand the target path back to the caller.
 * Returns an unsubscribe function.
 */
export function consumeOAuthRedirect(onReady: (path: string) => void): () => void {
  const pending = readPending();
  if (!pending) return () => {};

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    clearPending();
    onReady(pending);
  };

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session) finish();
  });

  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) finish();
  });

  // Give the session a bounded window to arrive, then stop waiting.
  const timeout = window.setTimeout(() => {
    if (!done) clearPending();
  }, 8000);

  return () => {
    window.clearTimeout(timeout);
    data.subscription.unsubscribe();
  };
}
