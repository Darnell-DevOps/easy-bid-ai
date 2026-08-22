import PageMeta from "@/components/PageMeta";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import AuthCaptcha, { type AuthCaptchaHandle } from "@/components/auth/AuthCaptcha";
import AuthFormError from "@/components/auth/AuthFormError";
import { isAuthCaptchaConfigured } from "@/lib/auth-captcha";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<AuthCaptchaHandle>(null);
  const requestErrorRef = useRef<HTMLDivElement>(null);
  const sentRef = useRef<HTMLDivElement>(null);
  const captchaConfigured = isAuthCaptchaConfigured();

  useEffect(() => {
    if (requestError) requestErrorRef.current?.focus();
    else if (sent) sentRef.current?.focus();
  }, [requestError, sent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRequestError(null);
    if (captchaConfigured && !captchaToken) {
      setRequestError("Complete the security check. Please verify you are human before requesting a reset link.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
      captchaToken: captchaToken || undefined,
    });
    captchaRef.current?.reset();
    setLoading(false);
    if (error) {
      setRequestError(`Reset request failed. ${error.message}`);
    } else {
      setSent(true);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <PageMeta title="Reset your password | CloseSync AI" description="Request a secure password reset link for your CloseSync AI account." path="/forgot-password" noIndex />
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="rounded-sm text-xl font-semibold text-foreground tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            Close<span className="text-gradient-sync">Sync</span> <span className="text-foreground">AI</span>
          </Link>
          <h1 className="text-2xl font-semibold text-foreground mt-4">Reset your CloseSync AI password</h1>
          <p className="text-muted-foreground text-sm mt-2">We'll email you a secure reset link</p>
        </div>
        <Card className="border-border">
          <CardContent className="p-6">
            <AuthFormError ref={requestErrorRef} id="forgot-password-error" message={requestError} />
            {sent ? (
              <div
                ref={sentRef}
                role="status"
                aria-live="polite"
                aria-atomic="true"
                tabIndex={-1}
                className="text-sm text-muted-foreground space-y-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <p>If an account exists for <span className="text-foreground">{email}</span>, you'll receive a reset link shortly.</p>
                <p>Check your spam folder if you don't see it.</p>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                aria-busy={loading}
                aria-describedby={requestError ? "forgot-password-error" : undefined}
                className="space-y-4"
              >
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setRequestError(null);
                    }}
                    placeholder="you@company.com"
                    required
                    className="mt-1.5"
                  />
                </div>
                <AuthCaptcha ref={captchaRef} action="password-reset" onTokenChange={setCaptchaToken} />
                <Button
                  type="submit"
                  disabled={loading || (captchaConfigured && !captchaToken)}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {loading ? "Sending…" : "Send reset link"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Remember your password?{" "}
          <Link to="/login" className="rounded-sm text-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
