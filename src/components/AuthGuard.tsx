import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { handleLostSession, markSignedIn } from "@/lib/session-expiry";
import { AccessibleLoadingState } from "@/components/ui/accessible-loading-state";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const apply = (session: unknown) => {
      if (cancelled) return;
      if (session) {
        markSignedIn();
        setAuthenticated(true);
      } else {
        setAuthenticated(false);
        handleLostSession(navigate);
      }
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "TOKEN_REFRESHED" && session) markSignedIn();
      apply(session);
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        apply(null);
        return;
      }
      // Re-validate with the auth server: a locally stored token can be stale
      // or revoked, in which case getUser() fails and we treat it as expired.
      const { data, error } = await supabase.auth.getUser();
      apply(error || !data.user ? null : session);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [navigate]);

  if (loading) {
    return (
      <AccessibleLoadingState
        label="Checking your session"
        className="min-h-screen bg-background"
        spinnerClassName="h-6 w-6"
      />
    );
  }

  return authenticated ? <>{children}</> : null;
}
