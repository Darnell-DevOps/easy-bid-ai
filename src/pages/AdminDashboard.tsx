import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip,
  BarChart, Bar,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Users, DollarSign, Activity, RefreshCw, MoreHorizontal, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type UserStats = {
  total_users: number;
  new_24h: number; new_7d: number; new_30d: number;
  active_7d: number; active_30d: number;
  signups_daily: { day: string; count: number }[];
};
type RevenueStats = {
  proposal_revenue_cents: number;
  proposal_paid_count: number;
  retainer_revenue_cents: number;
  retainer_paid_count: number;
  monthly: { month: string; cents: number }[];
};
type UsageStats = {
  proposals_total: number; proposals_sent: number; proposals_accepted: number; proposals_paid: number;
  contracts_total: number; contracts_signed: number;
  bookings_total: number; clients_total: number; retainers_active: number;
  emails_7d_sent: number; emails_7d_failed: number;
};
type UserRow = {
  user_id: string; email: string; full_name?: string | null; banned_until?: string | null;
  created_at: string; last_active: string;
  clients_count: number; proposals_count: number; contracts_signed: number;
  bookings_count: number; retainers_active: number; revenue_cents: number;
};
type AdminLogRow = {
  id: string; admin_user_id: string; admin_email: string | null;
  target_user_id: string | null; target_email: string | null;
  action_type: string; details: any; created_at: string;
};
type PaddleMetrics = {
  revenue: any; mrr: any; subscribers: any; window: { from: string; to: string };
} | null;

const fmtMoney = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format((cents ?? 0) / 100);

const fmtDate = (iso: string) => {
  if (!iso || iso.startsWith("1970")) return "—";
  return new Date(iso).toLocaleDateString();
};

const fmtDateTime = (iso: string) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
};

