import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Copy, Mail, Sparkles, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Tone = "warm" | "firm" | "negotiation";

interface ReplyDrafterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  clientName?: string;
  clientEmail?: string | null;
  scenario?: string;
  defaultTone?: Tone;
  triggerLabel?: string;
}

const TONES: { value: Tone; label: string; hint: string }[] = [
  { value: "warm", label: "Warm", hint: "Friendly, conversational, inviting." },
  { value: "firm", label: "Firm", hint: "Confident, defends value, direct." },
  { value: "negotiation", label: "Negotiate", hint: "Offers a path forward." },
];

export default function ReplyDrafterDialog({
  open,
  onOpenChange,
  message,
  clientName,
  clientEmail,
  scenario,
  defaultTone = "warm",
}: ReplyDrafterDialogProps) {
  const { toast } = useToast();
  const [tone, setTone] = useState<Tone>(defaultTone);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [oneLiner, setOneLiner] = useState("");

  const generate = async (selectedTone: Tone = tone) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-reply-drafter", {
        body: {
          message,
          tone: selectedTone,
          context: { clientName, scenario },
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setSubject(data.subject || "");
      setBody(data.body || "");
      setOneLiner(data.one_liner || "");
    } catch (e: any) {
      toast({
        title: "Couldn't draft a reply",
        description: e?.message || "Try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (next && !body && !loading) {
      void generate(tone);
    }
  };

  const switchTone = (t: Tone) => {
    setTone(t);
    void generate(t);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    toast({ title: "Reply copied" });
  };

  const handleEmail = () => {
    const to = clientEmail ? encodeURIComponent(clientEmail) : "";
    const s = encodeURIComponent(subject);
    const b = encodeURIComponent(body);
    window.location.href = `mailto:${to}?subject=${s}&body=${b}`;
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" /> AI Reply Drafter
          </DialogTitle>
          <DialogDescription>
            Pick a tone — we'll draft a reply you can copy or send.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tone} onValueChange={(v) => switchTone(v as Tone)}>
          <TabsList className="w-full grid grid-cols-3">
            {TONES.map((t) => (
              <TabsTrigger key={t.value} value={t.value} disabled={loading}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <p className="text-[11px] text-muted-foreground mt-2">
            {TONES.find((t) => t.value === tone)?.hint}
          </p>
        </Tabs>

        {loading && !body ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Drafting…
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            {oneLiner && (
              <div className="text-[11px] text-muted-foreground italic border-l-2 border-accent/40 pl-2">
                {oneLiner}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="reply-subject" className="text-xs">Subject</Label>
              <Input
                id="reply-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reply-body" className="text-xs">Reply</Label>
              <Textarea
                id="reply-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                className="text-sm leading-relaxed"
              />
              <p className="text-[11px] text-muted-foreground">
                Edit freely — this is a starting point.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={() => generate(tone)}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Regenerate
          </Button>
          <Button variant="outline" onClick={handleCopy} disabled={!body} className="gap-2">
            <Copy className="w-4 h-4" /> Copy
          </Button>
          <Button onClick={handleEmail} disabled={!body} className="gap-2">
            <Mail className="w-4 h-4" /> {clientEmail ? "Email client" : "Open email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
