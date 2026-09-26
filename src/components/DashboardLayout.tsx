import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { performSignOut } from "@/lib/logout";
import {
  LayoutDashboard, FileText, Plus, Settings, LogOut, Menu, LayoutTemplate, Users, MessagesSquare,
  ScrollText, Calendar, FileSignature, ClipboardList, Repeat, LifeBuoy, Mail,
  Shield, Star, ChevronLeft, ChevronRight, CreditCard, TrendingUp, Eye, Trash2, Rocket, ChevronDown, CircleUserRound, BriefcaseBusiness, FolderOpen,
} from "lucide-react";
import { useIsSuperAdmin } from "@/hooks/useIsSuperAdmin";
import { useUnreadLeadsCount } from "@/hooks/use-unread-leads";

type NavItem = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badgeKey?: "leads" | "recovery" | "emails";
};

type NavGroup = { label: string; icon: NavItem["icon"]; items: NavItem[] };

const dailyItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Clients", icon: Users, href: "/dashboard/clients" },
  { label: "Lead Inbox", icon: Mail, href: "/dashboard/lead-inbox" },
  { label: "Calendar", icon: Calendar, href: "/dashboard/calendar" },
  { label: "Emails", icon: Mail, href: "/dashboard/emails", badgeKey: "emails" },
];

const navGroups: NavGroup[] = [
  {
    label: "Sales", icon: BriefcaseBusiness,
    items: [

      { label: "Lead Assistant", icon: MessagesSquare, href: "/dashboard/leads", badgeKey: "leads" },
      { label: "Lead Forms", icon: ClipboardList, href: "/dashboard/lead-forms" },

      { label: "Proposals", icon: FileText, href: "/dashboard/proposals" },
      { label: "Contracts", icon: FileSignature, href: "/dashboard/contracts" },
    ],
  },
  {
    label: "Finance", icon: CreditCard,
    items: [
      { label: "Revenue", icon: TrendingUp, href: "/dashboard/revenue" },
      { label: "Retainers", icon: Repeat, href: "/dashboard/retainers" },
      { label: "Recovery", icon: LifeBuoy, href: "/dashboard/recovery", badgeKey: "recovery" },
    ],
  },
  {
    label: "Delivery", icon: ClipboardList,
    items: [
      { label: "Open Client Portal", icon: Eye, href: "/dashboard/client-portal" },

      { label: "Onboarding", icon: ClipboardList, href: "/dashboard/onboarding" },
      { label: "Kickoff", icon: Rocket, href: "/dashboard/kickoff" },


    ],
  },
  {
    label: "Resources", icon: FolderOpen,
    items: [
      { label: "Templates", icon: LayoutTemplate, href: "/dashboard/templates" },
      { label: "Policies", icon: ScrollText, href: "/dashboard/policies" },
      { label: "Testimonials", icon: Star, href: "/dashboard/testimonials" },


    ],
  },
];

navGroups.sort((a, b) => ["Sales", "Delivery", "Finance", "Resources"].indexOf(a.label) - ["Sales", "Delivery", "Finance", "Resources"].indexOf(b.label));

