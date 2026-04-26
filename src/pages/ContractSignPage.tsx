import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ContractRenderer from "@/components/contracts/ContractRenderer";
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
    };
    load();
  }, [token]);

  // Canvas init for high-DPI sharp drawing
  useEffect(() => {
    if (method !== "drawn") return;
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * dpr;
    c.height = rect.height * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
  }, [method]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const t = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
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
    setHasDrawn(true);
  };
  const stopDraw = () => {
    drawingRef.current = false;
    lastPosRef.current = null;
  };
  const clearCanvas = () => {
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
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
          <ContractRenderer content={contract.body} />
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
              {contract.proposal_id && (
                <Button size="lg" asChild className="gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold">
                  <Link to={`/proposal/view/${contract.proposal_id}`}>
                    <CreditCard className="w-4 h-4" /> Complete payment
                  </Link>
                </Button>
              )}
              {bookingSlug && (
                <Button size="lg" variant={contract.proposal_id ? "outline" : "default"} asChild className="gap-2">
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
