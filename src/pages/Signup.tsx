import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/landing-analytics";
import { sendEmail } from "@/lib/email";

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
  const passwordStrength = getPasswordStrength(password);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    track("signup_view");
  }, []);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) {
      setGoogleLoading(false);
      toast({ title: "Google sign-in failed", description: error.message, variant: "destructive" });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
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
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left: form panel */}
      <div className="flex flex-col bg-muted/30 px-6 py-10 lg:px-16 lg:py-14">
        <Link to="/" className="text-xl font-semibold text-foreground tracking-tight">
          Close<span className="text-gradient-sync">Sync</span> <span className="text-foreground">AI</span>
        </Link>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-md">
            <div className="rounded-2xl border border-border bg-card shadow-sm p-7">
              <h1 className="text-xl font-semibold text-foreground mb-5">Create account</h1>

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

              <div className="flex items-center gap-3 my-5">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">Or</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="First and last name"
                    required
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <div className="relative mt-1.5">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      required
                      minLength={8}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">At least 8 characters</p>
                  {password.length > 0 && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-200 ${
                            passwordStrength === "Strong"
                              ? "w-full bg-emerald-500"
                              : passwordStrength === "Good"
                                ? "w-2/3 bg-amber-500"
                                : "w-1/3 bg-rose-500"
                          }`}
                        />
                      </div>
                      <span
                        className={`text-xs font-medium ${
                          passwordStrength === "Strong"
                            ? "text-emerald-500"
                            : passwordStrength === "Good"
                              ? "text-amber-500"
                              : "text-rose-500"
                        }`}
                      >
                        {passwordStrength}
                      </span>
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  By clicking 'Create account', I agree to CloseSync's{" "}
                  <a href="/terms" className="text-accent hover:underline">Terms of Service</a> and{" "}
                  <a href="/privacy" className="text-accent hover:underline">Privacy Policy</a>.
                </p>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                >
                  {loading ? "Creating account…" : "Create account"}
                </Button>
              </form>
            </div>

            <p className="text-center text-sm text-muted-foreground mt-5">
              Already have an account?{" "}
              <Link to="/login" className="text-accent hover:underline font-medium">Log in</Link>
            </p>
          </div>
        </div>
      </div>

      {/* Right: dark preview panel */}
      <div className="hidden lg:flex relative bg-[#0b0d12] items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--accent)/0.12),transparent_60%),radial-gradient(ellipse_at_bottom_left,hsl(var(--purple)/0.12),transparent_55%)]" />

        <div className="relative w-full max-w-md px-8">
          <div className="rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm p-6 shadow-2xl">
            <div className="space-y-3">
              <div className="flex">
                <div className="rounded-2xl rounded-tl-sm bg-white/[0.06] text-white/90 text-sm px-4 py-2.5 max-w-[80%]">
                  What do you want to build?
                </div>
              </div>
              <div className="flex justify-end">
                <div className="rounded-2xl rounded-tr-sm bg-accent text-accent-foreground text-sm px-4 py-2.5 max-w-[85%]">
                  I want to send polished proposals and invoices to my clients in under 2 minutes.
                </div>
              </div>
              <div className="flex">
                <div className="rounded-2xl rounded-tl-sm bg-white/[0.06] text-white/90 text-sm px-4 py-2.5 max-w-[80%]">
                  Great, create an account to continue.
                </div>
              </div>
            </div>
          </div>

          <p className="text-white/60 text-sm text-center mt-6">
            Close more deals with AI-drafted proposals, contracts, and follow-ups.
          </p>
        </div>
      </div>
    </div>
  );
}
