import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  PRIORITY_OPTIONS,
  deriveStatus,
  priorityBadgeClass,
  statusBadgeClass,
  statusLabel,
  syncAutoDeadlines,
  todayISO,
  type DeadlinePriority,
  type DeadlineRow,
  type DeadlineStatus,
} from "@/lib/deadlines";

interface ClientLite { id: string; name: string }
interface ProposalLite { id: string; client_name: string; service_type: string }
interface ContractLite { id: string; title: string; client_name: string }

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function relativeLabel(d: string) {
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(d + "T00:00:00");
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 0 && diff <= 14) return `In ${diff} days`;
  if (diff < 0 && diff >= -14) return `${Math.abs(diff)} days ago`;
  return fmtDate(d);
}

export default function DeadlinesPanel() {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<DeadlineRow[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [proposals, setProposals] = useState<ProposalLite[]>([]);
  const [contracts, setContracts] = useState<ContractLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [filter, setFilter] = useState<"all" | "week" | "overdue" | "completed">("all");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DeadlineRow | null>(null);

  const blankForm = {
    title: "",
    due_date: todayISO(),
    priority: "medium" as DeadlinePriority,
    notes: "",
    client_id: "none",
    proposal_id: "none",
    contract_id: "none",
    client_visible: false,
  };
  const [form, setForm] = useState(blankForm);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const [dRes, cRes, pRes, kRes] = await Promise.all([
      supabase.from("deadlines").select("*").is("deleted_at", null).order("due_date", { ascending: true }),
      supabase.from("clients").select("id, name").is("deleted_at", null).order("name"),
      supabase.from("proposals").select("id, client_name, service_type").is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("contracts").select("id, title, client_name").is("deleted_at", null).order("created_at", { ascending: false }),
    ]);
    setRows((dRes.data as DeadlineRow[]) || []);
    setClients((cRes.data as ClientLite[]) || []);
    setProposals((pRes.data as ProposalLite[]) || []);
    setContracts((kRes.data as ContractLite[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load().then(() => {
      // Auto-sync once on mount, silently
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) syncAutoDeadlines(user.id).then((n) => { if (n > 0) load(); });
      });
    });
  }, []);

  const enriched = useMemo(
    () => rows.map((r) => ({ ...r, status: deriveStatus(r) })),
    [rows],
  );

  const filtered = useMemo(() => {
    const now = new Date(); now.setHours(0,0,0,0);
    const weekAhead = new Date(now); weekAhead.setDate(weekAhead.getDate() + 7);
    return enriched.filter((d) => {
      if (filter === "completed") return d.status === "completed";
      if (filter === "overdue") return d.status === "overdue";
      if (filter === "week") {
        if (d.status === "completed") return false;
        const due = new Date(d.due_date + "T00:00:00");
        return due >= now && due <= weekAhead;
      }
      return d.status !== "completed";
    });
  }, [enriched, filter]);

  const dueDates = useMemo(
    () => enriched.filter((d) => d.status !== "completed").map((d) => new Date(d.due_date + "T00:00:00")),
    [enriched],
  );

  const dueOnSelected = useMemo(() => {
    return enriched.filter((d) => {
      const due = new Date(d.due_date + "T00:00:00");
      return due.toDateString() === selectedDate.toDateString();
    });
  }, [enriched, selectedDate]);

  const counts = useMemo(() => {
    return {
      overdue: enriched.filter((d) => d.status === "overdue").length,
      week: enriched.filter((d) => d.status === "due_soon").length,
      completed: enriched.filter((d) => d.status === "completed").length,
    };
  }, [enriched]);

  const openNew = () => {
    setEditing(null);
    setForm(blankForm);
    setDialogOpen(true);
  };

  const openEdit = (d: DeadlineRow) => {
    setEditing(d);
    setForm({
      title: d.title,
      due_date: d.due_date,
      priority: d.priority,
      notes: d.notes || "",
      client_id: d.client_id || "none",
      proposal_id: d.proposal_id || "none",
      contract_id: d.contract_id || "none",
      client_visible: d.client_visible,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!userId) return;
    if (!form.title.trim()) {
      toast({ title: "Title required", variant: "destructive" });
      return;
    }
    if (!form.due_date) {
      toast({ title: "Due date required", variant: "destructive" });
      return;
    }
    const clientName =
      form.client_id !== "none" ? clients.find((c) => c.id === form.client_id)?.name || null : null;
    const payload = {
      user_id: userId,
      title: form.title.trim().slice(0, 200),
      due_date: form.due_date,
      priority: form.priority,
      notes: form.notes.trim().slice(0, 1000) || null,
      client_id: form.client_id === "none" ? null : form.client_id,
      client_name: clientName,
      proposal_id: form.proposal_id === "none" ? null : form.proposal_id,
      contract_id: form.contract_id === "none" ? null : form.contract_id,
      client_visible: form.client_visible,
      source: "manual",
    };
    const { error } = editing
      ? await supabase.from("deadlines").update(payload).eq("id", editing.id)
      : await supabase.from("deadlines").insert(payload);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Deadline updated" : "Deadline added" });
    setDialogOpen(false);
    load();
  };

  const toggleComplete = async (d: DeadlineRow) => {
    const isDone = d.status === "completed" || d.completed_at;
    const { error } = await supabase
      .from("deadlines")
      .update({
        status: isDone ? "upcoming" : "completed",
        completed_at: isDone ? null : new Date().toISOString(),
      })
      .eq("id", d.id);
    if (error) {
      toast({ title: "Couldn't update", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this deadline?")) return;
    const { error } = await supabase.from("deadlines").delete().eq("id", id);
    if (error) {
      toast({ title: "Couldn't delete", description: error.message, variant: "destructive" });
      return;
    }
    load();
  };

  const runSync = async () => {
    if (!userId) return;
    setSyncing(true);
    const n = await syncAutoDeadlines(userId);
    setSyncing(false);
    toast({
      title: n > 0 ? `Added ${n} deadline${n > 1 ? "s" : ""}` : "Already up to date",
      description: n > 0 ? "Pulled from your proposals, contracts and retainers." : undefined,
    });
    load();
  };

  const linkFor = (d: DeadlineRow): string | null => {
    if (d.proposal_id) return `/dashboard/proposal/${d.proposal_id}`;
    if (d.contract_id) return `/dashboard/contracts/${d.contract_id}`;
    if (d.retainer_id) return `/dashboard/retainers/${d.retainer_id}`;
    if (d.client_id) return `/dashboard/clients/${d.client_id}`;
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Header / actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All
          </Button>
          <Button
            variant={filter === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("week")}
            className="gap-1.5"
          >
            Due this week
            {counts.week > 0 && <Badge variant="secondary" className="ml-1">{counts.week}</Badge>}
          </Button>
          <Button
            variant={filter === "overdue" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("overdue")}
            className="gap-1.5"
          >
            Overdue
            {counts.overdue > 0 && (
              <Badge className="ml-1 bg-destructive text-destructive-foreground">{counts.overdue}</Badge>
            )}
          </Button>
          <Button
            variant={filter === "completed" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("completed")}
          >
            Completed
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setView("list")}
              className={`px-3 py-1.5 text-xs ${view === "list" ? "bg-muted text-foreground" : "text-muted-foreground"}`}
            >
              List
            </button>
            <button
              onClick={() => setView("calendar")}
              className={`px-3 py-1.5 text-xs ${view === "calendar" ? "bg-muted text-foreground" : "text-muted-foreground"}`}
            >
              Calendar
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={runSync} disabled={syncing} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} /> Sync
          </Button>
          <Button size="sm" onClick={openNew} className="gap-1.5 bg-accent text-accent-foreground">
            <Plus className="w-3.5 h-3.5" /> Add deadline
          </Button>
        </div>
      </div>

      {view === "list" ? (
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="p-6 text-sm text-muted-foreground">Loading…</p>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 px-6">
                <CalendarClock className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No deadlines here yet.</p>
                <Button variant="outline" size="sm" onClick={openNew} className="mt-3 gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Add your first deadline
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((d) => {
                  const href = linkFor(d);
                  return (
                    <div key={d.id} className="flex items-start gap-3 p-4 hover:bg-muted/30 transition">
                      <button
                        onClick={() => toggleComplete(d)}
                        className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
                          d.status === "completed"
                            ? "bg-success border-success"
                            : "border-muted-foreground/40 hover:border-success"
                        }`}
                        title={d.status === "completed" ? "Mark as not done" : "Mark complete"}
                      >
                        {d.status === "completed" && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 flex-wrap">
                          <p className={`text-sm font-semibold ${d.status === "completed" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {d.title}
                          </p>
                          <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(d.status)}`}>
                            {statusLabel(d.status)}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] capitalize ${priorityBadgeClass(d.priority)}`}>
                            {d.priority} priority
                          </Badge>
                          {d.source !== "manual" && (
                            <Badge variant="outline" className="text-[10px] capitalize text-muted-foreground">
                              from {d.source}
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarClock className="w-3 h-3" />
                            {relativeLabel(d.due_date)} · {fmtDate(d.due_date)}
                          </span>
                          {d.client_name && <span>· {d.client_name}</span>}
                        </div>
                        {d.notes && (
                          <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{d.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {href && (
                          <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                            <Link to={href} title="Open related record">
                              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                            </Link>
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => openEdit(d)} className="text-xs h-7 px-2">
                          Edit
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(d.id)} className="h-7 w-7">
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4">
          <Card>
            <CardContent className="p-3 sm:p-4">
              <CalendarUI
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                modifiers={{ hasDeadline: dueDates }}
                modifiersClassNames={{
                  hasDeadline:
                    "relative after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-destructive",
                }}
                className="p-0"
              />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <h3 className="text-base font-semibold text-foreground mb-3">
                {selectedDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
              </h3>
              {dueOnSelected.length === 0 ? (
                <p className="text-sm text-muted-foreground">No deadlines due this day.</p>
              ) : (
                <div className="space-y-2">
                  {dueOnSelected.map((d) => (
                    <div key={d.id} className="p-3 rounded-lg border border-border bg-card/50">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">{d.title}</p>
                        <Badge variant="outline" className={`text-[10px] ${statusBadgeClass(d.status)}`}>
                          {statusLabel(d.status)}
                        </Badge>
                      </div>
                      {d.client_name && (
                        <p className="text-xs text-muted-foreground mt-0.5">{d.client_name}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit deadline" : "Add deadline"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Deliver website mockups"
                maxLength={200}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Due date *</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as DeadlinePriority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Client</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Proposal</Label>
                <Select value={form.proposal_id} onValueChange={(v) => setForm({ ...form, proposal_id: v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {proposals.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.client_name} — {p.service_type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Contract</Label>
                <Select value={form.contract_id} onValueChange={(v) => setForm({ ...form, contract_id: v })}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {contracts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.client_name} — {c.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Anything to remember"
                rows={3}
                maxLength={1000}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={form.client_visible}
                onChange={(e) => setForm({ ...form, client_visible: e.target.checked })}
                className="rounded border-border"
              />
              Visible in the client portal
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} className="gap-2 bg-accent text-accent-foreground">
              <CheckCircle2 className="w-4 h-4" /> {editing ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Compact dashboard widget summarising urgent deadlines. */
export function DeadlineAlerts() {
  const [rows, setRows] = useState<DeadlineRow[]>([]);
  useEffect(() => {
    supabase
      .from("deadlines")
      .select("*")
      .is("deleted_at", null)
      .neq("status", "completed")
      .order("due_date", { ascending: true })
      .limit(50)
      .then(({ data }) => setRows((data as DeadlineRow[]) || []));
  }, []);
  const urgent = useMemo(
    () =>
      rows
        .map((r) => ({ ...r, status: deriveStatus(r) }))
        .filter((r) => r.status === "overdue" || r.status === "due_soon")
        .slice(0, 5),
    [rows],
  );
  if (urgent.length === 0) return null;
  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <p className="text-sm font-semibold text-foreground">Deadline alerts</p>
        </div>
        <div className="space-y-1.5">
          {urgent.map((d) => (
            <Link
              key={d.id}
              to="/dashboard/calendar?tab=deadlines"
              className="flex items-center justify-between gap-2 text-xs hover:underline"
            >
              <span className="truncate text-foreground">{d.title}</span>
              <Badge variant="outline" className={`text-[10px] flex-shrink-0 ${statusBadgeClass(d.status)}`}>
                {relativeLabel(d.due_date)}
              </Badge>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