function isUserBanned(u: { banned_until?: string | null }): boolean {
  if (!u.banned_until) return false;
  const t = Date.parse(u.banned_until);
  if (Number.isNaN(t)) return false;
  return t > Date.now();
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [revenueStats, setRevenueStats] = useState<RevenueStats | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [paddle, setPaddle] = useState<PaddleMetrics>(null);
  const [paddleLoading, setPaddleLoading] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [actionsLog, setActionsLog] = useState<AdminLogRow[]>([]);
  const [loadingLog, setLoadingLog] = useState(false);

  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [editBusinessName, setEditBusinessName] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [rowBusy, setRowBusy] = useState<string | null>(null);

  const loadLog = async () => {
    setLoadingLog(true);
    const { data, error } = await supabase.rpc("admin_get_actions_log", { _limit: 100 });
    setLoadingLog(false);
    if (error) {
      toast({ title: "Failed to load admin log", description: error.message, variant: "destructive" });
      return;
    }
    setActionsLog((data as AdminLogRow[]) ?? []);
  };

  const invokeManage = async (payload: Record<string, unknown>) => {
    return supabase.functions.invoke("admin-manage-user", { body: payload });
  };

  const openEdit = (u: UserRow) => {
    setEditUser(u);
    setEditEmail(u.email ?? "");
    setEditFullName(u.full_name ?? "");
    setEditBusinessName("");
  };

  const submitEdit = async () => {
    if (!editUser) return;
    setEditBusy(true);
    const { error } = await invokeManage({
      action: "update_profile",
      target_user_id: editUser.user_id,
      email: editEmail !== editUser.email ? editEmail : undefined,
      full_name: editFullName,
      business_name: editBusinessName || undefined,
    });
    setEditBusy(false);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "User updated" });
    setEditUser(null);
    loadUsers(search);
    loadLog();
  };

  const sendReset = async (u: UserRow) => {
    setRowBusy(u.user_id);
    const { error } = await invokeManage({
      action: "reset_password",
      target_user_id: u.user_id,
      redirect_to: `${window.location.origin}/reset-password`,
    });
    setRowBusy(null);
    if (error) {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Password reset sent", description: `Email sent to ${u.email}` });
    loadLog();
  };

  const toggleSuspend = async (u: UserRow) => {
    const isBanned = isUserBanned(u);
    setRowBusy(u.user_id);
    const { error } = await invokeManage({
      action: isBanned ? "reactivate" : "suspend",
      target_user_id: u.user_id,
    });
    setRowBusy(null);
    if (error) {
      toast({ title: "Action failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: isBanned ? "User reactivated" : "User suspended" });
    loadUsers(search);
    loadLog();
  };

  const submitDelete = async () => {
    if (!deleteUser) return;
    setDeleteBusy(true);
    const { error } = await invokeManage({
      action: "delete",
      target_user_id: deleteUser.user_id,
    });
    setDeleteBusy(false);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "User deleted" });
    setDeleteUser(null);
    setDeleteConfirm("");
    loadUsers(search);
    loadLog();
  };

  const loadAll = async () => {
    const [u, r, g] = await Promise.all([
      supabase.rpc("admin_user_stats"),
      supabase.rpc("admin_revenue_stats"),
      supabase.rpc("admin_usage_stats"),
    ]);
    if (u.data) setUserStats(u.data as UserStats);
    if (r.data) setRevenueStats(r.data as RevenueStats);
    if (g.data) setUsageStats(g.data as UsageStats);
  };

  const loadUsers = async (q = "") => {
    setLoadingUsers(true);
    const { data, error } = await supabase.rpc("admin_user_list", {
      _search: q || null, _limit: 100, _offset: 0,
    });
    setLoadingUsers(false);
    if (error) {
      toast({ title: "Failed to load users", description: error.message, variant: "destructive" });
      return;
    }
    setUsers((data as UserRow[]) ?? []);
  };

  const loadPaddle = async () => {
    setPaddleLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-paddle-metrics");
    setPaddleLoading(false);
    if (error) {
      toast({ title: "Paddle metrics unavailable", description: error.message, variant: "destructive" });
      return;
    }
    setPaddle(data);
  };

  useEffect(() => {
    loadAll();
    loadUsers();
    loadPaddle();
    loadLog();
  }, []);

  const signupChart = useMemo(
    () => (userStats?.signups_daily ?? []).map(d => ({
      day: new Date(d.day).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      count: d.count,
    })),
    [userStats],
  );

  const monthlyRevChart = useMemo(
    () => (revenueStats?.monthly ?? []).map(d => ({
      month: new Date(d.month).toLocaleDateString(undefined, { month: "short", year: "2-digit" }),
      revenue: Math.round((d.cents ?? 0) / 100),
    })),
    [revenueStats],
  );

  const totalDbRevenue = (revenueStats?.proposal_revenue_cents ?? 0)
    + (revenueStats?.retainer_revenue_cents ?? 0);

  return (
    <DashboardLayout>
      <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Shield className="w-6 h-6" /> Founder Dashboard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Platform-wide stats. Only visible to super admins.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { loadAll(); loadPaddle(); loadUsers(search); }}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        {/* Users & growth */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" /> Users & growth
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Stat label="Total users" value={userStats?.total_users} />
            <Stat label="New 24h" value={userStats?.new_24h} />
            <Stat label="New 7d" value={userStats?.new_7d} />
            <Stat label="New 30d" value={userStats?.new_30d} />
            <Stat label="Active 7d" value={userStats?.active_7d} />
            <Stat label="Active 30d" value={userStats?.active_30d} />
          </div>
          <Card className="mt-4">
            <CardHeader><CardTitle className="text-sm font-medium">Signups · last 90 days</CardTitle></CardHeader>
            <CardContent>
              <div className="h-56">
                {signupChart.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No signups yet</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={signupChart}>
                      <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Revenue */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Revenue & MRR
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">From your database</CardTitle>
                <p className="text-xs text-muted-foreground">Recorded in your app (proposals + retainer invoices marked paid)</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-3xl font-semibold">{fmtMoney(totalDbRevenue)}</div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Sub label="Proposal revenue" value={fmtMoney(revenueStats?.proposal_revenue_cents ?? 0)} sub={`${revenueStats?.proposal_paid_count ?? 0} paid`} />
                  <Sub label="Retainer revenue" value={fmtMoney(revenueStats?.retainer_revenue_cents ?? 0)} sub={`${revenueStats?.retainer_paid_count ?? 0} invoices`} />
                </div>
                <div className="h-40 mt-2">
                  {monthlyRevChart.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">No paid revenue yet</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthlyRevChart}>
                        <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} formatter={(v: any) => `$${v}`} />
                        <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                  <span>From Paddle (live)</span>
                  <Button variant="ghost" size="sm" onClick={loadPaddle} disabled={paddleLoading}>
                    <RefreshCw className={`w-3.5 h-3.5 ${paddleLoading ? "animate-spin" : ""}`} />
                  </Button>
                </CardTitle>
                <p className="text-xs text-muted-foreground">Authoritative numbers from your payment provider</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {!paddle ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <>
                    <PaddleMetric label="MRR" data={paddle.mrr} />
                    <PaddleMetric label="Active subscribers" data={paddle.subscribers} isCount />
                    <PaddleMetric label="Revenue (last 30d)" data={paddle.revenue} />
                    <p className="text-xs text-muted-foreground pt-2">
                      Live revenue requires going live + verified Paddle account. May be empty in test mode.
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Product usage */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" /> Product usage
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Proposals" value={usageStats?.proposals_total} sub={`${usageStats?.proposals_sent ?? 0} sent · ${usageStats?.proposals_accepted ?? 0} accepted`} />
            <Stat label="Contracts" value={usageStats?.contracts_total} sub={`${usageStats?.contracts_signed ?? 0} signed`} />
            <Stat label="Bookings" value={usageStats?.bookings_total} />
            <Stat label="Clients" value={usageStats?.clients_total} />
            <Stat label="Active retainers" value={usageStats?.retainers_active} />
            <Stat label="Paid proposals" value={usageStats?.proposals_paid} />
            <Stat label="Emails sent (7d)" value={usageStats?.emails_7d_sent} />
            <Stat label="Emails failed (7d)" value={usageStats?.emails_7d_failed} />
          </div>
        </section>

        {/* Per-user drilldown */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" /> Per-user breakdown
          </h2>
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="Search by email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadUsers(search)}
                  className="max-w-sm"
                />
                <Button onClick={() => loadUsers(search)} disabled={loadingUsers}>Search</Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Last active</TableHead>
                      <TableHead className="text-right">Clients</TableHead>
                      <TableHead className="text-right">Proposals</TableHead>
                      <TableHead className="text-right">Signed</TableHead>
                      <TableHead className="text-right">Bookings</TableHead>
                      <TableHead className="text-right">Retainers</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingUsers && (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                    )}
                    {!loadingUsers && users.length === 0 && (
                      <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No users found</TableCell></TableRow>
                    )}
                    {!loadingUsers && users.map(u => (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-mono text-xs">{u.email}</TableCell>
                        <TableCell className="text-sm">{fmtDate(u.created_at)}</TableCell>
                        <TableCell className="text-sm">{fmtDate(u.last_active)}</TableCell>
                        <TableCell className="text-right">{u.clients_count}</TableCell>
                        <TableCell className="text-right">{u.proposals_count}</TableCell>
                        <TableCell className="text-right">{u.contracts_signed}</TableCell>
                        <TableCell className="text-right">{u.bookings_count}</TableCell>
                        <TableCell className="text-right">
                          {u.retainers_active > 0 ? <Badge variant="secondary">{u.retainers_active}</Badge> : 0}
                        </TableCell>
                        <TableCell className="text-right font-medium">{fmtMoney(u.revenue_cents)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}

function Stat({ label, value, sub }: { label: string; value?: number; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-1">{value ?? "—"}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function Sub({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function PaddleMetric({ label, data, isCount }: { label: string; data: any; isCount?: boolean }) {
  const series = data?.timeseries ?? [];
  const latest = series[series.length - 1];
  if (!latest) {
    return (
      <div className="flex justify-between items-center py-1.5 border-b border-border/40">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-sm">—</span>
      </div>
    );
  }
  const currency = data?.currency_code ?? "USD";
  const display = isCount
    ? Number(latest.count ?? latest.amount ?? 0).toLocaleString()
    : fmtMoney(Number(latest.amount ?? 0), currency);
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-border/40">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-semibold">{display}</span>
    </div>
  );
}
