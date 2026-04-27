import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  Lock,
  Mail,
  FileCheck,
  CalendarPlus,
  FileSignature,
} from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import PremiumProposalRenderer from "@/components/proposal/PremiumProposalRenderer";
import PremiumPricingRenderer from "@/components/proposal/PremiumPricingRenderer";
import StatusBadge, { normalizeStatus } from "@/components/proposal/StatusBadge";
import OnboardingProgressTracker, { type FullStage } from "@/components/onboarding/OnboardingProgressTracker";
import { useToast } from "@/hooks/use-toast";
import { useProposalCheckout } from "@/hooks/use-proposal-checkout";
import { cn } from "@/lib/utils";
import { buildOnboardingFields, type OnboardingFormRow } from "@/lib/onboarding";
import { ClipboardList } from "lucide-react";

interface PublicProposal {
  id: string;
  user_id: string;
  client_name: string;
  company_name: string;
  service_type: string;
  proposal_content: string | null;
  pricing_breakdown: string | null;
  created_at: string;
  status: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  client_response_message: string | null;
  amount_cents: number | null;
  currency: string | null;
  client_paid: boolean;
}

interface BookingLinkLite {
  slug: string;
  name: string;
}

interface ContractLite {
  id: string;
  title: string;
  status: string;
  signing_token: string;
  signed_at: string | null;
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

function deriveFullStage(p: PublicProposal, contract: ContractLite | null, onboarding: OnboardingFormRow | null, hasBooking: boolean): FullStage {
  if (onboarding?.status === "completed") return "ready";
  if (p.client_paid) {
    if (hasBooking) return "onboarding";
    return "booking";
  }
  if (contract?.status === "signed") return "payment";
  if (p.status === "accepted" || p.accepted_at) return "contract";
  return "proposal";
}

export default function ClientPortal() {
  const { id } = useParams();
  const { toast } = useToast();
  const [proposal, setProposal] = useState<PublicProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [message, setMessage] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submitting, setSubmitting] = useState<"accept" | "reject" | null>(null);
  const [bookingLink, setBookingLink] = useState<BookingLinkLite | null>(null);
  const [contract, setContract] = useState<ContractLite | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingFormRow | null>(null);
  const [hasBooking, setHasBooking] = useState(false);
  const { openCheckout, loading: payLoading, available: paymentsAvailable } = useProposalCheckout();

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select(
          "id, user_id, client_name, company_name, service_type, proposal_content, pricing_breakdown, created_at, status, sent_at, viewed_at, accepted_at, rejected_at, client_response_message, amount_cents, currency, client_paid"
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

      // Fetch the proposal owner's first active booking link (for kickoff CTA)
      supabase
        .from("booking_links")
        .select("slug, name")
        .eq("user_id", (data as PublicProposal).user_id)
        .eq("is_active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle()
        .then(({ data: bl }) => {
          if (bl) setBookingLink(bl as BookingLinkLite);
        });

      // Fetch latest contract for this proposal
      supabase
        .from("contracts")
        .select("id, title, status, signing_token, signed_at")
        .eq("proposal_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data: ct }) => {
          if (ct) setContract(ct as ContractLite);
        });

      // Fetch latest onboarding form for this proposal
      supabase
        .from("onboarding_forms")
        .select("*")
        .eq("proposal_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data: ob }) => {
          if (ob) setOnboarding(ob as unknown as OnboardingFormRow);
        });

      // Has booking?
      supabase
        .from("bookings")
        .select("id")
        .eq("proposal_id", id)
        .limit(1)
        .then(({ data: bk }) => {
          if (bk && bk.length > 0) setHasBooking(true);
        });

