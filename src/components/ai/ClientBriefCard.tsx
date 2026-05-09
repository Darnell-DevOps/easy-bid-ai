import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw, Loader2, Brain } from "lucide-react";
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

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-client-brief", {
        body: { clientId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setBrief(data as Brief);
    } catch (e: any) {
      toast({
        title: "Couldn't generate brief",
        description: e?.message || "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!brief && !loading) {
    return (
      <Card className="glass-card border-accent/20 bg-gradient-to-br from-accent/[0.04] to-transparent">
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0">
              <Brain className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Brief me on this client</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                A 5-line snapshot — relationship, value, last touch, risk, next move.
              </p>
            </div>
          </div>
          <Button size="sm" onClick={generate} className="gap-2 flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5" /> Generate brief
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-accent/30 bg-gradient-to-br from-accent/[0.06] to-transparent">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
            <Brain className="w-4 h-4 text-accent" /> AI Client Brief
          </h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={generate}
            disabled={loading}
            className="h-7 px-2 gap-1.5 text-xs text-muted-foreground"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {loading && !brief ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-3">
            <Loader2 className="w-4 h-4 animate-spin" /> Reading the relationship…
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
