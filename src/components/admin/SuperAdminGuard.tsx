import { Navigate } from "react-router-dom";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";

export default function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const isAdmin = useIsSuperAdmin();
  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Checking access…
      </div>
    );
  }
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
