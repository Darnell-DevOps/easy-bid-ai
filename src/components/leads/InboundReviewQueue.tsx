import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Inbox, AlertTriangle, Check, X, Loader2, ChevronDown, ChevronUp, Archive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type Msg = {
  id: string;
  from_email: string | null;
  from_name: string | null;
  subject: string | null;
  body_text: string | null;
  received_at: string;
  classification: "lead" | "needs_review" | "ignored";
  classification_reason: string | null;
  client_id: string | null;
};

export default function InboundReviewQueue() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [review, setReview] = useState<Msg[]>([]);
  const [ignored, setIgnored] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showIgnored, setShowIgnored] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("inbound_messages")
      .select("id, from_email, from_name, subject, body_text, received_at, classification, classification_reason, client_id")
      .in("classification", ["needs_review", "ignored"])
      .order("received_at", { ascending: false })
      .limit(50);
    const rows = (data ?? []) as Msg[];
    setReview(rows.filter((r) => r.classification === "needs_review"));
    setIgnored(rows.filter((r) => r.classification === "ignored").slice(0, 20));
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const promote = async (id: string) => {
    setBusyId(id);
    const { data, error } = await supabase.rpc("inbound_message_promote", { _id: id });
    setBusyId(null);
    if (error) {
      toast({ title: "Could not convert", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Converted to lead" });
    await load();
    if (data) navigate(`/dashboard/clients/${data}`);
  };

  const ignore = async (id: string) => {
    setBusyId(id);
    const { error } = await supabase.rpc("inbound_message_ignore", { _id: id });
    setBusyId(null);
    if (error) {
      toast({ title: "Could not ignore", description: error.message, variant: "destructive" });
      return;
    }
    await load();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading inbound queue…
        </CardContent>
      </Card>
    );
  }

  if (review.length === 0 && ignored.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Inbox className="w-4 h-4 text-amber-500" />
          Inbound review queue
          {review.length > 0 && (
            <Badge variant="outline" className="border-amber-500/40 text-amber-600 ml-1">
              {review.length} to review
            </Badge>
          )}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Emails we weren't sure about. Convert real enquiries to leads, ignore the rest.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {review.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing waiting for review.</p>
        ) : (
          review.map((m) => (
            <div key={m.id} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {m.from_name || m.from_email || "Unknown sender"}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {m.from_email} · {new Date(m.received_at).toLocaleString()}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/40 text-amber-600">
                  <AlertTriangle className="w-3 h-3" /> {m.classification_reason || "Needs review"}
                </Badge>
              </div>
              {m.subject && <div className="text-sm font-medium">{m.subject}</div>}
              {m.body_text && (
                <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                  {m.body_text}
                </p>
              )}
              <div className="flex gap-2">
                <Button size="sm" disabled={busyId === m.id} onClick={() => promote(m.id)} className="gap-1">
                  {busyId === m.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Convert to lead
                </Button>
                <Button size="sm" variant="outline" disabled={busyId === m.id} onClick={() => ignore(m.id)} className="gap-1">
                  <X className="w-3 h-3" /> Ignore
                </Button>
              </div>
            </div>
          ))
        )}

        {ignored.length > 0 && (
          <div className="pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setShowIgnored((v) => !v)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              {showIgnored ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              <Archive className="w-3 h-3" /> Ignored ({ignored.length})
            </button>
            {showIgnored && (
              <div className="mt-2 space-y-1.5">
                {ignored.map((m) => (
                  <div key={m.id} className="text-xs text-muted-foreground flex items-center justify-between gap-2 border border-border/60 rounded px-2 py-1.5">
                    <span className="truncate">
                      <span className="font-medium text-foreground/80">{m.from_email || "?"}</span>
                      {" — "}
                      {m.subject || "(no subject)"}
                    </span>
                    <span className="shrink-0 text-[10px]">{m.classification_reason}</span>
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" disabled={busyId === m.id} onClick={() => promote(m.id)}>
                      Restore
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
