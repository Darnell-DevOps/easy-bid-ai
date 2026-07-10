import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, ShieldCheck, Eraser } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CountersignDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contractId: string;
  defaultName?: string;
  defaultEmail?: string;
  onSigned: () => void;
}

/**
 * Owner-side dialog to capture the provider's countersignature for a
 * client-signed contract. Mirrors the public ContractSignPage signing UI
 * (typed/drawn) and calls the `contract_countersign` RPC.
 */
export default function CountersignDialog({
  open,
  onOpenChange,
  contractId,
  defaultName = "",
  defaultEmail = "",
  onSigned,
}: CountersignDialogProps) {
  const { toast } = useToast();
  const [method, setMethod] = useState<"typed" | "drawn">("typed");
  const [signerName, setSignerName] = useState(defaultName);
  const [signerEmail, setSignerEmail] = useState(defaultEmail);
  const [submitting, setSubmitting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);
  const hasDrawnRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    setSignerName(defaultName);
    setSignerEmail(defaultEmail);
  }, [defaultName, defaultEmail, open]);

  const resizeCanvas = () => {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);
    if (c.width === targetW && c.height === targetH) return;
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

  useEffect(() => {
    if (!open || method !== "drawn") return;
    const t = setTimeout(resizeCanvas, 50);
    return () => clearTimeout(t);
  }, [open, method]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const c = canvasRef.current!;
    const rect = c.getBoundingClientRect();
    const t = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  };
  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
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

  const submit = async () => {
    if (signerName.trim().length < 2) {
      toast({ title: "Full name required", variant: "destructive" });
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
      const { error } = await supabase.rpc("contract_countersign", {
        _contract_id: contractId,
        _signer_name: signerName.trim(),
        _signer_email: signerEmail.trim() || null,
        _method: method,
        _signature_data: signature_data,
        _ua: navigator.userAgent.slice(0, 512),
      });
      if (error) throw error;
      toast({ title: "Contract executed", description: "Your countersignature has been recorded." });
      onSigned();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Couldn't countersign", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Countersign contract</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Your client has signed. Add your signature to mark this contract fully executed.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label>Full legal name *</Label>
            <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Your name" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} placeholder="you@example.com" />
          </div>
        </div>
        <Tabs value={method} onValueChange={(v) => setMethod(v as any)}>
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
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={submitting}
            className="gap-2 bg-accent text-accent-foreground font-semibold"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Countersign &amp; execute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
