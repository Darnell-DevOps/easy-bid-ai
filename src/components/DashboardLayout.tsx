import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText, Plus, Settings, LogOut, Menu, X, LayoutTemplate, Users, Sparkles,
  ScrollText, Calendar, FileSignature, ClipboardList, Repeat, LifeBuoy, Mail,
  Shield, Star, ChevronLeft, ChevronRight, CreditCard, TrendingUp, Eye, Trash2,
} from "lucide-react";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { useUnreadLeadsCount } from "@/hooks/use-unread-leads";

type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badgeKey?: "leads" | "recovery" | "emails";
};

type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "Sales",
    items: [
      { label: "Dashboard", icon: FileText, href: "/dashboard" },
      { label: "Clients", icon: Users, href: "/dashboard/clients" },
      { label: "Lead Assistant", icon: Sparkles, href: "/dashboard/leads", badgeKey: "leads" },
      { label: "Lead Forms", icon: ClipboardList, href: "/dashboard/lead-forms" },
      { label: "Lead Inbox", icon: Mail, href: "/dashboard/lead-inbox" },
      { label: "Proposals", icon: FileText, href: "/dashboard/proposals" },
      { label: "Contracts", icon: FileSignature, href: "/dashboard/contracts" },
    ],
  },
  {
    label: "Client Portal",
    items: [
      { label: "Open Client Portal", icon: Eye, href: "/dashboard/client-portal" },
    ],
  },
  {
    label: "Revenue",
    items: [
      { label: "Revenue", icon: TrendingUp, href: "/dashboard/revenue" },
      { label: "Retainers", icon: Repeat, href: "/dashboard/retainers" },
      { label: "Recovery", icon: LifeBuoy, href: "/dashboard/recovery", badgeKey: "recovery" },
    ],
  },
  {
    label: "Delivery",
    items: [
      { label: "Calendar", icon: Calendar, href: "/dashboard/calendar" },
      { label: "Onboarding", icon: ClipboardList, href: "/dashboard/onboarding" },
      { label: "Kickoff", icon: FileSignature, href: "/dashboard/kickoff" },
    ],
  },
  {
    label: "Communication",
    items: [
      { label: "Emails", icon: Mail, href: "/dashboard/emails", badgeKey: "emails" },
      { label: "Testimonials", icon: Star, href: "/dashboard/testimonials" },
    ],
  },
  {
    label: "Resources",
    items: [
      { label: "Templates", icon: LayoutTemplate, href: "/dashboard/templates" },
      { label: "Policies", icon: ScrollText, href: "/dashboard/policies" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Settings", icon: Settings, href: "/dashboard/settings" },
      { label: "Trash", icon: Trash2, href: "/dashboard/trash" },
    ],
  },
];

const COLLAPSE_KEY = "cs.sidebar.collapsed";

