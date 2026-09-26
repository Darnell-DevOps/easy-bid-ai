import { useEffect, useState } from "react";
import { Database, Download, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type TableName = "clients" | "proposals" | "contracts" | "retainer_invoices" | "retainers" | "bookings" | "onboarding_forms" | "email_send_log";
type Retention = "0" | "30" | "60";

const TABLES: { name: TableName; label: string }[] = [
  { name: "clients", label: "Clients" },
  { name: "proposals", label: "Proposals" },
  { name: "contracts", label: "Contracts" },
  { name: "retainer_invoices", label: "Invoices" },
  { name: "retainers", label: "Retainers" },
  { name: "bookings", label: "Bookings" },
  { name: "onboarding_forms", label: "Onboarding forms" },
  { name: "email_send_log", label: "Email history" },
];

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value: unknown) {
  const raw = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  // Spreadsheet applications interpret these leading characters as formulas.
  const safe = /^[\s]*[=+@-]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replace(/"/g, '""') + '"';
}

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return [headers.map(csvCell).join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\r\n");
}

async function readAllRows(name: TableName): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from(name)
      .select("*")
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

export default function DataExportsSettings() {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [retention, setRetention] = useState<Retention>("30");
  const [retentionSaving, setRetentionSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.from("user_settings").select("trash_retention_days").eq("user_id", user.id).maybeSingle();
      if (!cancelled && !error) {
        const days = data?.trash_retention_days;
        setRetention(days === 0 ? "0" : days === 60 ? "60" : "30");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const updateRetention = async (next: Retention) => {
    const previous = retention;
    setRetention(next);
    setRetentionSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = user
      ? await supabase.from("user_settings").upsert({ user_id: user.id, trash_retention_days: Number(next) }, { onConflict: "user_id" })
      : { error: new Error("Your session has expired.") };
    setRetentionSaving(false);
    if (error) {
      setRetention(previous);
      toast({ title: "Couldn't save retention setting", description: error.message, variant: "destructive" });
    }
  };

  const exportTable = async (name: TableName) => {
    setBusy(name);
    try {
      const rows = await readAllRows(name);
      download(name + "-" + new Date().toISOString().slice(0, 10) + ".csv", toCsv(rows), "text/csv;charset=utf-8");
      toast({ title: "Export ready", description: rows.length + " records downloaded." });
    } catch (error) {
      toast({ title: "Export failed", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const exportWorkspace = async () => {
    setBusy("workspace");
    try {
      const bundle: Record<string, unknown> = { exported_at: new Date().toISOString() };
      for (const table of TABLES) bundle[table.name] = await readAllRows(table.name);
      download("closesync-workspace-" + new Date().toISOString().slice(0, 10) + ".json", JSON.stringify(bundle, null, 2), "application/json");
      toast({ title: "Workspace export ready" });
    } catch (error) {
      toast({ title: "Export failed", description: error instanceof Error ? error.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card><CardContent className="p-6">
        <h3 className="flex items-center gap-2 text-base font-semibold text-foreground"><Database className="h-4 w-4" aria-hidden="true" /> Export workspace records</h3>
        <p className="mt-1 text-sm text-muted-foreground">Download the records listed below. Exports include the rows your account can access. Files, authentication records and other account data are not included.</p>
        <div className="mt-5 divide-y divide-border">
          {TABLES.map((table) => (
            <div key={table.name} className="flex items-center justify-between gap-3 py-3">
              <span className="text-sm font-medium text-foreground">{table.label}</span>
              <Button variant="outline" size="sm" onClick={() => void exportTable(table.name)} disabled={busy !== null} aria-busy={busy === table.name}>
                <Download className="mr-2 h-4 w-4" aria-hidden="true" /> Download CSV
              </Button>
            </div>
          ))}
        </div>
        <Button className="mt-5" onClick={() => void exportWorkspace()} disabled={busy !== null} aria-busy={busy === "workspace"}>Download listed records as JSON</Button>
      </CardContent></Card>

      <Card><CardContent className="p-6">
        <h3 className="flex items-center gap-2 text-base font-semibold text-foreground"><Trash2 className="h-4 w-4" aria-hidden="true" /> Trash retention</h3>
        <p id="data-retention-help" className="mt-1 text-sm text-muted-foreground">Choose when items in Trash are permanently removed by the scheduled cleanup job.</p>
        <div className="mt-4 max-w-xs space-y-2">
          <Label htmlFor="data-retention-period">Keep deleted items for</Label>
          <Select value={retention} onValueChange={(value: Retention) => void updateRetention(value)} disabled={retentionSaving}>
            <SelectTrigger id="data-retention-period" aria-describedby="data-retention-help" aria-busy={retentionSaving}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Remove at next cleanup</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="60">60 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent></Card>

      <Card><CardContent className="p-6">
        <h3 className="text-base font-semibold text-foreground">Personal data and account deletion</h3>
        <p className="mt-1 text-sm text-muted-foreground">The workspace download above is not a complete personal-data export. For a complete access or deletion request, email CloseSync support. Your email app will open so you can send the request; do not include your password.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="outline"><a href="mailto:support@closesync.io?subject=CloseSync%20data%20access%20request">Email a data access request</a></Button>
          <Button asChild variant="outline"><a href="mailto:support@closesync.io?subject=CloseSync%20account%20deletion%20request">Email a deletion request</a></Button>
        </div>
      </CardContent></Card>
    </div>
  );
}