const isActiveRoute = (path: string, href: string) => path === href || (href !== "/dashboard" && path.startsWith(`${href}/`));
const GROUPS_KEY = "cs.sidebar.groups";
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

  if (collapsed) return null;

  return (
    <div className="cs-workspace-status">
      <div><CreditCard aria-hidden="true" /><span>{stats?.plan ?? "—"}</span></div>
      <p>{stats?.clients ?? "—"} clients <span aria-hidden="true">·</span> {stats ? `£${(stats.mrr / 1000).toFixed(1)}k` : "—"} MRR</p>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileNavigationRouteClose = useRef(false);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; }
  });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(GROUPS_KEY) || "{}");
      return Object.fromEntries(navGroups.map(group => [group.label, saved?.[group.label] === true]));
    } catch { return {}; }
  });
  const menuRouteClose = useRef(false);
  useEffect(() => {
    const active = navGroups.find(group => group.items.some(item => isActiveRoute(location.pathname, item.href)));
    if (active) setExpandedGroups(previous => previous[active.label] ? previous : { ...previous, [active.label]: true });
  }, [location.pathname]);
  useEffect(() => {
    try { window.localStorage.setItem(GROUPS_KEY, JSON.stringify(expandedGroups)); } catch { /* Navigation remains usable without storage. */ }
  }, [expandedGroups]);
  const [loggingOut, setLoggingOut] = useState(false);
  const isAdmin = useIsSuperAdmin();
  const unreadLeads = useUnreadLeadsCount();

  useEffect(() => {
    try { window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0"); } catch { /* Keep the current session preference. */ }
  }, [collapsed]);

  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") navigate("/login");
    });
  }, [navigate]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    await performSignOut("/login");
  };

  const badges = useMemo<Record<string, number>>(() => ({
    leads: unreadLeads || 0,
    recovery: 0,
    emails: 0,
  }), [unreadLeads]);

  const closeMobileNavigationForRoute = (href: string) => {
    mobileNavigationRouteClose.current = href !== location.pathname;
    setMobileOpen(false);
  };

  const renderNavItem = (item: NavItem, isMobile = false) => {
    const active = isActiveRoute(location.pathname, item.href);
    const badge = item.badgeKey ? badges[item.badgeKey] : 0;
    const showCompact = collapsed && !isMobile;

    const row = (
      <Link
        key={item.href}
        to={item.href}
        onClick={isMobile ? () => closeMobileNavigationForRoute(item.href) : undefined}
        aria-label={showCompact ? item.label : undefined}
        aria-current={active ? "page" : undefined}
        className={`cs-workspace-nav-link${showCompact ? " cs-workspace-nav-link-compact" : ""}`}
      >
        <item.icon aria-hidden="true" />
        {!showCompact && <span className="flex-1 truncate">{item.label}</span>}
        {!showCompact && badge > 0 && (
          <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
        {showCompact && badge > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
        )}
      </Link>
    );

    if (showCompact) {
      return (
        <Tooltip key={item.href} delayDuration={100}>
          <TooltipTrigger asChild>{row}</TooltipTrigger>
          <TooltipContent side="right" className="flex items-center gap-2">
            <span>{item.label}</span>
            {badge > 0 && (
              <span className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
                {badge}
              </span>
            )}
          </TooltipContent>
        </Tooltip>
      );
    }
    return row;
  };

  const renderNavContent = (isMobile = false) => {
    const showCompact = collapsed && !isMobile;
    return (
      <>
        <div className="cs-workspace-brand-area">
          <Link to="/dashboard" aria-label="CloseSync AI dashboard" className="cs-workspace-brand"
            onClick={isMobile ? () => closeMobileNavigationForRoute("/dashboard") : undefined}>
            <img src="/closesync-mark.png" alt="" width="32" height="32" />
            {!showCompact && <span>CloseSync <small>AI</small></span>}
          </Link>
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <Link to="/dashboard/new" aria-label="New Proposal"
                onClick={isMobile ? () => closeMobileNavigationForRoute("/dashboard/new") : undefined}
                className="cs-workspace-create">
                <Plus aria-hidden="true" />
                {!showCompact && <span>New Proposal</span>}
              </Link>
            </TooltipTrigger>
            {showCompact && <TooltipContent side="right">New Proposal</TooltipContent>}
          </Tooltip>
        </div>

        {/* Nav groups */}
        <nav
          aria-label={isMobile ? "Dashboard navigation" : "Primary dashboard navigation"}
          className="cs-workspace-nav"
        >
          {dailyItems.map(item => renderNavItem(item, isMobile))}
          <div className="cs-workspace-groups">
            {navGroups.map(group => {
              const active = group.items.some(item => isActiveRoute(location.pathname, item.href));
              const expanded = !!expandedGroups[group.label];
              const id = `cs-nav-${isMobile ? "mobile" : "desktop"}-${group.label.toLowerCase()}`;
              const trigger = <button type="button" className={`cs-workspace-nav-link cs-workspace-group-trigger${showCompact ? " cs-workspace-nav-link-compact" : ""}`} aria-label={group.label} data-active={active || undefined}>
                <group.icon aria-hidden="true" />
                {!showCompact && <><span className="flex-1 text-left">{group.label}</span><ChevronDown aria-hidden="true" className={expanded ? "rotate-180" : ""} /></>}
              </button>;
              if (showCompact) return <DropdownMenu key={group.label}>
                <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" onCloseAutoFocus={event => { if (menuRouteClose.current) { event.preventDefault(); menuRouteClose.current = false; } }}>
                  <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                  {group.items.map(item => <DropdownMenuItem key={item.href} asChild><Link to={item.href} aria-current={isActiveRoute(location.pathname, item.href) ? "page" : undefined} onClick={() => { menuRouteClose.current = item.href !== location.pathname; }}><item.icon aria-hidden="true" className="mr-2 h-4 w-4" />{item.label}</Link></DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>;
              return <div key={group.label}>
                <button type="button" className="cs-workspace-nav-link cs-workspace-group-trigger" data-active={active || undefined} aria-expanded={expanded} aria-controls={id} onClick={() => setExpandedGroups(previous => ({ ...previous, [group.label]: !previous[group.label] }))}>
                  <group.icon aria-hidden="true" /><span className="flex-1 text-left">{group.label}</span><ChevronDown aria-hidden="true" className={expanded ? "rotate-180" : ""} />
                </button>
                <div id={id} hidden={!expanded} className="cs-workspace-group-items">{group.items.map(item => renderNavItem(item, isMobile))}</div>
              </div>;
            })}
          </div>
        </nav>

        <div className="cs-workspace-footer">
          <div className="px-2 pb-3">
            {renderNavItem({ label: "Settings", icon: Settings, href: "/dashboard/settings" }, isMobile)}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Account" className={`cs-workspace-nav-link cs-workspace-group-trigger${showCompact ? " cs-workspace-nav-link-compact" : ""}`}>
                  <CircleUserRound aria-hidden="true" />{!showCompact && <><span className="flex-1 text-left">Account</span><ChevronDown aria-hidden="true" /></>}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side={showCompact ? "right" : "top"} align="start" className="cs-workspace-account-menu" onCloseAutoFocus={event => { if (menuRouteClose.current) { event.preventDefault(); menuRouteClose.current = false; } }}>
                <DropdownMenuLabel>Workspace account</DropdownMenuLabel>
                <QuickStatus collapsed={false} />
                <DropdownMenuSeparator />
                {[{ label: "Trash", icon: Trash2, href: "/dashboard/trash" }, ...(isAdmin ? [{ label: "Admin", icon: Shield, href: "/admin" }] : [])].map(item => <DropdownMenuItem key={item.href} asChild><Link to={item.href} onClick={() => { menuRouteClose.current = item.href !== location.pathname; if (isMobile) closeMobileNavigationForRoute(item.href); }}><item.icon aria-hidden="true" className="mr-2 h-4 w-4" />{item.label}</Link></DropdownMenuItem>)}
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleLogout} disabled={loggingOut}><LogOut aria-hidden="true" className="mr-2 h-4 w-4" />{loggingOut ? "Logging out…" : "Log out"}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </>
    );
  };

  return (
    <TooltipProvider>
      <div className="cs-workspace-shell flex flex-col md:flex-row bg-background">
        {/* Desktop sidebar */}
        <aside
          className={`cs-workspace-sidebar hidden md:flex flex-col bg-sidebar border-r border-sidebar-border flex-shrink-0 transition-[width] duration-200 ease-out ${
            collapsed ? "w-[64px]" : "w-60"
          }`}
        >
          {renderNavContent()}
          {/* Collapse toggle */}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
            className="absolute -right-3 top-7 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border flex items-center justify-center text-sidebar-foreground/60 hover:text-sidebar-foreground hover:border-accent/50 transition-colors z-10"
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </aside>

        {/* Mobile header */}
        <div className="cs-workspace-mobile-header md:hidden flex-shrink-0 h-14 bg-sidebar border-b border-sidebar-border flex items-center justify-between px-4 z-50">
          <Link to="/dashboard" aria-label="CloseSync AI dashboard" className="cs-workspace-brand">
            <img src="/closesync-mark.png" alt="" width="32" height="32" />
            <span>CloseSync <small>AI</small></span>
          </Link>
          <Sheet
            open={mobileOpen}
            onOpenChange={(open) => {
              if (open) mobileNavigationRouteClose.current = false;
              setMobileOpen(open);
            }}
          >
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-sidebar-foreground"
                aria-label="Open dashboard navigation"
              >
                <Menu aria-hidden="true" className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              id="dashboard-mobile-navigation"
              side="left"
              className="cs-workspace-drawer inset-y-0 h-full w-64 bg-sidebar p-0 text-sidebar-foreground"
              onCloseAutoFocus={(event) => {
                if (!mobileNavigationRouteClose.current) return;
                event.preventDefault();
                mobileNavigationRouteClose.current = false;
              }}
            >
              <SheetTitle className="sr-only">Dashboard navigation</SheetTitle>
              <SheetDescription className="sr-only">
                Choose a CloseSync dashboard area.
              </SheetDescription>
              <div className="flex h-full flex-col">
                {renderNavContent(true)}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Main content */}
        <main id="dashboard-main" tabIndex={-1} className="flex-1 min-w-0 min-h-0 overflow-auto">
          <div className="px-4 sm:px-6 md:px-10 py-5 md:py-8 max-w-[1600px] mx-auto">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
}
