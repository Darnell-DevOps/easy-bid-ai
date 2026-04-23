import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Building2,
  Calendar,
  ShieldCheck,
  Zap,
  MessageCircle,
  CreditCard,
  ArrowRight,
} from "lucide-react";
import PremiumProposalRenderer from "@/components/proposal/PremiumProposalRenderer";
import PremiumPricingRenderer from "@/components/proposal/PremiumPricingRenderer";
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

const CURRENCY_SYMBOL: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  CAD: "C$",
  AUD: "A$",
};

function formatAmount(cents: number | null, currency: string | null) {
  if (!cents) return null;
  const cur = (currency || "USD").toUpperCase();
  const symbol = CURRENCY_SYMBOL[cur] || "";
  const value = (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${value}`;
}

export default function ClientPortal() {
  const { id } = useParams();
  const { toast } = useToast();
  const [proposal, setProposal] = useState<PublicProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState<"accept" | "reject" | null>(null);
  const acceptRef = useRef<HTMLDivElement | null>(null);
  const payRef = useRef<HTMLDivElement | null>(null);

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
    if (action === "accept") {
      setTimeout(() => payRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
    }
  };

  const scrollToAccept = () => {
    acceptRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const scrollToPay = () => {
    payRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const formattedTotal = useMemo(
    () => (proposal ? formatAmount(proposal.amount_cents, proposal.currency) : null),
    [proposal]
  );

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
  const isAccepted = status === "accepted";
  const isRejected = status === "rejected";
  const isPaid = proposal.client_paid;
  const responded = isAccepted || isRejected;

  /* ---------- Reusable CTA block ---------- */
  const InlineCTA = ({
    variant = "primary",
    label,
  }: {
    variant?: "primary" | "soft";
    label?: string;
  }) => {
    if (isRejected) return null;

    // Already accepted → guide to payment
    if (isAccepted && !isPaid) {
      return (
        <div
          className={
            variant === "primary"
              ? "rounded-xl border border-purple/30 bg-gradient-to-br from-purple/10 via-accent/5 to-transparent p-5 sm:p-6 text-center"
              : "rounded-lg border border-border bg-card/60 p-4 sm:p-5 text-center"
          }
        >
          <p className="text-sm text-muted-foreground mb-3">
            <span className="font-semibold text-foreground">Next step:</span> complete payment to begin.
          </p>
          <Button
            size="lg"
            onClick={scrollToPay}
            className="gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold shadow-lg hover:brightness-110 hover:shadow-purple/30 transition-all"
          >
            <CreditCard className="w-4 h-4" />
            Pay Now {formattedTotal ? `— ${formattedTotal}` : ""}
          </Button>
        </div>
      );
    }

    if (isPaid) return null;

    // Not yet accepted → drive acceptance
    return (
      <div
        className={
          variant === "primary"
            ? "rounded-xl border border-purple/30 bg-gradient-to-br from-purple/10 via-accent/5 to-transparent p-5 sm:p-6 text-center"
            : "rounded-lg border border-border bg-card/60 p-4 sm:p-5 text-center"
        }
      >
        {variant === "primary" && (
          <p className="text-xs uppercase tracking-[0.2em] text-purple font-semibold mb-2">
            Ready when you are
          </p>
        )}
        <Button
          size="lg"
          onClick={scrollToAccept}
          className="gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold shadow-lg hover:brightness-110 hover:shadow-purple/30 transition-all"
        >
          <CheckCircle2 className="w-4 h-4" />
          {label || (formattedTotal ? `Accept & Pay — ${formattedTotal}` : "Accept & Get Started")}
          <ArrowRight className="w-4 h-4" />
        </Button>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Takes less than a minute · Secure & encrypted
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-5 h-5 text-purple shrink-0" />
            <span className="text-sm font-semibold text-foreground truncate">
              Proposal for {proposal.client_name}
            </span>
          </div>
          <StatusBadge status={status} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 lg:py-12 space-y-8 lg:space-y-10 pb-32 lg:pb-12">
        {/* 1. Hero / Summary */}
        <section className="rounded-xl border border-border bg-card p-6 lg:p-10">
          <p className="text-xs uppercase tracking-wider text-purple font-semibold mb-3">Proposal</p>
          <h1 className="text-2xl lg:text-4xl font-bold text-foreground mb-4">
            {proposal.service_type}
          </h1>
          <p className="text-base text-muted-foreground leading-relaxed max-w-2xl mb-5">
            A clear, focused plan for {proposal.company_name || proposal.client_name} — built to
            deliver real results, fast.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 shrink-0" />
              <span>Prepared for {proposal.company_name || proposal.client_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 shrink-0" />
              <span>
                {new Date(proposal.created_at).toLocaleDateString(undefined, { dateStyle: "long" })}
              </span>
            </div>
          </div>
        </section>

        {/* 2. CTA #1 — after intro */}
        <InlineCTA variant="primary" />

        {/* 3-5. Solution / Scope / Deliverables (proposal content) */}
        {proposal.proposal_content && (
          <section>
            <PremiumProposalRenderer content={proposal.proposal_content} />
          </section>
        )}

        {/* 6. Pricing — structured */}
        {proposal.pricing_breakdown && (
          <section
            id="pricing"
            className="rounded-xl border border-purple/30 bg-card p-6 lg:p-10 shadow-lg shadow-purple/5"
          >
            <PremiumPricingRenderer
              content={proposal.pricing_breakdown}
              showPayCta={isAccepted && !isPaid}
              onPayClick={scrollToPay}
            />

            {/* Reinforced total + payment explanation */}
            {formattedTotal && (
              <div className="mt-8 pt-8 border-t border-border/60 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-1">
                    Total Investment
                  </p>
                  <p className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
                    {formattedTotal}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 max-w-sm">
                    Secure payment via card or bank transfer. Work begins as soon as payment is
                    confirmed.
                  </p>
                </div>
                {!isPaid && (
                  <Button
                    size="lg"
                    onClick={isAccepted ? scrollToPay : scrollToAccept}
                    className="gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold shadow-lg hover:brightness-110 hover:shadow-purple/30 transition-all"
                  >
                    {isAccepted ? (
                      <>
                        <CreditCard className="w-4 h-4" />
                        Pay Now
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Accept & Pay
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </section>
        )}

        {/* 7. CTA #2 — after pricing */}
        <InlineCTA variant="primary" />

        {/* 8. Trust section */}
        {!isRejected && (
          <section className="rounded-xl border border-border bg-card p-6 lg:p-10">
            <p className="text-xs uppercase tracking-[0.2em] text-purple font-semibold mb-2">
              Why clients choose us
            </p>
            <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-6">
              Built for results, trusted by teams
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: ShieldCheck,
                  title: "Proven results",
                  desc: "Track record of delivering measurable outcomes.",
                },
                {
                  icon: Zap,
                  title: "Reliable delivery",
                  desc: "On time, on scope, every time.",
                },
                {
                  icon: MessageCircle,
                  title: "Clear communication",
                  desc: "Direct updates, no jargon, no surprises.",
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="rounded-lg border border-border/60 bg-background/40 p-4"
                >
                  <Icon className="w-5 h-5 text-purple mb-3" />
                  <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 9. Pay Now panel — visible once accepted (or already paid) */}
        {(isAccepted || isPaid) && (
          <div ref={payRef}>
            <ProposalPayNow
              proposalId={proposal.id}
              amountCents={proposal.amount_cents}
              currency={proposal.currency}
              clientPaid={isPaid}
              onPaid={() => setProposal({ ...proposal, client_paid: true })}
            />
          </div>
        )}

        {/* 10. Final response / accept section */}
        <section ref={acceptRef} className="rounded-xl border border-border bg-card p-6 lg:p-10">
          {responded ? (
            <div className="text-center py-4">
              {isAccepted ? (
                <>
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 mb-4">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                  </div>
                  <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-2">
                    Proposal Accepted
                  </h2>
                  {isPaid ? (
                    <p className="text-muted-foreground text-sm">
                      Payment received — we'll be in touch shortly to kick things off.
                    </p>
                  ) : (
                    <>
                      <p className="text-muted-foreground text-sm mb-5">
                        <span className="font-semibold text-foreground">Next step:</span> complete
                        payment to begin work immediately.
                      </p>
                      <Button
                        size="lg"
                        onClick={scrollToPay}
                        className="gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold shadow-lg hover:brightness-110 hover:shadow-purple/30 transition-all"
                      >
                        <CreditCard className="w-4 h-4" />
                        Pay Now {formattedTotal ? `— ${formattedTotal}` : ""}
                      </Button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/15 mb-4">
                    <XCircle className="w-6 h-6 text-rose-500" />
                  </div>
                  <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-2">
                    Proposal Declined
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    Thanks for letting us know. We appreciate your time.
                  </p>
                </>
              )}
              {proposal.client_response_message && (
                <div className="mt-6 mx-auto max-w-lg rounded-lg border border-border bg-background/40 p-4 text-left">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                    Your message
                  </p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {proposal.client_response_message}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-2">
                Ready to move forward?
              </h2>
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
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
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
                  {formattedTotal ? `Accept & Pay — ${formattedTotal}` : "Accept & Get Started"}
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
        </section>

        <p className="text-center text-xs text-muted-foreground pb-4">
          Secure proposal link · Only people with this link can view it
        </p>
      </main>

      {/* Sticky mobile CTA */}
      {!isRejected && !isPaid && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-20 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.4)]">
          <Button
            size="lg"
            onClick={isAccepted ? scrollToPay : scrollToAccept}
            className="w-full gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold shadow-lg hover:brightness-110 transition-all h-12"
          >
            {isAccepted ? (
              <>
                <CreditCard className="w-4 h-4" />
                Pay Now {formattedTotal ? `— ${formattedTotal}` : ""}
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Accept & Pay {formattedTotal ? `— ${formattedTotal}` : ""}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
