import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, Send, Loader2, AlertCircle, CheckCircle2, Ban, Clock } from "lucide-react";

type Range = "24h" | "7d" | "30d";

interface LogRow {
  id: string;
  template: string;
  recipient: string;
  status: string;
  subject: string | null;
  provider_id: string | null;
  error: string | null;
  created_at: string;
}

const TEMPLATE_NAMES = [
  "welcome",
  "proposal-sent",
  "contract-signature-reminder",
  "payment-confirmation",
  "payment-failed",
  "renewal-reminder",
  "retainer-notification",
  "booking-confirmation",
  "follow-up-reminder",
];

// Realistic sample data per template (matches what email-templates.ts expects).
const SAMPLE_DATA: Record<string, Record<string, unknown>> = {
  welcome: { name: "Alex" },
  "proposal-sent": {
    from_name: "Jordan at Acme",
    title: "Brand redesign — Q2 sprint",
    amount: "$4,500.00",
    url: "https://app.strivesync.io/proposal/view/sample",
  },
  "contract-signature-reminder": {
    from_name: "Jordan at Acme",
    title: "Service Agreement — Acme",
    url: "https://app.strivesync.io/sign/sample",
  },
  "payment-confirmation": {
    name: "Alex",
    amount: "$1,200.00",
    description: "Monthly retainer — May",
  },
  "payment-failed": {
    client_name: "Acme Co",
    amount: "$1,200.00",
    reason: "card_declined",
    severity: "warning",
  },
  "renewal-reminder": {
    client_name: "Acme Co",
    end_date: "2026-06-15",
    days_until: 14,
  },
  "retainer-notification": {
    subject: "Quick update on your retainer",
    heading: "Retainer update",
    message: "Your May invoice is ready and will charge tomorrow.",
  },
  "booking-confirmation": {
    name: "Alex",
    title: "Discovery call",
    when: "Friday, June 6 at 10:00 AM",
    location: "Google Meet",
  },
  "follow-up-reminder": {
    client_name: "Acme Co",
    context: "Proposal viewed, no response in 48h",
  },
};

function rangeStart(range: Range, customFrom?: string): Date {
  if (range === "24h") return new Date(Date.now() - 24 * 3600 * 1000);
  if (range === "7d") return new Date(Date.now() - 7 * 86400 * 1000);
  if (range === "30d") return new Date(Date.now() - 30 * 86400 * 1000);
  return customFrom ? new Date(customFrom) : new Date(Date.now() - 7 * 86400 * 1000);
}

const STATUS_BADGE: Record<string, { label: string; cls: string; Icon: any }> = {
  sent: { label: "Sent", cls: "bg-emerald-500/15 text-emerald-500 border-0", Icon: CheckCircle2 },
  failed: { label: "Failed", cls: "bg-red-500/15 text-red-400 border-0", Icon: AlertCircle },
  suppressed: { label: "Suppressed", cls: "bg-yellow-500/15 text-yellow-500 border-0", Icon: Ban },
  pending: { label: "Pending", cls: "bg-muted text-muted-foreground border-0", Icon: Clock },
};

const PAGE_SIZE = 50;

