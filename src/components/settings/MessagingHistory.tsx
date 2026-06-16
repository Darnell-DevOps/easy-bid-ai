import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, MessageCircle, Bell, AlertCircle, CheckCircle2, MinusCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface WaRow {
  id: string;
  recipient: string;
  body: string;
  context: string | null;
  status: string;
  error: string | null;
  sent_at: string;
  twilio_sid: string | null;
}

interface AuditRow {
  id: string;
  kind: string;
  stage: string;
  channel: string;
  status: string;
  recipient: string | null;
  error: string | null;
  attempted_at: string;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: any; label: string }> = {
    sent: { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle2, label: "Sent" },
    queued: { cls: "bg-blue-500/15 text-blue-400 border-blue-500/30", icon: CheckCircle2, label: "Queued" },
    delivered: { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle2, label: "Delivered" },
    deduped: { cls: "bg-slate-500/15 text-slate-300 border-slate-500/30", icon: MinusCircle, label: "Deduped" },
    skipped: { cls: "bg-slate-500/15 text-slate-300 border-slate-500/30", icon: MinusCircle, label: "Skipped" },
    attempted: { cls: "bg-slate-500/15 text-slate-300 border-slate-500/30", icon: MinusCircle, label: "Attempted" },
    failed: { cls: "bg-red-500/15 text-red-400 border-red-500/30", icon: AlertCircle, label: "Failed" },
  };
  const v = map[status] || map.attempted;
  const Icon = v.icon;
  return (
    <Badge variant="outline" className={v.cls}>
      <Icon className="w-3 h-3 mr-1" /> {v.label}
    </Badge>
  );
}

export default function MessagingHistory() {
  const [loading, setLoading] = useState(true);
  const [wa, setWa] = useState<WaRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: waRows }, { data: auditRows }] = await Promise.all([
        supabase
          .from("whatsapp_send_log" as any)
          .select("id, recipient, body, context, status, error, sent_at, twilio_sid")
          .order("sent_at", { ascending: false })
          .limit(50),
        supabase
          .from("reminder_audit_log" as any)
          .select("id, kind, stage, channel, status, recipient, error, attempted_at")
          .order("attempted_at", { ascending: false })
          .limit(50),
      ]);
      setWa((waRows as any) || []);
      setAudit((auditRows as any) || []);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Bell className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Messaging & reminder history</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Recent WhatsApp messages and automated reminder attempts on your account.
            </p>
          </div>
        </div>

        <Tabs defaultValue="whatsapp">
          <TabsList>
            <TabsTrigger value="whatsapp">
              <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> WhatsApp ({wa.length})
            </TabsTrigger>
            <TabsTrigger value="reminders">
              <Bell className="w-3.5 h-3.5 mr-1.5" /> Reminders ({audit.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="whatsapp" className="mt-4 space-y-2">
            {wa.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">No WhatsApp messages yet.</p>
            )}
            {wa.map((r) => (
              <div key={r.id} className="rounded-lg border border-border p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <StatusBadge status={r.status} />
                    {r.context && (
                      <Badge variant="outline" className="text-[10px]">
                        {r.context}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground truncate">{r.recipient}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.sent_at), { addSuffix: true })}
                  </span>
                </div>
                <p className="text-sm text-foreground line-clamp-2">{r.body}</p>
                {r.error && <p className="text-xs text-red-400 truncate">{r.error}</p>}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="reminders" className="mt-4 space-y-2">
            {audit.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">No reminder activity yet.</p>
            )}
            {audit.map((r) => (
              <div key={r.id} className="rounded-lg border border-border p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <StatusBadge status={r.status} />
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {r.kind.replace(/_/g, " ")}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {r.channel}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {r.stage}
                  </Badge>
                  {r.recipient && (
                    <span className="text-xs text-muted-foreground truncate">{r.recipient}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {r.error && <span className="text-xs text-red-400 truncate max-w-[200px]">{r.error}</span>}
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(r.attempted_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
