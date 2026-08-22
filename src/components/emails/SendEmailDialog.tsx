import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  ClientTemplateKey, TEMPLATE_BY_KEY, renderClientTemplate,
} from "@/lib/email-templates-defaults";
import { Loader2, Send, Copy, Eye, Pencil } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templateKey: ClientTemplateKey;
  recipientEmail: string;
  recipientName?: string;
  vars: Record<string, string | number | undefined | null>;
  meta?: Record<string, unknown>; // proposal_id, contract_id, etc — stored on log
  idempotencyKey?: string;
  onSent?: () => void;
}

export default function SendEmailDialog(props: Props) {
  const { toast } = useToast();
  const def = TEMPLATE_BY_KEY[props.templateKey];
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [recipient, setRecipient] = useState(props.recipientEmail);
  const [subject, setSubject] = useState(def.subject);
  const [body, setBody] = useState(def.body);
  const [ctaText, setCtaText] = useState(def.cta_text);
  const [signOff, setSignOff] = useState(def.sign_off);
  const [branding, setBranding] = useState<any>(null);

  useEffect(() => {
    if (!props.open) return;
    setRecipient(props.recipientEmail);
    (async () => {
      setLoading(true);
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setLoading(false); return; }
      const [tplRes, brandRes] = await Promise.all([
        supabase.from("email_templates").select("*").eq("user_id", u.user.id).eq("template_key", props.templateKey).maybeSingle(),
        supabase.from("business_branding").select("*").eq("user_id", u.user.id).maybeSingle(),
      ]);
      const t = tplRes.data as any;
      setSubject(t?.subject || def.subject);
      setBody(t?.body || def.body);
      setCtaText(t?.cta_text || def.cta_text);
      setSignOff(t?.sign_off || def.sign_off);
      setBranding(brandRes.data || null);
      setLoading(false);
    })();
  }, [props.open, props.templateKey]);

  const rendered = useMemo(() => {
    const fullVars: Record<string, string | number | undefined | null> = {
      client_name: props.recipientName || "",
      ...props.vars,
    };
    return renderClientTemplate(def, {
      vars: fullVars,
      branding: {
        business_name: branding?.business_name || "",
        logo_url: branding?.logo_url || "",
        brand_color: branding?.brand_color || "#3b82f6",
        sender_name: branding?.default_sender_name || "",
        sign_off: branding?.default_sign_off || "",
        reply_to_email: branding?.reply_to_verified_email || "",
      },
    }, { subject, body, cta_text: ctaText, sign_off: signOff });
  }, [def, branding, subject, body, ctaText, signOff, props.recipientName, props.vars]);

  const send = async () => {
    if (!recipient) {
      toast({ title: "Recipient required", variant: "destructive" });
      return;
    }
    setSending(true);
    const fromName = branding?.default_sender_name || branding?.business_name || "CloseSync AI";
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: {
        templateName: props.templateKey,
        recipientEmail: recipient,
        idempotencyKey: props.idempotencyKey,
        from: `${fromName} <notify@closesync.io>`,
        replyTo: branding?.reply_to_verified_email || undefined,
        // Pre-rendered passthrough — edge function will use these directly.
        prerendered: { subject: rendered.subject, html: rendered.html, text: rendered.text },
        meta: props.meta,
      },
    });
    setSending(false);
    if (error || (data as any)?.error) {
      toast({ title: "Send failed", description: error?.message || (data as any)?.error, variant: "destructive" });
      return;
    }
    toast({ title: "Email sent", description: `To ${recipient}` });
    props.onOpenChange(false);
    props.onSent?.();
  };

  const copy = async () => {
    await navigator.clipboard.writeText(rendered.html);
    toast({ title: "Copied HTML to clipboard" });
  };

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send: {def.label}</DialogTitle>
          <DialogDescription>
            Review the recipient and message before sending this email.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="p-8 flex justify-center" role="status" aria-live="polite">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Loading email settings</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex rounded-md border border-border p-0.5" role="group" aria-label="Email view mode">
                <Button size="sm" variant={mode === "edit" ? "default" : "ghost"} onClick={() => setMode("edit")} aria-pressed={mode === "edit"} className="h-7 gap-1.5">
                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Edit
                </Button>
                <Button size="sm" variant={mode === "preview" ? "default" : "ghost"} onClick={() => setMode("preview")} aria-pressed={mode === "preview"} className="h-7 gap-1.5">
                  <Eye className="w-3.5 h-3.5" aria-hidden="true" /> Preview
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="send-email-recipient" className="text-xs">Recipient</Label>
              <Input id="send-email-recipient" className="mt-1.5" value={recipient} onChange={(e) => setRecipient(e.target.value)} type="email" autoComplete="email" required />
            </div>

            {mode === "edit" ? (
              <>
                <div>
                  <Label htmlFor="send-email-subject" className="text-xs">Subject</Label>
                  <Input id="send-email-subject" className="mt-1.5" value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="send-email-body" className="text-xs">Body</Label>
                  <Textarea id="send-email-body" rows={10} className="mt-1.5 font-mono text-sm" value={body} onChange={(e) => setBody(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="send-email-cta" className="text-xs">CTA text</Label>
                    <Input id="send-email-cta" className="mt-1.5" value={ctaText} onChange={(e) => setCtaText(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="send-email-sign-off" className="text-xs">Sign-off</Label>
                    <Input id="send-email-sign-off" className="mt-1.5" value={signOff} onChange={(e) => setSignOff(e.target.value)} />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="text-sm"><span className="text-muted-foreground">Subject:</span> <span className="font-medium">{rendered.subject}</span></div>
                <div className="rounded-lg border border-border overflow-hidden bg-white">
                  <iframe title="email preview" srcDoc={rendered.html} className="w-full" style={{ height: 480, border: 0 }} />
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={copy} className="gap-1.5"><Copy className="w-4 h-4" aria-hidden="true" /> Copy HTML</Button>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>Cancel</Button>
          <Button onClick={send} disabled={sending} aria-busy={sending} className="gap-1.5">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Send className="w-4 h-4" aria-hidden="true" />} Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
