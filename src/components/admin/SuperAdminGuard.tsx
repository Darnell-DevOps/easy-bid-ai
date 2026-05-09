import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield } from "lucide-react";

export default function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const isAdmin = useIsSuperAdmin();
  const { toast } = useToast();
  const [claiming, setClaiming] = useState(false);

  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Checking access…
      </div>
    );
  }
  if (isAdmin) return <>{children}</>;

  const claim = async () => {
    setClaiming(true);
    const { error } = await supabase.rpc("admin_grant_self_super_admin", { _secret: "" });
    setClaiming(false);
    if (error) {
      toast({ title: "Cannot claim admin", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "You're now super admin", description: "Reloading…" });
    setTimeout(() => window.location.reload(), 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <Shield className="w-10 h-10 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-semibold">Founder access required</h1>
        <p className="text-sm text-muted-foreground">
          This area is for the platform owner. If you built this app and no super admin
          exists yet, you can claim the role below — this works only once.
        </p>
        <div className="flex gap-2 justify-center">
          <Button onClick={claim} disabled={claiming}>
            {claiming ? "Claiming…" : "Claim super admin"}
          </Button>
          <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
            Back to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
