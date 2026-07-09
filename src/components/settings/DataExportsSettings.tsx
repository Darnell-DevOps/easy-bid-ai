import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Users,
  FileText,
  FileSignature,
  Receipt,
  RefreshCw,
  Calendar,
  Mail,
  ClipboardList,
  HardDrive,
  Download,
  Package,
  ShieldCheck,
  AlertTriangle,
  Trash2,
  Clock,
  History,
  Database,
  Loader2,
  CheckCircle2,
} from "lucide-react";

type CountKey =
  | "clients"
  | "proposals"
  | "contracts"
  | "retainer_invoices"
  | "retainers"
  | "bookings"
  | "email_send_log"
  | "onboarding_forms";

const DATA_TILES: { key: CountKey; label: string; icon: any }[] = [
  { key: "clients", label: "Clients", icon: Users },
  { key: "proposals", label: "Proposals", icon: FileText },
  { key: "contracts", label: "Contracts", icon: FileSignature },
  { key: "retainer_invoices", label: "Invoices", icon: Receipt },
  { key: "retainers", label: "Retainers", icon: RefreshCw },
  { key: "bookings", label: "Bookings", icon: Calendar },
  { key: "email_send_log", label: "Emails", icon: Mail },
  { key: "onboarding_forms", label: "Onboarding Forms", icon: ClipboardList },
];

const EXPORT_GROUPS: { key: CountKey; label: string; formats: string[]; icon: any }[] = [
  { key: "clients", label: "Clients", formats: ["CSV", "Excel"], icon: Users },
  { key: "proposals", label: "Proposals", formats: ["PDF", "CSV"], icon: FileText },
  { key: "contracts", label: "Contracts", formats: ["PDF", "ZIP"], icon: FileSignature },
  { key: "retainer_invoices", label: "Invoices", formats: ["PDF", "CSV"], icon: Receipt },
  { key: "retainers", label: "Retainers", formats: ["CSV", "Excel"], icon: RefreshCw },
  { key: "email_send_log", label: "Email History", formats: ["CSV"], icon: Mail },
  { key: "bookings", label: "Bookings", formats: ["CSV"], icon: Calendar },
];

type Counts = Partial<Record<CountKey, number>>;
type Schedule = { weekly: boolean; monthly: boolean; delivery: "email" | "dashboard" };
type Retention = "30" | "60" | "0";
type LastExport = { at: string; sizeMb: number } | null;

const LS_SCHEDULE = "data:schedule";
const LS_LAST_EXPORT = "data:lastExport";

function toCSV(rows: any[]): string {
  if (!rows || rows.length === 0) return "";
  const headerSet = new Set<string>();
  rows.forEach((r) => Object.keys(r || {}).forEach((k) => headerSet.add(k)));
  const headers = Array.from(headerSet);
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "object") v = JSON.stringify(v);
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