export default function EmailsDashboard() {
  const { toast } = useToast();
  const [range, setRange] = useState<Range>("7d");
  const [tplFilter, setTplFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<LogRow[]>([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0, suppressed: 0 });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const start = useMemo(() => rangeStart(range), [range]);

  const fetchAll = async () => {
    setLoading(true);
    let query = supabase
      .from("email_send_log")
      .select("id, template, recipient, status, subject, provider_id, error, created_at", { count: "exact" })
      .gte("created_at", start.toISOString())
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (tplFilter !== "all") query = query.eq("template", tplFilter);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    const { data } = await query;
    setRows((data as LogRow[]) || []);

    // Stats: separate count query per status (fast w/ index)
    const statsQuery = supabase
      .from("email_send_log")
      .select("status", { count: "exact", head: false })
      .gte("created_at", start.toISOString());
    const finalQ = tplFilter !== "all" ? statsQuery.eq("template", tplFilter) : statsQuery;
    const { data: statRows } = await finalQ;
    const all = (statRows as { status: string }[]) || [];
    setStats({
      total: all.length,
      sent: all.filter((r) => r.status === "sent").length,
      failed: all.filter((r) => r.status === "failed").length,
      suppressed: all.filter((r) => r.status === "suppressed").length,
    });
    setLoading(false);
  };

  useEffect(() => {
    setPage(0);
  }, [range, tplFilter, statusFilter]);

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, tplFilter, statusFilter, page]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Mail className="w-6 h-6 text-accent" /> Emails
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Delivery log for transactional emails sent from your workspace.
            </p>
          </div>
          <SendTestEmailButton onSent={fetchAll} />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <div className="flex gap-1">
              {(["24h", "7d", "30d"] as Range[]).map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={range === r ? "default" : "outline"}
                  onClick={() => setRange(r)}
                >
                  {r === "24h" ? "Last 24h" : r === "7d" ? "Last 7 days" : "Last 30 days"}
                </Button>
              ))}
            </div>
            <Select value={tplFilter} onValueChange={setTplFilter}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Template" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All templates</SelectItem>
                {TEMPLATE_NAMES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="suppressed">Suppressed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Sent" value={stats.sent} tone="emerald" />
          <StatCard label="Failed" value={stats.failed} tone="red" />
          <StatCard label="Suppressed" value={stats.suppressed} tone="yellow" />
        </div>

        {/* Log table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">
                No emails in this range yet. Try the "Send test email" button above.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const meta = STATUS_BADGE[r.status] || STATUS_BADGE.pending;
                    const isOpen = expanded === r.id;
                    return (
                      <>
                        <TableRow
                          key={r.id}
                          className={r.error ? "cursor-pointer" : ""}
                          onClick={() => r.error && setExpanded(isOpen ? null : r.id)}
                        >
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {timeAgo(r.created_at)}
                          </TableCell>
                          <TableCell className="text-sm font-medium text-foreground">{r.template}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{r.recipient}</TableCell>
                          <TableCell>
                            <Badge className={meta.cls}>
                              <meta.Icon className="w-3 h-3 mr-1" /> {meta.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                        {isOpen && r.error && (
                          <TableRow key={`${r.id}-err`}>
                            <TableCell colSpan={4} className="bg-muted/40 text-xs text-red-400 font-mono">
                              {r.error}
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">Page {page + 1}</span>
          <Button size="sm" variant="outline" disabled={rows.length < PAGE_SIZE} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "emerald" | "red" | "yellow" }) {
  const color =
    tone === "emerald" ? "text-emerald-500" :
    tone === "red" ? "text-red-400" :
    tone === "yellow" ? "text-yellow-500" :
    "text-foreground";
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className={`text-3xl font-bold mt-1 ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function SendTestEmailButton({ onSent }: { onSent: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState<string>("welcome");
  const [recipient, setRecipient] = useState<string>("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email && !recipient) setRecipient(data.user.email);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const send = async () => {
    if (!recipient || !template) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: {
        templateName: template,
        recipientEmail: recipient,
        idempotencyKey: `test-${template}-${Date.now()}`,
        data: SAMPLE_DATA[template] || {},
      },
    });
    setSending(false);
    if (error || (data as any)?.error) {
      toast({
        title: "Send failed",
        description: error?.message || (data as any)?.error || "Unknown error",
        variant: "destructive",
      });
      return;
    }
    if ((data as any)?.suppressed) {
      toast({ title: "Recipient suppressed", description: "Address is on the suppression list.", variant: "destructive" });
    } else {
      toast({ title: "Test email sent", description: `${template} → ${recipient}` });
    }
    setOpen(false);
    setTimeout(onSent, 800);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Send className="w-4 h-4" /> Send test email
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send a test email</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Template</Label>
            <Select value={template} onValueChange={setTemplate}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATE_NAMES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Recipient</Label>
            <Input
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="you@example.com"
              className="mt-1.5"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Sends realistic sample data through the live Resend connection.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={send} disabled={sending || !recipient}>
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
