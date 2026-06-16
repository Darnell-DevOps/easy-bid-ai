import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import ContractRenderer from "@/components/contracts/ContractRenderer";
import { Loader2, ArrowLeft, Copy, ExternalLink, Send, CheckCircle2, Clock, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { contractTypeLabel, type ContractRow, type ContractSignatureRow } from "@/lib/contracts";
import { sendEmail } from "@/lib/email";
import { renderMergeTags } from "@/lib/merge-tags";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-accent/15 text-accent",
  viewed: "bg-purple/15 text-purple",
  signed: "bg-emerald-500/15 text-emerald-500",
};

export default function ContractDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [contract, setContract] = useState<ContractRow | null>(null);
  const [signatures, setSignatures] = useState<ContractSignatureRow[]>([]);
  const [intake, setIntake] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);

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
                  <Badge className={`${STATUS_STYLES[contract.status]} border-0`}>{contract.status}</Badge>
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
                {contract.status === "draft" && (
                  <Button className="gap-2 bg-gradient-to-r from-accent to-purple text-white" onClick={sendForSignature}>
                    <Send className="w-4 h-4" /> Send for signature
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <Timeline icon={Send} label="Sent" value={contract.sent_at} />
              <Timeline icon={Eye} label="Viewed" value={contract.viewed_at} />
              <Timeline icon={CheckCircle2} label="Signed" value={contract.signed_at} />
            </div>
          </CardContent>
        </Card>

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
            <ContractRenderer content={renderMergeTags(contract.body, {
              client: { name: contract.client_name, email: contract.client_email, company: contract.company_name },
              intake,
            })} />
          </CardContent>
        </Card>
      </div>
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