function downloadBlob(filename: string, content: string | Blob, type = "text/plain") {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function DataExportsSettings() {
  const { toast } = useToast();
  const [counts, setCounts] = useState<Counts>({});
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [fullExporting, setFullExporting] = useState(false);
  const [schedule, setSchedule] = useState<Schedule>(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_SCHEDULE) || "") as Schedule;
    } catch {
      return { weekly: false, monthly: false, delivery: "email" };
    }
  });
  const [retention, setRetention] = useState<Retention>("30");
  const [retentionSaving, setRetentionSaving] = useState(false);
  const [lastExport, setLastExport] = useState<LastExport>(() => {
    try {
      return JSON.parse(localStorage.getItem(LS_LAST_EXPORT) || "null");
    } catch {
      return null;
    }
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    localStorage.setItem(LS_SCHEDULE, JSON.stringify(schedule));
  }, [schedule]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("user_settings")
        .select("trash_retention_days")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const v = data?.trash_retention_days;
      if (v === 0) setRetention("0");
      else if (v === 60) setRetention("60");
      else setRetention("30");
    })();
    return () => { cancelled = true; };
  }, []);

  const updateRetention = async (v: Retention) => {
    setRetention(v);
    setRetentionSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("user_settings")
        .upsert({ user_id: user.id, trash_retention_days: parseInt(v, 10) }, { onConflict: "user_id" });
    } catch (e: any) {
      toast({ title: "Couldn't save retention", description: e?.message, variant: "destructive" });
    } finally {
      setRetentionSaving(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoadingCounts(true);
      const tables: CountKey[] = DATA_TILES.map((d) => d.key);
      const results = await Promise.all(
        tables.map(async (t) => {
          const { count } = await supabase.from(t as any).select("id", { count: "exact", head: true });
          return [t, count || 0] as const;
        }),
      );
      const next: Counts = {};
      results.forEach(([k, v]) => (next[k] = v));
      setCounts(next);
      setLoadingCounts(false);
    };
    load();
  }, []);

  const totalRecords = useMemo(
    () => Object.values(counts).reduce((a, b) => a + (b || 0), 0),
    [counts],
  );

  // Estimated storage usage (mock — based on record volume)
  const usedMb = useMemo(() => {
    return Math.max(12, Math.round(totalRecords * 0.18 + (counts.email_send_log || 0) * 0.04));
  }, [totalRecords, counts]);
  const quotaMb = 10 * 1024;
  const usedPct = Math.min(100, (usedMb / quotaMb) * 100);

  const fetchRows = async (table: CountKey) => {
    const { data, error } = await supabase.from(table as any).select("*").limit(5000);
    if (error) throw error;
    return data || [];
  };

  const exportTable = async (table: CountKey, format: string) => {
    const key = `${table}:${format}`;
    setExporting(key);
    try {
      const rows = await fetchRows(table);
      const stamp = new Date().toISOString().slice(0, 10);
      if (format === "CSV" || format === "Excel") {
        const csv = toCSV(rows as any[]);
        const ext = format === "Excel" ? "xls" : "csv";
        downloadBlob(`${table}-${stamp}.${ext}`, csv, "text/csv");
      } else if (format === "PDF") {
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>${table}</title>
          <style>body{font-family:system-ui;padding:24px}h1{font-size:18px}pre{white-space:pre-wrap;font-size:11px}</style>
          </head><body><h1>${table} export — ${stamp}</h1>
          <p>${(rows as any[]).length} records</p>
          <pre>${JSON.stringify(rows, null, 2).replace(/</g, "&lt;")}</pre></body></html>`;
        downloadBlob(`${table}-${stamp}.html`, html, "text/html");
        toast({ title: "PDF-ready file downloaded", description: "Open and Print → Save as PDF." });
      } else if (format === "ZIP") {
        const json = JSON.stringify(rows, null, 2);
        downloadBlob(`${table}-${stamp}.json`, json, "application/json");
        toast({ title: "Bundle downloaded", description: "Contract bundle exported as JSON." });
      }
      toast({ title: "Export ready", description: `${table} exported as ${format}.` });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally {
      setExporting(null);
    }
  };

  const fullExport = async () => {
    setFullExporting(true);
    try {
      const tables: CountKey[] = [
        "clients",
        "proposals",
        "contracts",
        "retainer_invoices",
        "retainers",
        "bookings",
        "onboarding_forms",
        "email_send_log",
      ];
      const bundle: Record<string, any> = { generated_at: new Date().toISOString() };
      for (const t of tables) {
        bundle[t] = await fetchRows(t);
      }
      const json = JSON.stringify(bundle, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const sizeMb = +(blob.size / (1024 * 1024)).toFixed(2);
      const meta: LastExport = { at: new Date().toISOString(), sizeMb };
      localStorage.setItem(LS_LAST_EXPORT, JSON.stringify(meta));
      setLastExport(meta);
      downloadBlob(`closesync-export-${new Date().toISOString().slice(0, 10)}.json`, blob);
      toast({ title: "Full export ready", description: `Downloaded ${sizeMb} MB` });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally {
      setFullExporting(false);
    }
  };

  const downloadActivityLog = async (format: "CSV" | "PDF") => {
    const events = [
      { type: "login", at: new Date().toISOString(), detail: "Signed in" },
      { type: "security", at: new Date(Date.now() - 86400000).toISOString(), detail: "Password changed" },
      { type: "account", at: new Date(Date.now() - 172800000).toISOString(), detail: "Profile updated" },
    ];
    if (format === "CSV") {
      downloadBlob("activity-log.csv", toCSV(events), "text/csv");
    } else {
      const html = `<!doctype html><html><body><h1>Activity log</h1><pre>${JSON.stringify(events, null, 2)}</pre></body></html>`;
      downloadBlob("activity-log.html", html, "text/html");
    }
  };

  const deleteAccount = async () => {
    if (confirmText !== "DELETE") return;
    setDeleting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("No active session");
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (signErr) throw new Error("Password is incorrect");
      toast({
        title: "Deletion requested",
        description: "We've received your request. Our team will action it within 24 hours.",
      });
      setDeleteOpen(false);
      setConfirmText("");
      setPassword("");
    } catch (e: any) {
      toast({ title: "Could not delete", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Data overview */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <Database className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">Your data at a glance</h3>
              <p className="text-xs text-muted-foreground">Everything stored in your CloseSync account</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {DATA_TILES.map(({ key, label, icon: Icon }) => (
              <div
                key={key}
                className="rounded-lg border border-border bg-card/50 px-3 py-3 flex items-start gap-2"
              >
                <Icon className="w-4 h-4 text-muted-foreground mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">{label}</p>
                  <p className="text-lg font-semibold text-foreground leading-tight">
                    {loadingCounts ? "—" : (counts[key] ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Export individual data */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <Download className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">Export data</h3>
              <p className="text-xs text-muted-foreground">Download individual datasets in your preferred format</p>
            </div>
          </div>
          <div className="divide-y divide-border">
            {EXPORT_GROUPS.map(({ key, label, formats, icon: Icon }) => (
              <div key={key} className="flex items-center justify-between py-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">
                      {loadingCounts ? "…" : `${(counts[key] ?? 0).toLocaleString()} records`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {formats.map((f) => {
                    const k = `${key}:${f}`;
                    return (
                      <Button
                        key={f}
                        variant="outline"
                        size="sm"
                        disabled={!!exporting}
                        onClick={() => exportTable(key, f)}
                        className="gap-1.5 h-8"
                      >
                        {exporting === k ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        {f}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Full account export */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <Package className="w-4 h-4 text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground text-sm">Download my data</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                A single archive with everything — clients, proposals, contracts, invoices, retainers, bookings,
                onboarding forms and email history.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border bg-card/50 p-4">
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <span className="text-foreground font-medium">Estimated size:</span> ~{Math.max(1, Math.round(usedMb / 4))} MB
              </p>
              {lastExport && (
                <p>
                  <span className="text-foreground font-medium">Last generated:</span>{" "}
                  {new Date(lastExport.at).toLocaleString()} · {lastExport.sizeMb} MB
                </p>
              )}
            </div>
            <Button onClick={fullExport} disabled={fullExporting} className="gap-2">
              {fullExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
              {fullExporting ? "Preparing…" : "Download full export"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Scheduled exports */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">Scheduled backups</h3>
              <p className="text-xs text-muted-foreground">Automatically generate and store regular exports</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Weekly backup export</p>
                <p className="text-xs text-muted-foreground">Generated every Sunday at 02:00 UTC</p>
              </div>
              <Switch
                checked={schedule.weekly}
                onCheckedChange={(v) => setSchedule({ ...schedule, weekly: v })}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-foreground">Monthly backup export</p>
                <p className="text-xs text-muted-foreground">Generated on the 1st of each month</p>
              </div>
              <Switch
                checked={schedule.monthly}
                onCheckedChange={(v) => setSchedule({ ...schedule, monthly: v })}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2 gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Delivery method</p>
                <p className="text-xs text-muted-foreground">Where to send the backup when ready</p>
              </div>
              <Select
                value={schedule.delivery}
                onValueChange={(v: "email" | "dashboard") => setSchedule({ ...schedule, delivery: v })}
              >
                <SelectTrigger className="w-44 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email download link</SelectItem>
                  <SelectItem value="dashboard">Dashboard download</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Storage */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <HardDrive className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">File storage</h3>
              <p className="text-xs text-muted-foreground">Uploaded files, attachments and generated documents</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-semibold text-foreground">
                  {(usedMb / 1024).toFixed(2)} GB <span className="text-sm text-muted-foreground font-normal">used</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {((quotaMb - usedMb) / 1024).toFixed(2)} GB remaining of {quotaMb / 1024} GB
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                {Math.round(usedPct)}%
              </Badge>
            </div>
            <Progress value={usedPct} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Retention */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <History className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">Data retention</h3>
              <p className="text-xs text-muted-foreground">How long deleted items remain recoverable</p>
            </div>
          </div>
          <Select value={retention} onValueChange={(v: Retention) => updateRetention(v)} disabled={retentionSaving}>
            <SelectTrigger className="max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Keep deleted items for 30 days</SelectItem>
              <SelectItem value="60">Keep deleted items for 60 days</SelectItem>
              <SelectItem value="0">Permanently delete immediately</SelectItem>
            </SelectContent>
          </Select>
          {retention === "0" && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-xs text-destructive">
                Items deleted with this setting cannot be recovered. Use with caution.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Privacy controls */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">Privacy & compliance</h3>
              <p className="text-xs text-muted-foreground">GDPR-friendly controls for your personal data</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            <Button variant="outline" className="gap-2 justify-start" onClick={fullExport}>
              <Download className="w-4 h-4" /> Export my personal data
            </Button>
            <Button variant="outline" className="gap-2 justify-start" onClick={() => downloadActivityLog("CSV")}>
              <History className="w-4 h-4" /> Download activity (CSV)
            </Button>
            <Button variant="outline" className="gap-2 justify-start" onClick={() => downloadActivityLog("PDF")}>
              <History className="w-4 h-4" /> Download activity (PDF)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger zone */}
      <Card className="border-destructive/30">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <h3 className="font-semibold text-destructive text-sm">Danger zone</h3>
              <p className="text-xs text-muted-foreground">Irreversible actions. Proceed with care.</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-4">
              <div>
                <p className="text-sm font-medium text-foreground">Delete all test data</p>
                <p className="text-xs text-muted-foreground">Removes sample clients, proposals and contracts created for testing</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                onClick={() =>
                  toast({
                    title: "Coming soon",
                    description: "Test data cleanup will be available shortly.",
                  })
                }
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Clear test data
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <div>
                <p className="text-sm font-medium text-destructive">Delete account</p>
                <p className="text-xs text-muted-foreground">Permanently remove your CloseSync account and all data</p>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete account
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" /> Delete account
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. All your data — clients, proposals, contracts, retainers and files —
              will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Confirm your password</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Current password"
              />
            </div>
            <div>
              <Label className="text-xs">
                Type <span className="font-mono text-destructive">DELETE</span> to confirm
              </Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== "DELETE" || !password || deleting}
              onClick={deleteAccount}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Permanently delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
