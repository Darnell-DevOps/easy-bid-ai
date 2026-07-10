import { useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import ContractRenderer from "@/components/contracts/ContractRenderer";
import SignatureBlock from "@/components/contracts/SignatureBlock";
import CountersignDialog from "@/components/contracts/CountersignDialog";
import { Loader2, ArrowLeft, Copy, ExternalLink, Send, CheckCircle2, Clock, Eye, Download, FileSignature } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { contractTypeLabel, type ContractRow, type ContractSignatureRow } from "@/lib/contracts";
import { sendEmail } from "@/lib/email";
import { renderMergeTags } from "@/lib/merge-tags";
import { WhatsAppButton } from "@/components/whatsapp/WhatsAppButton";
import { downloadContractPdf } from "@/lib/contract-pdf";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-accent/15 text-accent",
  viewed: "bg-purple/15 text-purple",
  signed: "bg-purple/15 text-purple",
  executed: "bg-emerald-500/15 text-emerald-500",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "draft",
  sent: "sent",
  viewed: "viewed",
  signed: "awaiting countersignature",
  executed: "executed",
};

export default function ContractDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [contract, setContract] = useState<ContractRow | null>(null);
  const [signatures, setSignatures] = useState<ContractSignatureRow[]>([]);
  const [intake, setIntake] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [clientPhone, setClientPhone] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [countersignOpen, setCountersignOpen] = useState(false);
  const [ownerName, setOwnerName] = useState("");
  const pdfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      const meta: any = u.user_metadata || {};
      setOwnerName(meta.full_name || meta.name || u.email || "");
    });
  }, []);

  const load = async () => {
    if (!id) return;
    const [{ data: c }, { data: sigs }] = await Promise.all([
      supabase.from("contracts").select("*").eq("id", id).maybeSingle(),
      supabase.from("contract_signatures").select("*").eq("contract_id", id).order("signed_at", { ascending: false }),
    ]);
    setContract((c as any) || null);
    setSignatures((sigs as any) || []);
    if ((c as any)?.client_id) {
      const { data: cl } = await supabase
        .from("clients")
        .select("intake_responses, phone")
        .eq("id", (c as any).client_id)
        .maybeSingle();
      setIntake(((cl as any)?.intake_responses as Record<string, string>) || null);
      setClientPhone(((cl as any)?.phone as string) || null);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      </DashboardLayout>
    );
  }

  if (!contract) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <p className="text-foreground font-semibold">Contract not found</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/dashboard/contracts")}>Back to contracts</Button>
        </div>
      </DashboardLayout>
    );
  }

  const signingUrl = `${window.location.origin}/sign/${contract.signing_token}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(signingUrl);
    toast({ title: "Link copied" });
  };

  const sendForSignature = async () => {
    const { error } = await supabase
      .from("contracts")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", contract.id);
    if (error) {
      toast({ title: "Couldn't send", description: error.message, variant: "destructive" });
      return;
    }
    if (contract.client_email) {
      void sendEmail({
        templateName: "contract-signature-reminder",
        recipientEmail: contract.client_email,
        userId: contract.user_id,
        idempotencyKey: `contract-sent-${contract.id}`,
        data: {
          from_name: contract.company_name || "Your contact",
          title: contract.title,
          url: signingUrl,
        },
      });
    }
    await navigator.clipboard.writeText(signingUrl);
    toast({ title: "Marked as sent", description: "Signing link copied to clipboard — share it with your client." });
    load();
  };

  const downloadPdf = async () => {
    if (!pdfRef.current || !contract) return;
    setDownloading(true);
    try {
      await downloadContractPdf(pdfRef.current, contract.title);
    } catch (e: any) {
      toast({ title: "Couldn't generate PDF", description: e?.message || "Try again.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };


  const handleCountersigned = async () => {
    await load();
    if (contract?.client_email) {
      const url = `${window.location.origin}/sign/${contract.signing_token}`;
      void sendEmail({
        templateName: "contract-executed",
        recipientEmail: contract.client_email,
        userId: contract.user_id,
        idempotencyKey: `contract-executed-${contract.id}`,
        data: {
          title: contract.title,
          client_name: contract.client_name,
          from_name: contract.company_name || ownerName || "Your contact",
          url,
        },
      });
    }
  };

  const clientSig = signatures.find((s: any) => s.signer_role === "client") || signatures[0] || null;
  const providerSig = signatures.find((s: any) => s.signer_role === "provider") || null;
  const isExecuted = contract?.status === "executed";
  const isAwaitingCountersign = contract?.status === "signed" && !providerSig;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <Link to="/dashboard/contracts" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> All Contracts
        </Link>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold text-foreground">{contract.title}</h1>
                  <Badge className={`${STATUS_STYLES[contract.status] || STATUS_STYLES.draft} border-0`}>{STATUS_LABEL[contract.status] || contract.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {contractTypeLabel(contract.contract_type)} · For {contract.client_name}
                  {contract.company_name ? ` · ${contract.company_name}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="gap-2" onClick={copyLink}>
                  <Copy className="w-4 h-4" /> Copy link
                </Button>
                <Button variant="outline" className="gap-2" asChild>
                  <a href={signingUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-4 h-4" /> Open
                  </a>
                </Button>
                <WhatsAppButton
                  phone={clientPhone}
                  context="contract"
                  vars={{ clientName: contract.client_name, link: signingUrl }}
                  variant="outline"
                  size="default"
                  label="WhatsApp"
                />
                <Button variant="outline" className="gap-2" onClick={downloadPdf} disabled={downloading}>
                  {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {isExecuted ? "Download Executed PDF" : "Download PDF"}
                </Button>
                {contract.status === "draft" && (
                  <Button className="gap-2 bg-accent text-accent-foreground" onClick={sendForSignature}>
                    <Send className="w-4 h-4" /> Send for signature
                  </Button>
                )}
                {isAwaitingCountersign && (
                  <Button
                    className="gap-2 bg-accent text-accent-foreground font-semibold"
                    onClick={() => setCountersignOpen(true)}
                  >
                    <FileSignature className="w-4 h-4" /> Countersign contract
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
              <Timeline icon={Send} label="Sent" value={contract.sent_at} />
              <Timeline icon={Eye} label="Viewed" value={contract.viewed_at} />
              <Timeline icon={CheckCircle2} label="Client signed" value={contract.signed_at} />
              <Timeline icon={FileSignature} label="Executed" value={(contract as any).countersigned_at || null} />
            </div>
          </CardContent>
        </Card>

        {isAwaitingCountersign && (
          <Card className="border-purple/40 bg-purple/5">
            <CardContent className="p-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple/15 flex items-center justify-center">
                  <FileSignature className="w-5 h-5 text-purple" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Your client has signed</p>
                  <p className="text-xs text-muted-foreground">Add your countersignature to make this contract fully executed.</p>
                </div>
              </div>
              <Button
                className="gap-2 bg-accent text-accent-foreground font-semibold"
                onClick={() => setCountersignOpen(true)}
              >
                <FileSignature className="w-4 h-4" /> Countersign now
              </Button>
            </CardContent>
          </Card>
        )}

        {signatures.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Signatures</h2>
              <ul className="space-y-3">
                {signatures.map((s) => (
                  <li key={s.id} className="flex items-start gap-3 border border-border rounded-lg p-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{s.signer_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.signer_email || "No email"} · {new Date(s.signed_at).toLocaleString()}
                        {s.ip_address ? ` · IP ${s.ip_address}` : ""}
                      </p>
                      {s.method === "drawn" && s.signature_data.startsWith("data:image") ? (
                        <img src={s.signature_data} alt="signature" className="mt-2 max-h-16 rounded bg-white p-1" />
                      ) : (
                        <p className="mt-2 text-lg italic text-foreground" style={{ fontFamily: "'Caveat', 'Brush Script MT', cursive" }}>
                          {s.signature_data}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-8">
            <div
              ref={pdfRef}
              className="pdf-export-surface"
              style={{ background: "#ffffff", color: "#0f172a", padding: "32px", borderRadius: 8 }}
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
                  {contractTypeLabel(contract.contract_type)} · For {contract.client_name}
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
          </CardContent>
        </Card>
      </div>

      <CountersignDialog
        open={countersignOpen}
        onOpenChange={setCountersignOpen}
        contractId={contract.id}
        defaultName={ownerName}
        onSigned={handleCountersigned}
      />
    </DashboardLayout>
  );
}

function Timeline({ icon: Icon, label, value }: { icon: any; label: string; value: string | null }) {
  const done = !!value;
  return (
    <div className={`flex items-center gap-2 text-xs ${done ? "text-foreground" : "text-muted-foreground"}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center ${done ? "bg-emerald-500/15 text-emerald-500" : "bg-muted/50"}`}>
        {done ? <Icon className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
      </div>
      <div>
        <p className="font-semibold">{label}</p>
        <p className="text-muted-foreground">{value ? new Date(value).toLocaleString() : "—"}</p>
      </div>
    </div>
  );
}
