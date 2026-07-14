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
import DynamicFavicon from "@/components/branding/DynamicFavicon";
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
  Download,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { renderMergeTags } from "@/lib/merge-tags";
import { sendEmail } from "@/lib/email";
import { downloadContractPdf } from "@/lib/contract-pdf";

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
  countersigned_at?: string | null;
  countersigner_name?: string | null;
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
  const [proposalPaid, setProposalPaid] = useState(false);
  const [intake, setIntake] = useState<Record<string, string> | null>(null);
  const [signatures, setSignatures] = useState<Array<{
    id: string;
    signer_name: string;
    signer_email: string | null;
    method: "typed" | "drawn";
    signature_data: string;
    signed_at: string;
    signer_role?: "client" | "provider";
  }>>([]);
  const [downloading, setDownloading] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  // Drawn signature state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      const { data: rows, error } = (await supabase.rpc(
        "public_get_contract_by_token" as never,
        { _token: token } as never,
      )) as { data: any; error: any };
      const arr: any[] = Array.isArray(rows) ? rows : [];
      const data = arr.length > 0 ? arr[0] : null;
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
      if ((data as any).status === "signed" || (data as any).status === "executed") {
        supabase
          .rpc("public_get_contract_signatures_by_token" as never, { _token: token } as never)
          .then(({ data: sigs }) => {
            if (Array.isArray(sigs)) setSignatures(sigs as any);
          });
      }

      // Mark viewed (non-blocking)
      supabase.rpc("contract_record_view", { _token: token });

      // Fetch first booking link from owner (for kickoff CTA)
      (supabase.rpc(
        "public_get_first_booking_link_for_user" as never,
        { _user_id: (data as any).user_id } as never,
      ) as unknown as Promise<{ data: any }>)
        .then(({ data: rows }) => {
          const bl = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
          if (bl?.slug) setBookingSlug(bl.slug);
        });

      // If this contract is tied to a proposal that also has a retainer, surface
      // the retainer subscribe link so the client can start their subscription.
      if ((data as any).proposal_id) {
        (supabase.rpc(
          "public_get_retainer_token_for_proposal" as never,
          { _proposal_id: (data as any).proposal_id } as never,
        ) as unknown as Promise<{ data: any }>)
          .then(({ data: rt }) => {
            const row = Array.isArray(rt) && rt.length > 0 ? rt[0] : null;
            if (row?.access_token) setRetainerToken(row.access_token);
          });

        (supabase.rpc(
          "public_get_proposal_by_id" as never,
          { _id: (data as any).proposal_id } as never,
        ) as unknown as Promise<{ data: any }>)
          .then(({ data: pr }) => {
            const row = Array.isArray(pr) && pr.length > 0 ? pr[0] : null;
            if (row) setProposalPaid(!!row.client_paid);
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
      const { data: sigs } = (await supabase.rpc(
        "public_get_contract_signatures_by_token" as never,
        { _token: contract.signing_token } as never,
      )) as { data: any };
      if (Array.isArray(sigs)) setSignatures(sigs as any);
      toast({ title: "Contract signed", description: "Thank you — your signature has been recorded. The provider will countersign shortly." });

      // Notify the contract owner so they can countersign.
      try {
        const { data: ownerRows } = await supabase.rpc("get_contract_owner_email", { _token: contract.signing_token });
        const owner = Array.isArray(ownerRows) ? ownerRows[0] : ownerRows;
        if (owner?.owner_email) {
          const ownerUrl = `${window.location.origin}/dashboard/contracts/${contract.id}`;
          void sendEmail({
            templateName: "contract-awaiting-countersign",
            recipientEmail: owner.owner_email,
            userId: contract.user_id,
            idempotencyKey: `contract-awaiting-countersign-${contract.id}`,
            data: {
              title: contract.title,
              client_name: signerName.trim() || contract.client_name,
              url: ownerUrl,
            },
          });
        }
      } catch (notifyErr) {
        console.warn("countersign notify failed:", notifyErr);
      }
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

  const isSigned = contract.status === "signed" || contract.status === "executed";
  const isDraft = contract.status === "draft";
  const isExecuted = contract.status === "executed";
  const clientSig = signatures.find((s) => s.signer_role === "client") || signatures.find((s) => !s.signer_role) || null;
  const providerSig = signatures.find((s) => s.signer_role === "provider") || null;

  const handleDownload = async () => {
    if (!pdfRef.current) return;
    setDownloading(true);
    try {
      await downloadContractPdf(pdfRef.current, contract.title);
    } catch (e: any) {
      toast({ title: "Couldn't generate PDF", description: e?.message || "Try again.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <DynamicFavicon userId={contract?.user_id} />
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileSignature className="w-5 h-5 text-purple shrink-0" />
            <span className="text-sm font-semibold text-foreground truncate">{contract.title}</span>
          </div>
          {isExecuted ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" /> Executed
            </span>
          ) : isSigned ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple bg-purple/10 px-2.5 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" /> Signed — awaiting countersignature
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
          <ContractRenderer
            content={renderMergeTags(contract.body, {
              client: { name: contract.client_name, email: contract.client_email, company: contract.company_name },
              intake,
            })}
            clientSignature={clientSig as any}
            providerSignature={providerSig as any}
          />
          <SignatureBlock signatures={signatures as any} />
        </section>

        {/* Signature OR success */}
        {isSigned ? (
          <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 lg:p-10 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 mb-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-2">
              {isExecuted ? "Contract fully executed" : "Contract signed successfully"}
            </h2>
            <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
              {isExecuted
                ? "Both parties have signed. Download a copy for your records."
                : "Your signature has been recorded. The provider will countersign and you'll receive the executed contract by email."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
              {isExecuted && (
                <Button size="lg" variant="outline" className="gap-2" onClick={handleDownload} disabled={downloading}>
                  {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Download Executed PDF
                </Button>
              )}
              {retainerToken ? (
                <Button size="lg" asChild className="gap-2 bg-accent text-accent-foreground font-semibold">
                  <Link to={`/retainer/${retainerToken}`}>
                    <CreditCard className="w-4 h-4" /> Start subscription
                  </Link>
                </Button>
              ) : contract.proposal_id && !proposalPaid ? (
                <Button size="lg" asChild className="gap-2 bg-accent text-accent-foreground font-semibold">
                  <Link to={`/proposal/view/${contract.proposal_id}`}>
                    <CreditCard className="w-4 h-4" /> Complete payment
                  </Link>
                </Button>
              ) : null}
              {bookingSlug && (
                <Button size="lg" variant={(contract.proposal_id && !proposalPaid) || retainerToken ? "outline" : "default"} asChild className="gap-2">
                  <Link to={`/book/${bookingSlug}${contract.proposal_id ? `?proposal=${contract.proposal_id}` : ""}`}>
                    <CalendarPlus className="w-4 h-4" /> Book kickoff call
                  </Link>
                </Button>
              )}
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-border bg-card p-6 lg:p-8">
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
              className="w-full sm:w-auto gap-2 bg-accent text-accent-foreground font-semibold hover:bg-accent/90"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Sign Contract
            </Button>
          </section>
        )}
      </main>

      {isExecuted && (
        <div style={{ position: "fixed", left: -10000, top: 0, width: 794 }} aria-hidden="true">
          <div
            ref={pdfRef}
            className="pdf-export-surface"
            style={{ background: "#ffffff", color: "#0f172a", padding: 32, borderRadius: 8 }}
          >
            <style>{`
              .pdf-export-surface, .pdf-export-surface * {
                color: #0f172a !important;
                background-color: transparent !important;
                border-color: #e2e8f0 !important;
              }
              .pdf-export-surface { background-color: #ffffff !important; }
            `}</style>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{contract.title}</h1>
              <p style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
                For {contract.client_name}
                {contract.company_name ? ` · ${contract.company_name}` : ""}
              </p>
            </div>
            <ContractRenderer
              content={renderMergeTags(contract.body, {
                client: { name: contract.client_name, email: contract.client_email, company: contract.company_name },
                intake,
              })}
              clientSignature={clientSig as any}
              providerSignature={providerSig as any}
            />
            <SignatureBlock signatures={signatures as any} />
          </div>
        </div>
      )}
    </div>
  );
}
