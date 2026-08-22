import PageMeta from "@/components/PageMeta";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AuthFormError from "@/components/auth/AuthFormError";

type RecoveryState = "checking" | "ready" | "invalid";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("checking");
  const [updateError, setUpdateError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setRecoveryState("ready");
      }
    });
    void supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!cancelled) setRecoveryState(session ? "ready" : "invalid");
      })
      .catch(() => {
        if (!cancelled) setRecoveryState("invalid");
      });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (recoveryState === "invalid" || updateError) errorRef.current?.focus();
  }, [recoveryState, updateError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateError(null);
    if (password.length < 8) {
      setUpdateError("Password too short. Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setUpdateError("Passwords don't match. Enter the same password in both fields.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setUpdateError(`Password update failed. ${error.message}`);
    } else {
      toast({ title: "Password updated", description: "You're now signed in." });
      navigate("/dashboard");
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <PageMeta title="Set a new password | CloseSync AI" description="Choose a new password for your CloseSync AI account." path="/reset-password" noIndex />
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="rounded-sm text-xl font-semibold text-foreground tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            Close<span className="text-gradient-sync">Sync</span> <span className="text-foreground">AI</span>
          </Link>
          <h1 className="text-2xl font-semibold text-foreground mt-4">Set a new password</h1>
          <p className="text-muted-foreground text-sm mt-2">Choose a new password</p>
        </div>
        <Card className="border-border">
          <CardContent className="p-6">
            {recoveryState === "checking" ? (
              <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
                Checking your password reset link...
              </p>
            ) : recoveryState === "invalid" ? (
              <AuthFormError
                ref={errorRef}
                id="reset-link-error"
                message="This password reset link is invalid or has expired. Request a new link and try again."
              />
            ) : (
              <>
                <AuthFormError ref={errorRef} id="reset-password-error" message={updateError} />
                <form
                  onSubmit={handleSubmit}
                  aria-busy={loading}
                  aria-describedby={updateError ? "reset-password-error" : undefined}
                  className="space-y-4"
                >
                  <div>
                    <Label htmlFor="password">New password</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      aria-describedby="reset-password-requirements"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setUpdateError(null);
                      }}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      className="mt-1.5"
                    />
                    <p id="reset-password-requirements" className="mt-1.5 text-xs text-muted-foreground">
                      Use at least 8 characters.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="confirm">Confirm password</Label>
                    <Input
                      id="confirm"
                      name="password-confirmation"
                      type="password"
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => {
                        setConfirm(e.target.value);
                        setUpdateError(null);
                      }}
                      placeholder="••••••••"
                      required
                      minLength={8}
                      className="mt-1.5"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {loading ? "Updating…" : "Update password"}
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
