import PageMeta from "@/components/PageMeta";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setSent(true);
      toast({ title: "Check your inbox", description: "We sent you a password reset link." });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <PageMeta title="Reset your password | CloseSync AI" description="Request a secure password reset link for your CloseSync AI account." path="/forgot-password" noIndex />
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="text-xl font-semibold text-foreground tracking-tight">
            Close<span className="text-gradient-sync">Sync</span> <span className="text-foreground">AI</span>
          </Link>
          <h1 className="text-2xl font-semibold text-foreground mt-4">Reset your CloseSync AI password</h1>
          <p className="text-muted-foreground text-sm mt-2">We'll email you a secure reset link</p>
        </div>
        <Card className="border-border">
          <CardContent className="p-6">
            {sent ? (
              <div className="text-sm text-muted-foreground space-y-3">
                <p>If an account exists for <span className="text-foreground">{email}</span>, you'll receive a reset link shortly.</p>
                <p>Check your spam folder if you don't see it.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
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
                <Button
                  type="submit"
                  disabled={loading}
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
          <Link to="/login" className="text-accent hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
