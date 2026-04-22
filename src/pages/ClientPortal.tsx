import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, CheckCircle2, XCircle, Sparkles, Building2, Calendar } from "lucide-react";
import PremiumProposalRenderer from "@/components/proposal/PremiumProposalRenderer";
import ReactMarkdown from "react-markdown";
import StatusBadge, { normalizeStatus } from "@/components/proposal/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import ProposalPayNow from "@/components/proposal/ProposalPayNow";

interface PublicProposal {
  id: string;
  client_name: string;
  company_name: string;
  service_type: string;
  proposal_content: string | null;
  pricing_breakdown: string | null;
  created_at: string;
  status: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  client_response_message: string | null;
  amount_cents: number | null;
  currency: string | null;
  client_paid: boolean;
}

export default function ClientPortal() {
  const { id } = useParams();
  const { toast } = useToast();
  const [proposal, setProposal] = useState<PublicProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState<"accept" | "reject" | null>(null);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select(
          "id, client_name, company_name, service_type, proposal_content, pricing_breakdown, created_at, status, accepted_at, rejected_at, client_response_message, amount_cents, currency, client_paid"
        )
        .eq("id", id)
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProposal(data as PublicProposal);
      setLoading(false);

      // Auto-mark as viewed (non-blocking)
      supabase.rpc("client_portal_respond", {
        _proposal_id: id,
        _action: "view",
        _message: null,
      });
    };
    load();
  }, [id]);

  const respond = async (action: "accept" | "reject") => {
    if (!proposal) return;
    setSubmitting(action);
    const { error } = await supabase.rpc("client_portal_respond", {
      _proposal_id: proposal.id,
      _action: action,
      _message: message.trim() || null,
    });
    setSubmitting(null);
    if (error) {
      toast({ title: "Something went wrong", description: error.message, variant: "destructive" });
      return;
    }
    setProposal({
      ...proposal,
      status: action === "accept" ? "accepted" : "rejected",
      accepted_at: action === "accept" ? new Date().toISOString() : null,
      rejected_at: action === "reject" ? new Date().toISOString() : null,
      client_response_message: message.trim() || proposal.client_response_message,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !proposal) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-foreground mb-2">Proposal not found</h1>
          <p className="text-muted-foreground text-sm">
            The link you followed may be invalid or the proposal has been removed.
          </p>
        </div>
      </div>
    );
  }

  const status = normalizeStatus(proposal.status);
  const responded = status === "accepted" || status === "rejected";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-5 h-5 text-purple shrink-0" />
            <span className="text-sm font-semibold text-foreground truncate">Proposal for {proposal.client_name}</span>
          </div>
          <StatusBadge status={status} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 lg:py-12 space-y-6 lg:space-y-8">
        {/* Hero */}
        <div className="rounded-xl border border-border bg-card p-6 lg:p-10">
          <p className="text-xs uppercase tracking-wider text-purple font-semibold mb-3">Proposal</p>
          <h1 className="text-2xl lg:text-4xl font-bold text-foreground mb-4">{proposal.service_type}</h1>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 shrink-0" />
              <span>Prepared for {proposal.company_name || proposal.client_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 shrink-0" />
              <span>{new Date(proposal.created_at).toLocaleDateString(undefined, { dateStyle: "long" })}</span>
            </div>
          </div>
        </div>

        {/* Proposal content */}
        {proposal.proposal_content && (
          <PremiumProposalRenderer content={proposal.proposal_content} />
        )}

        {/* Pricing */}
        {proposal.pricing_breakdown && (
          <div className="rounded-xl border border-purple/30 bg-card p-6 lg:p-10 shadow-lg shadow-purple/5">
            <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-4">Investment</h2>
            <div className="prose prose-invert prose-sm max-w-none text-muted-foreground leading-relaxed">
              <ReactMarkdown>{proposal.pricing_breakdown}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Pay Now — visible once accepted (or already paid) */}
        {(status === "accepted" || proposal.client_paid) && (
          <ProposalPayNow
            proposalId={proposal.id}
            amountCents={proposal.amount_cents}
            currency={proposal.currency}
            clientPaid={proposal.client_paid}
            onPaid={() => setProposal({ ...proposal, client_paid: true })}
          />
        )}

        {/* Response section */}
        <div className="rounded-xl border border-border bg-card p-6 lg:p-10">
          {responded ? (
            <div className="text-center py-4">
              {status === "accepted" ? (
                <>
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 mb-4">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  </div>
                  <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-2">Proposal Accepted</h2>
                  <p className="text-muted-foreground text-sm">
                    Thank you! The team will be in touch shortly to get started.
                  </p>
                </>
              ) : (
                <>
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/15 mb-4">
                    <XCircle className="w-6 h-6 text-rose-500" />
                  </div>
                  <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-2">Proposal Declined</h2>
                  <p className="text-muted-foreground text-sm">
                    Thanks for letting us know. We appreciate your time.
                  </p>
                </>
              )}
              {proposal.client_response_message && (
                <div className="mt-6 mx-auto max-w-lg rounded-lg border border-border bg-background/40 p-4 text-left">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Your message</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{proposal.client_response_message}</p>
                </div>
              )}
            </div>
          ) : (
            <>
              <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-2">Ready to move forward?</h2>
              <p className="text-sm text-muted-foreground mb-5">
                Accept this proposal to get started, or let us know if it's not the right fit.
              </p>
              <Textarea
                placeholder="Optional message (e.g. questions, timing, feedback)"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mb-4 min-h-[90px]"
                disabled={!!submitting}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  size="lg"
                  onClick={() => respond("accept")}
                  disabled={!!submitting}
                  className="gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold shadow-lg hover:brightness-110 hover:shadow-purple/30 transition-all h-12"
                >
                  {submitting === "accept" ? (
                    <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  )}
                  Accept Proposal
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => respond("reject")}
                  disabled={!!submitting}
                  className="gap-2 border-rose-500/30 text-rose-500 hover:bg-rose-500/10 hover:text-rose-500 h-12"
                >
                  {submitting === "reject" ? (
                    <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4 shrink-0" />
                  )}
                  Decline
                </Button>
              </div>
              <p className="mt-4 text-[11px] text-muted-foreground text-center">
                By accepting you confirm you've reviewed the proposal and pricing above.
              </p>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground pb-4">
          Secure proposal link · Only people with this link can view it
        </p>
      </main>
    </div>
  );
}
