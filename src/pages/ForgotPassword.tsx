import PageMeta from "@/components/PageMeta";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AuthLayout from "@/components/auth/AuthLayout";
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
    <AuthLayout title="Reset your CloseSync AI password" description="We'll email you a secure reset link" showPreview={false}>
      <PageMeta title="Reset your password | CloseSync AI" description="Request a secure password reset link for your CloseSync AI account." path="/forgot-password" noIndex />
      <AuthFormError ref={requestErrorRef} id="forgot-password-error" message={requestError} />
      {sent ? (
        <div
          ref={sentRef}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          tabIndex={-1}
          className="cs-auth-status focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <p>If an account exists for <span className="text-foreground">{email}</span>, you'll receive a reset link shortly.</p>
          <p>Check your spam folder if you don't see it.</p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          aria-busy={loading}
          aria-describedby={requestError ? "forgot-password-error" : undefined}
          className="cs-auth-controls space-y-4"
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
              className="cs-auth-input"
            />
          </div>
          <AuthCaptcha ref={captchaRef} action="password-reset" onTokenChange={setCaptchaToken} />
          <Button
            type="submit"
            disabled={loading || (captchaConfigured && !captchaToken)}
            className="cs-auth-submit"
          >
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
      <p className="cs-auth-switch">
        Remember your password?{" "}
        <Link to="/login" className="cs-auth-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
