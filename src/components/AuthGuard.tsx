import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { handleLostSession, markSignedIn } from "@/lib/session-expiry";
import { AccessibleLoadingState } from "@/components/ui/accessible-loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { performSignOut } from "@/lib/logout";

type GuardState = "loading" | "ready" | "challenge" | "error";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GuardState>("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const navigate = useNavigate();
  const checkVersion = useRef(0);

  const checkAssurance = useCallback(async () => {
    const version = ++checkVersion.current;
    setState("loading");
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (version !== checkVersion.current) return;
    if (sessionError || !sessionData.session) {
      handleLostSession(navigate);
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (version !== checkVersion.current) return;
    if (userError || !userData.user) {
      handleLostSession(navigate);
      return;
    }

    const { data: level, error: levelError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(sessionData.session.access_token);
    if (version !== checkVersion.current) return;
    if (levelError || !level) {
      setError("We couldn't check your sign-in security. Try again.");
      setState("error");
      return;
    }

    if (level.nextLevel === "aal2" && level.currentLevel !== "aal2") {
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (version !== checkVersion.current) return;
      const verified = factors?.totp?.find((factor) => factor.status === "verified");
      if (factorsError || !verified) {
        setError("Your account requires an authenticator code, but the factor could not be loaded. Try again or contact support.");
        setState("error");
        return;
      }
      setFactorId(verified.id);
      setError(null);
      setState("challenge");
      return;
    }

    markSignedIn();
    setError(null);
    setState("ready");
  }, [navigate]);

  useEffect(() => {
    const versionRef = checkVersion;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        ++checkVersion.current;
        handleLostSession(navigate);
      } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        window.setTimeout(() => void checkAssurance(), 0);
      }
    });
    void checkAssurance();
    return () => {
      ++versionRef.current;
      subscription.unsubscribe();
    };
  }, [checkAssurance, navigate]);

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!factorId || !/^\d{6}$/.test(code) || verifying) return;
    setVerifying(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    setVerifying(false);
    if (verifyError) {
      setError("That code didn't work. Check your authenticator app and try again.");
      setCode("");
      return;
    }
    setCode("");
    await checkAssurance();
  };

  if (state === "loading") {
    return (
      <AccessibleLoadingState
        label="Checking your session"
        className="min-h-screen bg-background"
        spinnerClassName="h-6 w-6"
      />
    );
  }

  if (state === "challenge" || state === "error") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
        <section className="w-full max-w-md rounded-lg border border-border bg-card p-6 sm:p-8" aria-labelledby="mfa-title">
          <h1 id="mfa-title" className="text-2xl font-semibold text-foreground">Verify your sign-in</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {state === "challenge" ? "Enter the six-digit code from your authenticator app to open your workspace." : "Your workspace is temporarily unavailable until we can verify this session."}
          </p>
          {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
          {state === "challenge" && (
            <form onSubmit={verifyCode} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mfa-code">Authenticator code</Label>
                <Input id="mfa-code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus />
              </div>
              <Button type="submit" disabled={verifying || code.length !== 6} className="w-full">{verifying ? "Verifying…" : "Verify and continue"}</Button>
            </form>
          )}
          {state === "error" && <Button type="button" className="mt-6 w-full" onClick={() => void checkAssurance()}>Try again</Button>}
          <Button type="button" variant="link" className="mt-3 px-0" onClick={() => void performSignOut("/login")}>Sign out</Button>
        </section>
      </main>
    );
  }

  return <>{children}</>;
}