function QuickStatus({ collapsed }: { collapsed: boolean }) {
  const [stats, setStats] = useState<{ plan: string; clients: number; mrr: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { count } = await supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if (!cancelled) {
        setStats({ plan: "Professional", clients: count || 0, mrr: 0 });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (collapsed) {
    return (
      <div className="px-2 py-3 flex justify-center">
        <div className="w-9 h-9 rounded-md bg-gradient-to-br from-accent/20 to-purple/20 border border-sidebar-border/60 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-accent" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-3 mb-2 p-3 rounded-lg bg-gradient-to-br from-sidebar-accent/40 to-transparent border border-sidebar-border/60">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-sidebar-foreground/50 font-semibold">Current Plan</span>
        <CreditCard className="w-3 h-3 text-sidebar-foreground/40" />
      </div>
      <div className="text-sm font-semibold text-sidebar-foreground mb-2">{stats?.plan ?? "—"}</div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <div className="text-sidebar-foreground/50">Clients</div>
          <div className="text-sidebar-foreground font-medium">{stats?.clients ?? "—"}</div>
        </div>
        <div>
          <div className="text-sidebar-foreground/50">MRR</div>
          <div className="text-sidebar-foreground font-medium">
            {stats ? `£${(stats.mrr / 1000).toFixed(1)}k` : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  });
  const isAdmin = useIsSuperAdmin();
  const unreadLeads = useUnreadLeadsCount();

  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate("/login");
    });
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const badges = useMemo<Record<string, number>>(() => ({
    leads: unreadLeads || 0,
    recovery: 0,
    emails: 0,
  }), [unreadLeads]);

  const NavItemRow = ({ item, isMobile = false }: { item: NavItem; isMobile?: boolean }) => {
    const active = location.pathname === item.href;
    const badge = item.badgeKey ? badges[item.badgeKey] : 0;
    const showCompact = collapsed && !isMobile;

    const row = (
      <Link
        to={item.href}
        onClick={() => setMobileOpen(false)}
        className={`group relative flex items-center gap-3 rounded-md text-sm transition-all duration-200 ${
          showCompact ? "justify-center px-0 py-2.5 mx-2" : "px-3 py-2"
        } ${
          active
            ? "bg-gradient-to-r from-accent/15 via-accent/5 to-transparent text-sidebar-foreground font-medium shadow-[inset_0_0_0_1px_hsl(var(--accent)/0.15)]"
            : "text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
        }`}
      >
        {active && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-gradient-to-b from-accent to-purple shadow-[0_0_8px_hsl(var(--accent)/0.6)]" />
        )}
        <item.icon
          className={`w-4 h-4 flex-shrink-0 transition-colors ${
            active ? "text-accent" : "text-sidebar-foreground/55 group-hover:text-sidebar-foreground/90"
          }`}
        />
        {!showCompact && <span className="flex-1 truncate">{item.label}</span>}
        {!showCompact && badge > 0 && (
          <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-accent/90 text-accent-foreground text-[10px] font-semibold">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
        {showCompact && badge > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-accent shadow-[0_0_6px_hsl(var(--accent)/0.8)]" />
        )}
      </Link>
    );

    if (showCompact) {
      return (
        <Tooltip delayDuration={100}>
          <TooltipTrigger asChild>{row}</TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            <span>{item.label}</span>
            {badge > 0 && (
              <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold">
                {badge}
              </span>
            )}
          </TooltipContent>
        </Tooltip>
      );
    }
    return row;
  };

  const NavContent = ({ isMobile = false }: { isMobile?: boolean }) => {
    const showCompact = collapsed && !isMobile;
    return (
      <>
        {/* Header */}
        <div className={`${showCompact ? "px-2 pt-5 pb-4" : "px-5 pt-5 pb-4"}`}>
          <Link to="/dashboard" className="block">
            {showCompact ? (
              <div className="w-9 h-9 mx-auto rounded-md bg-gradient-to-br from-accent to-purple flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-accent/20">
                C
              </div>
            ) : (
              <>
                <div className="text-base font-semibold text-sidebar-foreground tracking-tight leading-tight">
                  Close<span className="text-gradient-sync">Sync</span> <span className="text-sidebar-foreground/90">AI</span>
                </div>
                <div className="text-[10px] uppercase tracking-[0.15em] text-sidebar-foreground/40 mt-1 font-medium">
                  by StriveSync
                </div>
              </>
            )}
          </Link>

          {/* Primary CTA */}
          <div className={showCompact ? "mt-4" : "mt-4"}>
            {showCompact ? (
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Link
                    to="/dashboard/new"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center justify-center w-9 h-9 mx-auto rounded-md bg-gradient-to-r from-accent to-purple text-white shadow-md shadow-accent/25 hover:brightness-110 transition"
                  >
                    <Plus className="w-4 h-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">New Proposal</TooltipContent>
              </Tooltip>
            ) : (
              <Link
                to="/dashboard/new"
                onClick={() => setMobileOpen(false)}
                className="flex items-center justify-center gap-2 w-full h-9 rounded-md bg-gradient-to-r from-accent to-purple text-white text-sm font-medium shadow-md shadow-accent/25 hover:brightness-110 transition"
              >
                <Plus className="w-4 h-4" />
                New Proposal
              </Link>
            )}
          </div>
        </div>

        {/* Nav groups */}
        <nav className={`flex-1 overflow-y-auto ${showCompact ? "px-0 pb-2" : "px-2 pb-2"} space-y-4`}>
          {navGroups.map((group) => (
            <div key={group.label}>
              {!showCompact && (
                <div className="px-3 pt-1 pb-1.5 text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/40 font-semibold">
                  {group.label}
                </div>
              )}
              {showCompact && <div className="mx-3 my-2 h-px bg-sidebar-border/40" />}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavItemRow key={item.href} item={item} isMobile={isMobile} />
                ))}
              </div>
            </div>
          ))}

          {isAdmin && (
            <div>
              {!showCompact && (
                <div className="px-3 pt-1 pb-1.5 text-[10px] uppercase tracking-[0.12em] text-sidebar-foreground/40 font-semibold">
                  Admin
                </div>
              )}
              {showCompact && <div className="mx-3 my-2 h-px bg-sidebar-border/40" />}
              <NavItemRow item={{ label: "Admin", icon: Shield, href: "/admin" }} isMobile={isMobile} />
            </div>
          )}
        </nav>

        {/* Quick status */}
        <div className="border-t border-sidebar-border/50 pt-2">
          <QuickStatus collapsed={showCompact} />

          {/* Footer actions */}
          <div className={`${showCompact ? "px-2 pb-3" : "px-3 pb-3"} space-y-1`}>
            {showCompact ? (
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleLogout}
                    className="flex items-center justify-center w-full h-9 rounded-md text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Log out</TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 w-full transition"
              >
                <LogOut className="w-4 h-4" />
                Log out
              </button>
            )}
          </div>
        </div>
      </>
    );
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen flex bg-background">
        {/* Desktop sidebar */}
        <aside
          className={`hidden md:flex flex-col bg-sidebar border-r border-sidebar-border flex-shrink-0 relative transition-[width] duration-200 ease-out ${
            collapsed ? "w-[64px]" : "w-60"
          }`}
        >
          <NavContent />
          {/* Collapse toggle */}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="absolute -right-3 top-7 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border flex items-center justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground hover:border-accent/50 hover:shadow-[0_0_10px_hsl(var(--accent)/0.3)] transition z-10"
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </aside>

        {/* Mobile header */}
        <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 z-50">
          <span className="text-base font-semibold text-sidebar-foreground tracking-tight">
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
            <aside className="absolute top-14 left-0 bottom-0 w-64 bg-sidebar flex flex-col border-r border-sidebar-border">
              <NavContent isMobile />
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 min-w-0 md:pt-0 pt-14 overflow-auto">
          <div className="px-4 sm:px-6 md:px-10 py-5 md:py-8 max-w-[1600px] mx-auto content-glow">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}