      // Auto-mark as viewed (non-blocking)
      supabase.rpc("client_portal_respond", {
        _proposal_id: id,
        _action: "view",
        _message: null,
      });
    };
    load();
  }, [id]);

  const handleAccept = async () => {
    if (!proposal) return;
    if (!agreedToTerms) {
      toast({
        title: "Please agree to the terms",
        description: "Tick the agreement box to continue.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting("accept");
    const { error } = await supabase.rpc("client_portal_respond", {
      _proposal_id: proposal.id,
      _action: "accept",
      _message: message.trim() || null,
    });
    if (error) {
      setSubmitting(null);
      toast({ title: "Couldn't accept proposal", description: error.message, variant: "destructive" });
      return;
    }
    const updated = {
      ...proposal,
      status: "accepted",
      accepted_at: new Date().toISOString(),
      rejected_at: null,
      client_response_message: message.trim() || proposal.client_response_message,
    };
    setProposal(updated);

    // Auto-draft a contract and immediately make it available for signing
    if (!contract) {
      try {
        const { data } = await supabase.functions.invoke("generate-contract", {
          body: {
            contract_type: "service_agreement",
            client_name: proposal.client_name,
            company_name: proposal.company_name,
            service_type: proposal.service_type,
            project_scope: (proposal as any).project_scope || "",
            timeline: (proposal as any).timeline || "",
            budget: formattedTotal || "",
            payment_terms: "50% deposit, 50% on completion",
          },
        });
        if (data?.body) {
          const { data: inserted } = await supabase
            .from("contracts")
            .insert({
              user_id: proposal.user_id,
              proposal_id: proposal.id,
              contract_type: "service_agreement",
              title: data.title || "Service Agreement",
              body: data.body,
              client_name: proposal.client_name,
              company_name: proposal.company_name,
              amount_cents: proposal.amount_cents,
              currency: proposal.currency,
              status: "sent",
              sent_at: new Date().toISOString(),
            })
            .select("id, title, status, signing_token, signed_at")
            .single();
          if (inserted) setContract(inserted as ContractLite);
        }
      } catch (err) {
        console.warn("auto-draft contract failed", err);
      }
    }

    setSubmitting(null);
    toast({
      title: "Proposal accepted",
      description: "Next step: review and sign your contract.",
    });
  };

  const handleReject = async () => {
    if (!proposal) return;
    setSubmitting("reject");
    const { error } = await supabase.rpc("client_portal_respond", {
      _proposal_id: proposal.id,
      _action: "reject",
      _message: message.trim() || null,
    });
    setSubmitting(null);
    if (error) {
      toast({ title: "Something went wrong", description: error.message, variant: "destructive" });
      return;
    }
    setProposal({
      ...proposal,
      status: "rejected",
      accepted_at: null,
      rejected_at: new Date().toISOString(),
      client_response_message: message.trim() || proposal.client_response_message,
    });
  };

  const handlePayAgain = async () => {
    if (!proposal) return;
    await openCheckout({
      proposalId: proposal.id,
      onPaid: () => setProposal((p) => (p ? { ...p, client_paid: true } : p)),
    });
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
  const stage = deriveFullStage(proposal, contract, onboarding, hasBooking);
  const onboardingComplete = onboarding?.status === "completed";
  const onboardingStarted = onboarding?.status === "in_progress";
  const isContractSigned = contract?.status === "signed";
  const needsContractSignature = isAccepted && contract && !isContractSigned;
  const readyToPay = isAccepted && isContractSigned && !isPaid;
  const acceptedNotPaid = isAccepted && !isPaid;
  const hasPrice = !!proposal.amount_cents && proposal.amount_cents >= 70;

  return (
    <div className="min-h-screen bg-background pb-24 sm:pb-8">
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

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-6 lg:space-y-8">
        {/* Deal Progress Tracker */}
        {!isRejected && <OnboardingProgressTracker currentStage={stage} />}

        {/* Hero / Summary */}
        <section className="rounded-xl border border-border bg-card p-6 lg:p-10">
          <p className="text-xs uppercase tracking-wider text-purple font-semibold mb-3">Proposal</p>
          <h1 className="text-2xl lg:text-4xl font-bold text-foreground mb-4">
            {proposal.service_type}
          </h1>
          <p className="text-base lg:text-lg text-foreground/90 leading-relaxed max-w-2xl mb-5">
            Win more clients, grow visibility, and unlock new revenue — fast.
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

        {/* Accepted — needs contract signature */}
        {needsContractSignature && (
          <div className="rounded-xl border border-purple/40 bg-gradient-to-br from-purple/15 via-accent/5 to-transparent p-5 sm:p-6 text-center">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-purple/20 mb-3">
              <FileSignature className="w-5 h-5 text-purple" />
            </div>
            <p className="text-base sm:text-lg font-semibold text-foreground mb-1">
              Proposal accepted — review &amp; sign your contract
            </p>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              We've prepared your agreement. Sign it to unlock payment and get started.
            </p>
            <Button
              size="lg"
              asChild
              className="gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold shadow-lg hover:brightness-110 hover:shadow-purple/30 transition-all"
            >
              <RouterLink to={`/sign/${contract!.signing_token}`}>
                <FileSignature className="w-4 h-4" />
                Review &amp; Sign Contract
              </RouterLink>
            </Button>
          </div>
        )}

        {/* Accepted — drafting contract spinner */}
        {isAccepted && !contract && !isPaid && (
          <div className="rounded-xl border border-purple/30 bg-gradient-to-br from-purple/10 to-transparent p-5 sm:p-6 text-center">
            <Loader2 className="w-5 h-5 text-purple animate-spin mx-auto mb-3" />
            <p className="text-base font-semibold text-foreground mb-1">
              Proposal accepted — preparing your contract…
            </p>
            <p className="text-sm text-muted-foreground">
              This usually takes just a few seconds.
            </p>
          </div>
        )}

        {/* Contract signed — ready to pay */}
        {readyToPay && (
          <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card to-transparent p-5 sm:p-6 text-center">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 mb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-base sm:text-lg font-semibold text-foreground mb-1">
              Contract signed — complete payment to begin work
            </p>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Secure your slot with payment and we'll kick things off.
            </p>
            <Button
              size="lg"
              onClick={handlePayAgain}
              disabled={payLoading}
              className="gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold shadow-lg hover:brightness-110 hover:shadow-purple/30 transition-all"
            >
              {payLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CreditCard className="w-4 h-4" />
              )}
              Pay Now {formattedTotal ? `— ${formattedTotal}` : ""}
            </Button>
          </div>
        )}
        {proposal.proposal_content && (
          <section
            className={cn(
              "transition-all relative",
              acceptedNotPaid && "opacity-60 pointer-events-none select-none",
            )}
            aria-hidden={acceptedNotPaid ? "true" : undefined}
          >
            <PremiumProposalRenderer content={proposal.proposal_content} />
          </section>
        )}

        {/* Pricing — also dimmed once accepted (price is locked) */}
        {proposal.pricing_breakdown && (
          <section
            id="pricing"
            className={cn(
              "rounded-xl border border-purple/30 bg-card p-6 lg:p-10 shadow-lg shadow-purple/5 transition-all",
              acceptedNotPaid && "opacity-70",
            )}
          >
            <div className="mb-8 pb-8 border-b border-border/60">
              <p className="text-xs uppercase tracking-[0.2em] text-purple font-semibold mb-3">
                What you're getting
              </p>
              <ul className="space-y-2">
                {[
                  "A clear plan tailored to your goals",
                  "Hands-on delivery from start to finish",
                  "Measurable results you can track",
                  "Direct support throughout the project",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2 className="w-4 h-4 text-purple shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <PremiumPricingRenderer content={proposal.pricing_breakdown} showPayCta={false} />

            {formattedTotal && (
              <div className="mt-8 pt-8 border-t border-border/60">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-1">
                  Total Investment
                </p>
                <p className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
                  {formattedTotal}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  No long-term contracts. Cancel anytime.
                </p>
              </div>
            )}
          </section>
        )}

        {/* Trust section */}
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
                { icon: ShieldCheck, title: "Avg. 3× more leads", desc: "Clients see measurable growth within the first 90 days." },
                { icon: Zap, title: "Delivered in days, not months", desc: "Fast turnaround without cutting corners on quality." },
                { icon: MessageCircle, title: "One point of contact", desc: "Direct updates from the person doing the work." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="rounded-lg border border-border/60 bg-background/40 p-4">
                  <Icon className="w-5 h-5 text-purple mb-3" />
                  <p className="text-sm font-semibold text-foreground mb-1">{title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Contract section — appears once a contract has been sent */}
        {contract && contract.status !== "draft" && (
          <section className="rounded-xl border border-purple/30 bg-gradient-to-br from-purple/5 via-card to-accent/5 p-6 lg:p-8">
            <div className="flex items-start gap-4">
              <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${
                contract.status === "signed" ? "bg-emerald-500/15 text-emerald-500" : "bg-purple/15 text-purple"
              }`}>
                {contract.status === "signed" ? <CheckCircle2 className="w-5 h-5" /> : <FileSignature className="w-5 h-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wider text-purple font-semibold mb-1">Agreement</p>
                <h3 className="text-lg font-semibold text-foreground mb-1">{contract.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {contract.status === "signed"
                    ? `Signed ${contract.signed_at ? new Date(contract.signed_at).toLocaleDateString() : ""}.`
                    : "Please review and sign the agreement to formalise this engagement."}
                </p>
                <Button
                  asChild
                  className={`gap-2 ${contract.status === "signed"
                    ? ""
                    : "bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold shadow-lg hover:brightness-110"}`}
                  variant={contract.status === "signed" ? "outline" : "default"}
                >
                  <RouterLink to={`/sign/${contract.signing_token}`}>
                    <FileSignature className="w-4 h-4" />
                    {contract.status === "signed" ? "View signed contract" : "Review & sign contract"}
                  </RouterLink>
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* Final response section — Accept & Pay OR confirmation */}
        {isPaid ? (
          <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 lg:p-10 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 mb-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-2">
              Payment received — we're on it
            </h2>
            <p className="text-muted-foreground text-sm mb-5">
              Thanks! A confirmation has been sent. {bookingLink ? "Lock in your kickoff call below." : "We'll be in touch shortly to kick things off."}
            </p>
            {bookingLink && (
              <Button
                size="lg"
                asChild
                className="gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold shadow-lg hover:brightness-110"
              >
                <RouterLink to={`/book/${bookingLink.slug}?proposal=${proposal.id}`}>
                  <CalendarPlus className="w-4 h-4" />
                  Book your kickoff call
                </RouterLink>
              </Button>
            )}
          </section>
        ) : isAccepted && isContractSigned && !hasPrice && bookingLink ? (
          <section className="rounded-xl border border-purple/30 bg-gradient-to-br from-purple/10 via-accent/5 to-transparent p-6 lg:p-10 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-purple/15 mb-4">
              <CalendarPlus className="w-6 h-6 text-purple" />
            </div>
            <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-2">
              Book your kickoff call
            </h2>
            <p className="text-muted-foreground text-sm mb-5">
              Pick a time that works for you and we'll get started.
            </p>
            <Button
              size="lg"
              asChild
              className="gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold shadow-lg hover:brightness-110"
            >
              <RouterLink to={`/book/${bookingLink.slug}?proposal=${proposal.id}`}>
                <CalendarPlus className="w-4 h-4" />
                Schedule Call
              </RouterLink>
            </Button>
          </section>
        ) : isRejected ? (
          <section className="rounded-xl border border-border bg-card p-6 lg:p-10 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/15 mb-4">
              <XCircle className="w-6 h-6 text-rose-500" />
            </div>
            <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-2">Proposal Declined</h2>
            <p className="text-muted-foreground text-sm">
              Thanks for letting us know. We appreciate your time.
            </p>
            {proposal.client_response_message && (
              <div className="mt-6 mx-auto max-w-lg rounded-lg border border-border bg-background/40 p-4 text-left">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Your message</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{proposal.client_response_message}</p>
              </div>
            )}
          </section>
        ) : !isAccepted ? (
          <section className="rounded-xl border border-border bg-card p-6 lg:p-10">
            <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-2">
              Ready to move forward?
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              Accept the proposal to receive your contract for review and signature.
            </p>

            <Textarea
              placeholder="Optional message (e.g. questions, timing, feedback)"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="mb-5 min-h-[80px]"
              disabled={!!submitting}
            />

            {/* Terms & Agreement */}
            <div className="rounded-lg border border-border bg-background/40 p-4 mb-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5" />
                Terms & Agreement
              </p>
              <div className="flex items-start gap-2.5">
                <Checkbox
                  id="agree-terms"
                  checked={agreedToTerms}
                  onCheckedChange={(c) => setAgreedToTerms(c === true)}
                  className="mt-0.5"
                />
                <label htmlFor="agree-terms" className="text-sm text-foreground/90 leading-relaxed cursor-pointer select-none">
                  I agree to the{" "}
                  <span className="text-purple font-medium">Terms & Conditions</span>,{" "}
                  <span className="text-purple font-medium">Refund Policy</span>, and{" "}
                  <span className="text-purple font-medium">Payment Terms</span> outlined in this proposal.
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
              <Button
                size="lg"
                onClick={handleAccept}
                disabled={!!submitting || !agreedToTerms}
                className="gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold shadow-lg hover:brightness-110 hover:shadow-purple/30 transition-all h-12 disabled:opacity-50"
              >
                {submitting === "accept" ? (
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                )}
                Accept Proposal
                <ArrowRight className="w-4 h-4 shrink-0" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={handleReject}
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

            {/* Trust indicators */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Secure payment via Paddle</span>
              </div>
              <div className="flex items-center gap-1.5">
                <FileCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Invoice generated automatically</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Confirmation email after payment</span>
              </div>
            </div>
          </section>
        ) : null}

        <p className="text-center text-xs text-muted-foreground pb-4">
          Secure proposal link · Only people with this link can view it
        </p>
      </main>

      {/* Sticky mobile Pay bar — only when contract is signed and payment is due */}
      {readyToPay && (
        <div className="fixed bottom-0 inset-x-0 z-20 sm:hidden border-t border-border bg-card/95 backdrop-blur p-3">
          <Button
            size="lg"
            onClick={handlePayAgain}
            disabled={payLoading}
            className="w-full gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold h-12"
          >
            {payLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
            Pay Now {formattedTotal ? `— ${formattedTotal}` : ""}
          </Button>
        </div>
      )}
    </div>
  );
}
