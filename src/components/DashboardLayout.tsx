import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Plus, CreditCard, Settings, LogOut, Menu, X, LayoutTemplate, Users, Sparkles, ScrollText, Calendar, FileSignature } from "lucide-react";

const navItems = [
  { label: "New Proposal", icon: Plus, href: "/dashboard/new" },
  { label: "Saved Proposals", icon: FileText, href: "/dashboard" },
  { label: "Clients", icon: Users, href: "/dashboard/clients" },
  { label: "Contracts", icon: FileSignature, href: "/dashboard/contracts" },
  { label: "Calendar", icon: Calendar, href: "/dashboard/calendar" },
  { label: "Lead Assistant", icon: Sparkles, href: "/dashboard/leads" },
  { label: "Policies", icon: ScrollText, href: "/dashboard/policies" },
  { label: "Templates", icon: LayoutTemplate, href: "/dashboard/templates" },
  { label: "Billing", icon: CreditCard, href: "/dashboard/billing" },
  { label: "Settings", icon: Settings, href: "/dashboard/settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate("/login");
    });
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const NavContent = () => (
    <>
      <div className="p-6">
        <Link to="/dashboard" className="text-lg font-semibold text-sidebar-foreground tracking-tight">
          Close<span className="text-gradient-sync">Sync</span> <span className="text-sidebar-foreground">AI</span>
        </Link>
      </div>
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const active = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 w-full transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-col bg-sidebar border-r border-sidebar-border flex-shrink-0">
        <NavContent />
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 z-50">
        <span className="text-lg font-semibold text-sidebar-foreground tracking-tight">
          Close<span className="text-gradient-sync">Sync</span> <span className="text-sidebar-foreground">AI</span>
        </span>
        <Button variant="ghost" size="sm" onClick={() => setMobileOpen(!mobileOpen)} className="text-sidebar-foreground">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-foreground/20" onClick={() => setMobileOpen(false)} />
          <aside className="absolute top-14 left-0 bottom-0 w-60 bg-sidebar flex flex-col">
            <NavContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 md:pt-0 pt-14 overflow-auto">
        <div className="px-4 sm:px-6 md:px-10 py-6 md:py-8 max-w-[1600px] mx-auto content-glow">{children}</div>
      </main>
    </div>
  );
}
