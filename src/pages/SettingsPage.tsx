import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { User, KeyRound, CreditCard, Palette, Lock, LifeBuoy, ExternalLink, Mail } from "lucide-react";
import InboundEmailSettings from "@/components/settings/InboundEmailSettings";

export default function SettingsPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [proposalCount, setProposalCount] = useState(0);
  const [loadingReset, setLoadingReset] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email || "");

        // Count proposals this month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const { count } = await supabase
          .from("proposals")
          .select("id", { count: "exact", head: true })
          .gte("created_at", startOfMonth);
        setProposalCount(count || 0);
      }
    };
    load();
  }, []);

  const handleResetPassword = async () => {
    setLoadingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setLoadingReset(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password reset email sent", description: "Check your inbox for the reset link." });
    }
  };

  const currentPlan = "Free";
  const proposalLimit = 3;

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account, plan, and preferences</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Account Section */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <User className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Account</h2>
                <p className="text-xs text-muted-foreground">Your login details</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Email address</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-foreground">{email}</span>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Password</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetPassword}
                  disabled={loadingReset}
                >
                  {loadingReset ? "Sending..." : "Reset Password"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plan Section */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Plan</h2>
                <p className="text-xs text-muted-foreground">Your current subscription</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{currentPlan} Plan</span>
                    <Badge variant="secondary" className="text-xs">Current</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">£0/month</p>
                </div>
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Proposals this month</span>
                  <span className="text-sm font-medium text-foreground">
                    {proposalCount} / {proposalLimit}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${Math.min((proposalCount / proposalLimit) * 100, 100)}%` }}
                  />
                </div>
                {proposalCount >= proposalLimit && (
                  <p className="text-xs text-destructive mt-2">You've reached your free limit this month.</p>
                )}
              </div>

              <Button
                className="w-full bg-gradient-to-r from-accent to-purple text-accent-foreground hover:brightness-110 gap-2"
                onClick={() => toast({ title: "Coming soon", description: "Pro plan payments will be available shortly." })}
              >
                Upgrade to Pro — £9/month
              </Button>
            </div>
          </CardContent>
        </Card>

        <InboundEmailSettings />

        {/* Branding Section */}
        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <Palette className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Branding</h2>
                <p className="text-xs text-muted-foreground">Customise your proposal look</p>
              </div>
            </div>

            <div className="space-y-3 opacity-50 pointer-events-none select-none">
              <div>
                <Label className="text-xs text-muted-foreground">Company Name</Label>
                <Input placeholder="Your company name" disabled className="mt-1.5" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Logo</Label>
                <div className="mt-1.5 h-20 rounded-lg border border-dashed border-border flex items-center justify-center">
                  <span className="text-xs text-muted-foreground">Upload your logo</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-sm">
              <Lock className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Available on</span>
              <Badge variant="outline" className="border-accent/30 text-accent text-xs">Pro</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Support Section */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <LifeBuoy className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">Support</h2>
                <p className="text-xs text-muted-foreground">Get help when you need it</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="gap-2 flex-1"
                onClick={() => window.open("mailto:support@closesync.io", "_blank")}
              >
                <Mail className="w-4 h-4" /> Contact Support
              </Button>
              <Button
                variant="outline"
                className="gap-2 flex-1"
                onClick={() => toast({ title: "Coming soon", description: "Help centre is being built." })}
              >
                <ExternalLink className="w-4 h-4" /> Help & FAQ
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
