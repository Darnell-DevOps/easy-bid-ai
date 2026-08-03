import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { markOAuthRedirect } from "@/lib/oauth-return";
import { consumeReturnPath } from "@/lib/session-expiry";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Clock } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const expired = searchParams.get("expired") === "1";
  const returnTo = useRef<string>("/dashboard");

  useEffect(() => {
    const saved = consumeReturnPath();
    if (saved) returnTo.current = saved;
  }, []);

  useEffect(() => {
    if (!expired) return;
    toast({
      title: "Session expired",
      description: "You were signed out for your security. Please sign in again.",
    });
  }, [expired, toast]);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem("show_signed_out_notice") === "1") {
        window.sessionStorage.removeItem("show_signed_out_notice");
        setSignedOut(true);
        toast({
          title: "Signed out",
          description: "You have been signed out successfully.",
        });
      }
    } catch {
      /* storage unavailable */
    }
  }, [toast]);


  const handleGoogle = async () => {
    setGoogleLoading(true);
    markOAuthRedirect(returnTo.current);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setGoogleLoading(false);
      toast({ title: "Google sign-in failed", description: result.error.message, variant: "destructive" });
      return;
    }
    if (result.redirected) return;
    navigate(returnTo.current);
  };

  const handleApple = async () => {
    setAppleLoading(true);
    markOAuthRedirect(returnTo.current);
    const result = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setAppleLoading(false);
      toast({ title: "Apple sign-in failed", description: result.error.message, variant: "destructive" });
      return;
    }
    if (result.redirected) return;
    navigate(returnTo.current);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    } else {
      navigate(returnTo.current);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="text-xl font-semibold text-foreground tracking-tight">
            Close<span className="text-gradient-sync">Sync</span> <span className="text-foreground">AI</span>
          </Link>
          <p className="text-muted-foreground text-sm mt-2">Sign in to your account</p>
        </div>
        {expired && (
          <div
            role="status"
            className="mb-4 flex items-start gap-2.5 rounded-lg border border-accent/40 bg-accent/10 px-3.5 py-3 text-sm text-foreground"
          >
            <Clock className="w-4 h-4 mt-0.5 flex-shrink-0 text-accent" />
            <span>
              Your session expired and you were signed out for security. Sign in again to pick up where
              you left off.
            </span>
          </div>
        )}
        {signedOut && (
          <div
            role="status"
            className="mb-4 flex items-start gap-2.5 rounded-lg border border-green-500/40 bg-green-500/10 px-3.5 py-3 text-sm text-foreground"
          >
            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-500" />
            <span>You have been signed out successfully.</span>
          </div>
        )}

        <Card className="border-border">
          <CardContent className="p-6">
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading}
              className="w-full h-11 rounded-lg border border-border bg-background hover:bg-muted/60 transition flex items-center justify-center gap-2.5 text-sm font-medium text-foreground disabled:opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#EA4335" d="M9 3.48c1.69 0 3.21.58 4.4 1.72l3.27-3.27C14.69.92 12.05 0 9 0 5.48 0 2.44 2.02.96 4.96l3.81 2.96C5.5 5.34 7.07 3.48 9 3.48z"/>
                <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.63z"/>
                <path fill="#FBBC05" d="M4.77 10.71A5.41 5.41 0 0 1 4.5 9c0-.6.1-1.17.27-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.04l3.81-2.33z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.32-1.58-5.03-3.7L.96 13.04C2.44 15.98 5.48 18 9 18z"/>
              </svg>
              Continue with Google
            </button>

            <button
              type="button"
              onClick={handleApple}
              disabled={appleLoading}
              className="w-full h-11 mt-3 rounded-lg border border-border bg-background hover:bg-muted/60 transition flex items-center justify-center gap-2.5 text-sm font-medium text-foreground disabled:opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M16.36 12.78c.02 2.6 2.28 3.47 2.31 3.48-.02.06-.36 1.24-1.19 2.45-.72 1.05-1.47 2.1-2.65 2.12-1.16.02-1.53-.69-2.85-.69-1.32 0-1.74.67-2.83.71-1.14.04-2.01-1.13-2.73-2.18-1.48-2.15-2.62-6.08-1.09-8.73.76-1.32 2.11-2.15 3.58-2.17 1.12-.02 2.17.75 2.85.75.68 0 1.96-.93 3.3-.79.56.02 2.14.23 3.15 1.71-.08.05-1.88 1.1-1.86 3.34M14.2 4.6c.6-.73 1.01-1.74.9-2.75-.87.04-1.92.58-2.54 1.3-.56.64-1.05 1.67-.92 2.66.97.07 1.96-.49 2.56-1.21"/>
              </svg>
              Continue with Apple
            </button>


            <div className="flex items-center gap-3 my-5">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">Or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="mt-1.5"
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link to="/forgot-password" className="text-xs text-accent hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="mt-1.5"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Don't have an account?{" "}
          <Link to="/signup" className="text-accent hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
