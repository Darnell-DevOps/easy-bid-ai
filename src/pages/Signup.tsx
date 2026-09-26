import PageMeta from "@/components/PageMeta";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { markOAuthRedirect } from "@/lib/oauth-return";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/landing-analytics";
import { sendEmail } from "@/lib/email";
import AuthCaptcha, { type AuthCaptchaHandle } from "@/components/auth/AuthCaptcha";
import AuthFormError from "@/components/auth/AuthFormError";
import { isAuthCaptchaConfigured } from "@/lib/auth-captcha";
import AuthLayout from "@/components/auth/AuthLayout";

function getPasswordStrength(password: string) {
  const length = password.length;
  const hasLetters = /[a-zA-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSymbols = /[^a-zA-Z0-9]/.test(password);

  if (length < 8) return "Weak";
  if (length >= 12 && hasLetters && hasNumbers && hasSymbols) return "Strong";
  if (length >= 8 && hasLetters && (hasNumbers || hasSymbols)) return "Good";
  return "Weak";
}

export default function Signup() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<AuthCaptchaHandle>(null);
  const authErrorRef = useRef<HTMLDivElement>(null);
  const captchaConfigured = isAuthCaptchaConfigured();
  const passwordStrength = getPasswordStrength(password);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    track("signup_view");
  }, []);

  useEffect(() => {
    if (authError) authErrorRef.current?.focus();
  }, [authError]);

  const handleGoogle = async () => {
    setAuthError(null);
    setGoogleLoading(true);
    markOAuthRedirect("/dashboard");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setGoogleLoading(false);
      setAuthError(`Google sign-in failed. ${result.error.message}`);
      return;
    }
    if (result.redirected) return;
    navigate("/dashboard");
  };

  const handleApple = async () => {
    setAuthError(null);
    setAppleLoading(true);
    markOAuthRedirect("/dashboard");
    const result = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setAppleLoading(false);
      setAuthError(`Apple sign-in failed. ${result.error.message}`);
      return;
    }
    if (result.redirected) return;
    navigate("/dashboard");
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (captchaConfigured && !captchaToken) {
      setAuthError("Complete the security check. Please verify you are human before creating an account.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: fullName },
        captchaToken: captchaToken || undefined,
      },
    });
    captchaRef.current?.reset();
    setLoading(false);
    if (error) {
      setAuthError(`Account creation failed. ${error.message}`);
    } else if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      toast({
        title: "Account already exists",
        description: "An account with this email already exists. Try logging in instead.",
      });
      navigate("/login");
    } else {
      track("signup_submit_success");
      const userId = data.user?.id;
      if (userId) {
        void sendEmail({
          templateName: "welcome",
          recipientEmail: email,
          userId,
          idempotencyKey: `welcome-${userId}`,
          data: { name: fullName || email.split("@")[0] },
        });
      }
      toast({ title: "Check your email", description: "We sent you a confirmation link." });
      navigate("/login");
    }
  };

  return (
    <AuthLayout appearance="landing" title="Create account" description="Start your client workflow with CloseSync AI.">
      <PageMeta title="Create your CloseSync AI account" description="Explore a connected workspace for client enquiries, proposals, agreements, payments and onboarding." path="/signup" noIndex />
      <div className="cs-auth-controls">
        <AuthFormError ref={authErrorRef} id="signup-auth-error" message={authError} />

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="cs-auth-social focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
          className="cs-auth-social focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M16.36 12.78c.02 2.6 2.28 3.47 2.31 3.48-.02.06-.36 1.24-1.19 2.45-.72 1.05-1.47 2.1-2.65 2.12-1.16.02-1.53-.69-2.85-.69-1.32 0-1.74.67-2.83.71-1.14.04-2.01-1.13-2.73-2.18-1.48-2.15-2.62-6.08-1.09-8.73.76-1.32 2.11-2.15 3.58-2.17 1.12-.02 2.17.75 2.85.75.68 0 1.96-.93 3.3-.79.56.02 2.14.23 3.15 1.71-.08.05-1.88 1.1-1.86 3.34M14.2 4.6c.6-.73 1.01-1.74.9-2.75-.87.04-1.92.58-2.54 1.3-.56.64-1.05 1.67-.92 2.66.97.07 1.96-.49 2.56-1.21"/>
          </svg>
          Continue with Apple
        </button>



        <div className="cs-auth-divider">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">Or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <form
          onSubmit={handleSignup}
          aria-busy={loading}
          aria-describedby={authError ? "signup-auth-error" : undefined}
          className="space-y-4"
        >
          <div>
            <Label htmlFor="fullName">Full name</Label>
            <Input
              id="fullName"
              name="name"
              autoComplete="name"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
                setAuthError(null);
              }}
              placeholder="First and last name"
              required
              className="cs-auth-input"
            />
          </div>
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
                setAuthError(null);
              }}
              placeholder="you@example.com"
              required
              className="cs-auth-input"
            />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <div className="cs-auth-password">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                aria-describedby="signup-password-requirements"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setAuthError(null);
                }}
                placeholder="Enter password"
                required
                minLength={8}
                className="cs-auth-input pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="cs-auth-password-toggle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p id="signup-password-requirements" className="text-xs text-muted-foreground mt-1.5">
              At least 8 characters
            </p>
            {password.length > 0 && (
              <div className="mt-2 flex items-center gap-2" role="status" aria-live="polite">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden="true">
                  <div
                    className={`h-full rounded-full transition-all duration-200 ${
                      passwordStrength === "Strong"
                        ? "w-full cs-auth-strength-strong"
                        : passwordStrength === "Good"
                          ? "w-2/3 cs-auth-strength-good"
                          : "w-1/3 cs-auth-strength-weak"
                    }`}
                  />
                </div>
                <span
                  className={`text-xs font-medium ${
                    passwordStrength === "Strong"
                      ? "cs-auth-strength-text-strong"
                      : passwordStrength === "Good"
                        ? "cs-auth-strength-text-good"
                        : "cs-auth-strength-text-weak"
                  }`}
                >
                  {passwordStrength}
                </span>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Pre-launch preview: our{" "}
            <a href="/terms" className="cs-auth-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Terms of Service</a> and{" "}
            <a href="/privacy" className="cs-auth-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Privacy Policy</a> are drafts. Please use a test account only until the final policies are published.
          </p>

          <AuthCaptcha ref={captchaRef} action="signup" onTokenChange={setCaptchaToken} />

          <Button
            type="submit"
            disabled={loading || (captchaConfigured && !captchaToken)}
            className="cs-auth-submit"
          >
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </div>

      <p className="cs-auth-switch">
        Already have an account?{" "}
        <Link to="/login" className="cs-auth-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Log in</Link>
      </p>
    </AuthLayout>
  );
}
