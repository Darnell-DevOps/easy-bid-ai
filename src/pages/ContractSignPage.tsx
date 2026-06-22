import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ContractRenderer from "@/components/contracts/ContractRenderer";
import SignatureBlock from "@/components/contracts/SignatureBlock";
import {
  Loader2,
  CheckCircle2,
  ShieldCheck,
  FileSignature,
  Sparkles,
  CalendarPlus,
  CreditCard,
  Eraser,
  Lock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { renderMergeTags } from "@/lib/merge-tags";

interface PublicContract {
  id: string;
  user_id: string;
  proposal_id: string | null;
  contract_type: string;
  title: string;
  client_name: string;
  client_email: string | null;
  company_name: string | null;
  body: string;
  status: string;
  signing_token: string;
  signed_at: string | null;
  amount_cents: number | null;
  currency: string | null;
}

export default function ContractSignPage() {
  const { token } = useParams();
  const { toast } = useToast();
  const [contract, setContract] = useState<PublicContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [method, setMethod] = useState<"typed" | "drawn">("typed");
  const [bookingSlug, setBookingSlug] = useState<string | null>(null);
  const [retainerToken, setRetainerToken] = useState<string | null>(null);
  const [intake, setIntake] = useState<Record<string, string> | null>(null);
  const [signatures, setSignatures] = useState<Array<{
    id: string;
    signer_name: string;
    signer_email: string | null;
    method: "typed" | "drawn";
    signature_data: string;
    signed_at: string;
  }>>([]);

  // Drawn signature state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select("*")
        .eq("signing_token", token)
        .maybeSingle();
      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setContract(data as any);
      setSignerName((data as any).client_name || "");
      setSignerEmail((data as any).client_email || "");
      setLoading(false);

      // If already signed, load existing signatures so they render inside the contract.
      if ((data as any).status === "signed") {
        supabase
          .from("contract_signatures")
          .select("id, signer_name, signer_email, method, signature_data, signed_at")
          .eq("contract_id", (data as any).id)
          .order("signed_at", { ascending: true })
          .then(({ data: sigs }) => {
            if (sigs) setSignatures(sigs as any);
          });
      }

      // Mark viewed (non-blocking)
      supabase.rpc("contract_record_view", { _token: token });

      // Fetch first booking link from owner (for kickoff CTA)
      supabase
        .from("booking_links")
        .select("slug")
        .eq("user_id", (data as any).user_id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle()
        .then(({ data: bl }) => {
          if (bl) setBookingSlug((bl as any).slug);
        });

      // If this contract is tied to a proposal that also has a retainer, surface
      // the retainer subscribe link so the client can start their subscription.
      if ((data as any).proposal_id) {
        supabase
          .from("retainers")
          .select("access_token")
          .eq("proposal_id", (data as any).proposal_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(({ data: rt }) => {
            if (rt) setRetainerToken((rt as any).access_token);
          });
      }

      // Pull intake responses from the linked client (if any) for merge-tag rendering.
      if ((data as any).client_email) {
        supabase
          .from("clients")
          .select("intake_responses")
          .eq("user_id", (data as any).user_id)
          .eq("email", (data as any).client_email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
          .then(({ data: cl }) => {
            if (cl) setIntake(((cl as any).intake_responses as Record<string, string>) || null);
          });
      }
    };
    load();
  }, [token]);

  // Canvas init for high-DPI sharp drawing. Re-sizes on layout changes so the
  // pointer always lines up with the stroke.
  const resizeCanvas = () => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);
    if (c.width === targetW && c.height === targetH) return;
    // Preserve existing strokes across resizes.
    const prev = hasDrawnRef.current ? c.toDataURL("image/png") : null;
    c.width = targetW;
    c.height = targetH;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    if (prev) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = prev;
    }
  };

  const hasDrawnRef = useRef(false);

  useEffect(() => {
    if (method !== "drawn") return;
    resizeCanvas();
    const c = canvasRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => resizeCanvas());
    ro.observe(c);
    const onWin = () => resizeCanvas();
    window.addEventListener("resize", onWin);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onWin);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const t = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    // Re-sync the backing store with the displayed size before each stroke,
    // so any layout shift since the canvas was last sized can't offset the pointer.
    resizeCanvas();
    drawingRef.current = true;
    lastPosRef.current = getPos(e);
  };
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const pos = getPos(e);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !lastPosRef.current) return;
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPosRef.current = pos;
    hasDrawnRef.current = true;
    if (!hasDrawn) setHasDrawn(true);
  };
  const stopDraw = () => {
    drawingRef.current = false;
    lastPosRef.current = null;
  };
  const clearCanvas = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
    hasDrawnRef.current = false;
    setHasDrawn(false);
  };

  const handleSign = async () => {
    if (!contract) return;
    if (!agreed) {
      toast({ title: "Agreement required", description: "Please confirm you agree before signing.", variant: "destructive" });
      return;
    }
    if (signerName.trim().length < 2) {
      toast({ title: "Full name required", description: "Type your full name to sign.", variant: "destructive" });
      return;
    }

    let signature_data = "";
    if (method === "typed") {
      signature_data = signerName.trim();
    } else {
      if (!hasDrawn) {
        toast({ title: "Signature required", description: "Please draw your signature.", variant: "destructive" });
        return;
      }
      signature_data = canvasRef.current?.toDataURL("image/png") || "";
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc("contract_sign", {
        _token: contract.signing_token,
        _signer_name: signerName.trim(),
        _signer_email: signerEmail.trim() || null,
        _method: method,
        _signature_data: signature_data,
        _ip: null,
        _ua: navigator.userAgent.slice(0, 512),
      });
      if (error) throw error;
      setContract({ ...contract, status: "signed", signed_at: new Date().toISOString() });
      // Pull all signatures for this contract so they appear inline immediately.
      const { data: sigs } = await supabase
        .from("contract_signatures")
        .select("id, signer_name, signer_email, method, signature_data, signed_at")
        .eq("contract_id", contract.id)
        .order("signed_at", { ascending: true });
      if (sigs) setSignatures(sigs as any);
      toast({ title: "Contract signed", description: "Thank you — your signature has been recorded." });
    } catch (e: any) {
      toast({ title: "Couldn't sign", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !contract) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-foreground mb-2">Contract not found</h1>
          <p className="text-muted-foreground text-sm">This signing link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  const isSigned = contract.status === "signed";

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileSignature className="w-5 h-5 text-purple shrink-0" />
            <span className="text-sm font-semibold text-foreground truncate">{contract.title}</span>
          </div>
          {isSigned ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" /> Signed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple bg-purple/10 px-2.5 py-1 rounded-full">
              <Lock className="w-3.5 h-3.5" /> Awaiting signature
            </span>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Hero */}
        <section className="rounded-xl border border-border bg-card p-6 lg:p-10">
          <p className="text-xs uppercase tracking-wider text-purple font-semibold mb-2">Contract for review</p>
          <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">{contract.title}</h1>
          <p className="text-sm text-muted-foreground">
            Prepared for {contract.client_name}{contract.company_name ? ` · ${contract.company_name}` : ""}
          </p>
        </section>

        {/* Contract body */}
        <section className="rounded-xl border border-border bg-card p-6 lg:p-10">
          <ContractRenderer content={renderMergeTags(contract.body, {
            client: { name: contract.client_name, email: contract.client_email, company: contract.company_name },
            intake,
          })} />
          <SignatureBlock signatures={signatures} />
        </section>

        {/* Signature OR success */}
        {isSigned ? (
          <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 lg:p-10 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 mb-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-2">
              Contract signed successfully
            </h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
              A copy has been saved to your records. Here's what's next:
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {retainerToken ? (
                <Button size="lg" asChild className="gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold">
                  <Link to={`/retainer/${retainerToken}`}>
                    <CreditCard className="w-4 h-4" /> Start subscription
                  </Link>
                </Button>
              ) : contract.proposal_id ? (
                <Button size="lg" asChild className="gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold">
                  <Link to={`/proposal/view/${contract.proposal_id}`}>
                    <CreditCard className="w-4 h-4" /> Complete payment
                  </Link>
                </Button>
              ) : null}
              {bookingSlug && (
                <Button size="lg" variant={contract.proposal_id || retainerToken ? "outline" : "default"} asChild className="gap-2">
                  <Link to={`/book/${bookingSlug}${contract.proposal_id ? `?proposal=${contract.proposal_id}` : ""}`}>
                    <CalendarPlus className="w-4 h-4" /> Book kickoff call
                  </Link>
                </Button>
              )}
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-purple/30 bg-gradient-to-br from-purple/5 via-card to-accent/5 p-6 lg:p-8">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-purple" />
              <h2 className="text-lg font-semibold text-foreground">Sign this agreement</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Your typed name or drawn signature, your IP address, and the timestamp will be recorded as your electronic signature.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <Label>Full legal name *</Label>
                <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Jane Smith" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} placeholder="you@example.com" />
              </div>
            </div>

            <Tabs value={method} onValueChange={(v) => setMethod(v as any)} className="mb-4">
              <TabsList className="grid grid-cols-2 w-full sm:w-auto">
                <TabsTrigger value="typed">Type signature</TabsTrigger>
                <TabsTrigger value="drawn">Draw signature</TabsTrigger>
              </TabsList>
              <TabsContent value="typed" className="mt-3">
                <div className="border border-border rounded-lg bg-white p-6 min-h-24 flex items-center justify-center">
                  <p
                    className="text-3xl text-slate-900"
                    style={{ fontFamily: "'Caveat', 'Brush Script MT', cursive" }}
                  >
                    {signerName || "Your signature here"}
                  </p>
                </div>
              </TabsContent>
              <TabsContent value="drawn" className="mt-3">
                <div className="relative border border-border rounded-lg bg-white">
                  <canvas
                    ref={canvasRef}
                    className="w-full h-40 touch-none cursor-crosshair rounded-lg"
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={stopDraw}
                    onMouseLeave={stopDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={stopDraw}
                  />
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="absolute top-2 right-2 inline-flex items-center gap-1 text-xs text-slate-600 bg-white border border-slate-200 px-2 py-1 rounded hover:bg-slate-50"
                  >
                    <Eraser className="w-3 h-3" /> Clear
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Use your mouse or finger to draw your signature.</p>
              </TabsContent>
            </Tabs>

            <label className="flex items-start gap-2 mb-5 cursor-pointer">
              <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(!!v)} className="mt-0.5" />
              <span className="text-sm text-foreground/90">
                I have read and agree to the terms of this {contract.title.toLowerCase()}.
              </span>
            </label>

            <Button
              size="lg"
              onClick={handleSign}
              disabled={submitting}
              className="w-full sm:w-auto gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold shadow-lg hover:brightness-110"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Sign Contract
            </Button>
          </section>
        )}
      </main>
    </div>
  );
}
