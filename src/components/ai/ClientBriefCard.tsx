import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, RefreshCw, Loader2, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ClientBriefCardProps {
  clientId: string;
}

interface Brief {
  relationship: string;
  lifetime_value: string;
  last_touch: string;
  risk: string;
  next_move: string;
}

const ROWS: { key: keyof Brief; label: string }[] = [
  { key: "relationship", label: "Relationship" },
  { key: "lifetime_value", label: "Value" },
  { key: "last_touch", label: "Last touch" },
  { key: "risk", label: "Risk" },
  { key: "next_move", label: "Next move" },
];

export default function ClientBriefCard({ clientId }: ClientBriefCardProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (errorMessage) {
      errorRef.current?.focus();
    }
  }, [errorMessage]);

  const generate = async () => {
    setErrorMessage(null);
    setStatusMessage("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-client-brief", {
        body: { clientId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setBrief(data as Brief);
      setStatusMessage(brief ? "AI client brief refreshed." : "AI client brief ready.");
    } catch (e: any) {
      const detail = e?.message || "Try again in a moment.";
      setErrorMessage(`Could not generate the client brief. ${detail}`);
      toast({
        title: "Couldn't generate brief",
        description: detail,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const errorAlert = errorMessage ? (
    <div
      ref={errorRef}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      tabIndex={-1}
      className="rounded-lg border border-destructive/60 bg-destructive/10 p-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {errorMessage}
    </div>
  ) : null;

  const statusAnnouncement = statusMessage ? (
    <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {statusMessage}
    </p>
  ) : null;

  if (!brief && !loading) {
    return (
      <Card aria-busy="false" className="border-border/60">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex-1 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0">
                <ClipboardList aria-hidden="true" className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Brief me on this client</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  A 5-line snapshot — relationship, value, last touch, risk, next move.
                </p>
              </div>
            </div>
            {errorAlert}
            {statusAnnouncement}
          </div>
          <Button size="sm" onClick={generate} className="gap-2 flex-shrink-0">
            <FileText aria-hidden="true" className="w-3.5 h-3.5" /> Generate brief
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card aria-busy={loading} className="border-border/60">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
            <ClipboardList aria-hidden="true" className="w-4 h-4 text-accent" /> AI Client Brief
          </h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={generate}
            disabled={loading}
            aria-busy={loading}
            className="h-7 px-2 gap-1.5 text-xs text-muted-foreground"
          >
            <RefreshCw aria-hidden="true" className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {errorAlert}
        {statusAnnouncement}

        {loading && !brief ? (
          <div role="status" aria-live="polite" aria-atomic="true" className="flex items-center gap-2 text-muted-foreground text-sm py-3">
            <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin" /> Reading the relationship…
          </div>
        ) : brief ? (
          <div className="space-y-2.5">
            {ROWS.map(({ key, label }) => (
              <div key={key} className="grid grid-cols-[88px_1fr] gap-3 items-start">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground pt-0.5">
                  {label}
                </span>
                <p
                  className={`text-sm leading-relaxed ${
                    key === "next_move" ? "text-foreground font-medium" : "text-foreground/90"
                  }`}
                >
                  {brief[key]}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
