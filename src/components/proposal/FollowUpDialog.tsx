import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Copy, Mail, Send, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  buildFollowUpTemplate,
  FOLLOW_UP_META,
  type FollowUpScenario,
  type FollowUpTemplateInput,
} from "@/lib/follow-up";

interface FollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenario: Exclude<FollowUpScenario, "none">;
  templateInput: FollowUpTemplateInput;
  clientEmail?: string | null;
}

export default function FollowUpDialog({
  open,
  onOpenChange,
  scenario,
  templateInput,
  clientEmail,
}: FollowUpDialogProps) {
  const { toast } = useToast();
  const meta = FOLLOW_UP_META[scenario];
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!open) return;
    const t = buildFollowUpTemplate(scenario, templateInput);
    setSubject(t.subject);
    setBody(t.body);
  }, [open, scenario, templateInput]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    toast({ title: "Follow-up copied", description: "Paste into your email client." });
  };

  const handleEmail = () => {
    const to = clientEmail ? encodeURIComponent(clientEmail) : "";
    const s = encodeURIComponent(subject);
    const b = encodeURIComponent(body);
    window.location.href = `mailto:${to}?subject=${s}&body=${b}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-accent" />
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              {meta.badge}
            </Badge>
          </div>
          <DialogTitle>{meta.headline}</DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="follow-up-subject" className="text-xs">Subject</Label>
            <Input
              id="follow-up-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="follow-up-body" className="text-xs">Message</Label>
            <Textarea
              id="follow-up-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="text-sm leading-relaxed"
            />
            <p className="text-[11px] text-muted-foreground">
              Edit freely — this is a starting point you can personalise.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleCopy} className="gap-2">
            <Copy className="w-4 h-4" /> Copy
          </Button>
          <Button onClick={handleEmail} className="gap-2">
            {clientEmail ? <Mail className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            {clientEmail ? "Email client" : "Open email"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
