import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, RotateCcw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { parseFilePayload, parseFilePayloads } from "@/lib/form-fields";

interface TrashedClient {
  id: string;
  name: string | null;
  company: string | null;
  email: string | null;
  deleted_at: string;
  proposalCount: number;
  onboardingCount: number;
  deadlineCount: number;
  onboardingIds: string[];
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export default function Trash() {
  const [items, setItems] = useState<TrashedClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmPurge, setConfirmPurge] = useState<TrashedClient | null>(null);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data: clients } = await supabase
      .from("clients")
      .select("id, name, company, email, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });

    const rows = (clients || []) as { id: string; name: string | null; company: string | null; email: string | null; deleted_at: string }[];
    if (rows.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    const ids = rows.map((c) => c.id);
    const [propRes, onbRes, dlRes] = await Promise.all([
      supabase.from("proposals").select("client_id").in("client_id", ids).not("deleted_at", "is", null),
      supabase.from("onboarding_forms").select("id, client_id").in("client_id", ids).not("deleted_at", "is", null),
      supabase.from("deadlines").select("client_id").in("client_id", ids).not("deleted_at", "is", null),
    ]);
    const propCount = new Map<string, number>();
    (propRes.data || []).forEach((r: any) => propCount.set(r.client_id, (propCount.get(r.client_id) || 0) + 1));
    const onbCount = new Map<string, number>();
    const onbIds = new Map<string, string[]>();
    (onbRes.data || []).forEach((r: any) => {
      onbCount.set(r.client_id, (onbCount.get(r.client_id) || 0) + 1);
      const arr = onbIds.get(r.client_id) || [];
      arr.push(r.id);
      onbIds.set(r.client_id, arr);
    });
    const dlCount = new Map<string, number>();
    (dlRes.data || []).forEach((r: any) => dlCount.set(r.client_id, (dlCount.get(r.client_id) || 0) + 1));

    setItems(rows.map((c) => ({
      ...c,
      proposalCount: propCount.get(c.id) || 0,
      onboardingCount: onbCount.get(c.id) || 0,
      deadlineCount: dlCount.get(c.id) || 0,
      onboardingIds: onbIds.get(c.id) || [],
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const restore = async (item: TrashedClient) => {
    setBusy(item.id);
    await Promise.all([
      supabase.from("proposals").update({ deleted_at: null }).eq("client_id", item.id),
      supabase.from("onboarding_forms").update({ deleted_at: null }).eq("client_id", item.id),
      supabase.from("deadlines").update({ deleted_at: null }).eq("client_id", item.id),
    ]);
    await supabase.from("clients").update({ deleted_at: null }).eq("id", item.id);
    toast({ title: "Client restored", description: `${item.name || "Client"} and their records are back.` });
    setBusy(null);
    load();
  };

  const purge = async (item: TrashedClient) => {
    setBusy(item.id);
    try {
      // Best-effort: remove uploaded files referenced by onboarding responses
      if (item.onboardingIds.length > 0) {
        const { data: forms } = await supabase
          .from("onboarding_forms")
          .select("id, fields, responses")
          .in("id", item.onboardingIds);
        const paths: string[] = [];
        (forms || []).forEach((f: any) => {
          const fields = Array.isArray(f.fields) ? f.fields : [];
          const responses = f.responses || {};
          fields.forEach((fd: any) => {
            if (fd?.type !== "file") return;
            const raw = responses[fd.id];
            if (!raw) return;
            if (fd.multiple) {
              parseFilePayloads(raw).forEach((p) => { if (p?.path) paths.push(p.path); });
            } else {
              const p = parseFilePayload(raw);
              if (p?.path) paths.push(p.path);
            }
          });
        });
        if (paths.length > 0) {
          try { await supabase.storage.from("form-uploads").remove(paths); } catch { /* ignore */ }
        }
      }
      await Promise.all([
        supabase.from("proposals").delete().eq("client_id", item.id),
        supabase.from("onboarding_forms").delete().eq("client_id", item.id),
        supabase.from("deadlines").delete().eq("client_id", item.id),
      ]);
      const { error } = await supabase.from("clients").delete().eq("id", item.id);
      if (error) throw error;
      toast({ title: "Permanently deleted", description: `${item.name || "Client"} has been erased.` });
    } catch (e: any) {
      toast({ title: "Couldn't delete", description: e?.message || "Some related records prevented deletion.", variant: "destructive" });
    } finally {
      setBusy(null);
      setConfirmPurge(null);
      load();
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Trash2 className="w-6 h-6 text-muted-foreground" />
            Trash
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Recently deleted clients and their proposals, onboarding forms, and deadlines. Restore them or delete permanently.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-10 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto">
                <Trash2 className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">Trash is empty</p>
              <p className="text-xs text-muted-foreground">Deleted clients will appear here so you can restore them.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">{item.name || "Untitled client"}</p>
                      {item.company && <span className="text-xs text-muted-foreground">· {item.company}</span>}
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Deleted {timeAgo(item.deleted_at)}
                      </Badge>
                    </div>
                    {item.email && <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.email}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.proposalCount > 0 && (
                        <Badge variant="secondary" className="text-[10px]">{item.proposalCount} proposal{item.proposalCount !== 1 ? "s" : ""}</Badge>
                      )}
                      {item.onboardingCount > 0 && (
                        <Badge variant="secondary" className="text-[10px]">{item.onboardingCount} onboarding form{item.onboardingCount !== 1 ? "s" : ""}</Badge>
                      )}
                      {item.deadlineCount > 0 && (
                        <Badge variant="secondary" className="text-[10px]">{item.deadlineCount} deadline{item.deadlineCount !== 1 ? "s" : ""}</Badge>
                      )}
                      {item.proposalCount + item.onboardingCount + item.deadlineCount === 0 && (
                        <span className="text-[11px] text-muted-foreground">No cascaded records</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5" disabled={busy === item.id} onClick={() => restore(item)}>
                      <RotateCcw className="w-3.5 h-3.5" /> Restore
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-destructive/40 text-destructive hover:bg-destructive/10"
                      disabled={busy === item.id}
                      onClick={() => setConfirmPurge(item)}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete permanently
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!confirmPurge} onOpenChange={(o) => !o && setConfirmPurge(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete {confirmPurge?.name || "client"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently erase this client and their proposals, onboarding forms, deadlines, and any uploaded files.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmPurge && purge(confirmPurge)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
