import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { Button } from "@/components/ui/button";
import { Shield } from "lucide-react";

export default function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const isAdmin = useIsSuperAdmin();

  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Checking access…
      </div>
    );
  }
  if (isAdmin) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-4">
        <Shield className="w-10 h-10 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-semibold">Founder access required</h1>
        <p className="text-sm text-muted-foreground">
          You don't have permission to view this page.
        </p>
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => (window.location.href = "/dashboard")}>
            Back to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
