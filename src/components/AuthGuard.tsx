import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { handleLostSession, markSignedIn } from "@/lib/session-expiry";

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return authenticated ? <>{children}</> : null;
}
