import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DynamicFavicon from "@/components/branding/DynamicFavicon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  FileText,
  ChevronDown,
} from "lucide-react";

import { Link as RouterLink } from "react-router-dom";
import PremiumProposalRenderer from "@/components/proposal/PremiumProposalRenderer";
import PremiumPricingRenderer from "@/components/proposal/PremiumPricingRenderer";
import StatusBadge, { normalizeStatus } from "@/components/proposal/StatusBadge";
import ProjectProgressTracker, { type ProjectStage } from "@/components/portal/ProjectProgressTracker";
import ProjectOverview from "@/components/portal/ProjectOverview";
import { useToast } from "@/hooks/use-toast";
import { useProposalCheckout } from "@/hooks/use-proposal-checkout";
import { cn } from "@/lib/utils";
import { buildOnboardingFields, type OnboardingFormRow } from "@/lib/onboarding";
import { calculateCommercialTotals, formatCents } from "@/lib/commercial-calc";
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
  payment_terms: string | null;
  tax_rate: number | null;
  tax_mode: string | null;
}

interface BookingLinkLite {
  slug: string;
  name: string;
}

interface BookingLite {
  id: string;
  scheduled_at: string;
  meeting_name: string | null;
  status: string | null;
  created_at: string;
}

interface ContractLite {
  id: string;
  title: string;
  status: string;
  signing_token: string;
  signed_at: string | null;
}


interface PortalBranding {
  business_name: string | null;
  tagline: string | null;
  logo_url: string | null;
  brand_color: string | null;
  brand_secondary_color: string | null;
  show_logo_on_proposals: boolean | null;
  show_logo_on_contracts: boolean | null;
  show_logo_on_portal: boolean | null;
  proposal_cover_show_name: boolean | null;
  proposal_cover_show_tagline: boolean | null;
  proposal_cover_show_date: boolean | null;
}


function deriveProjectStage(
  p: PublicProposal,
  contract: ContractLite | null,
  onboarding: OnboardingFormRow | null,
  hasBooking: boolean,
): ProjectStage {
  if (onboarding?.status === "completed") {
    // Kickoff/active require a fully executed contract (client-signed + provider-countersigned).
    // If onboarding is done but the contract isn't executed yet, keep showing "onboarding"
    // so we don't prematurely surface the kickoff CTA.
    if (contract && contract.status !== "executed") return "onboarding";
    return hasBooking ? "active" : "kickoff";
  }
  if (p.client_paid) return "onboarding";
  if (contract?.status === "signed") return "payment";
  if (p.status === "accepted" || p.accepted_at) return "contract";
  return "proposal";
}

const STAGE_LABEL: Record<ProjectStage, string> = {
  proposal: "Awaiting review",
  contract: "Awaiting signature",
  payment: "Awaiting payment",
  onboarding: "Onboarding",
  kickoff: "Ready for kickoff",
  active: "Project active",
};

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
  const [ownerKickoffUrl, setOwnerKickoffUrl] = useState<string | null>(null);
  const [contract, setContract] = useState<ContractLite | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingFormRow | null>(null);
  const [hasBooking, setHasBooking] = useState(false);
  const [bookings, setBookings] = useState<BookingLite[]>([]);
  const { openCheckout, loading: payLoading, available: paymentsAvailable } = useProposalCheckout();
  const [paymentConfirmMsg, setPaymentConfirmMsg] = useState<string | null>(null);
  const [branding, setBranding] = useState<PortalBranding | null>(null);
  const [policies, setPolicies] = useState<Array<{ policy_type: string; content: string; updated_at: string | null }>>([]);
  const [openPolicy, setOpenPolicy] = useState<{ policy_type: string; content: string; updated_at: string | null } | null>(null);

  // Safety net: when Paddle hard-redirects back with ?paid=1, poll for the
  // webhook to flip client_paid before trusting the initial fetch.
  useEffect(() => {
    if (!id) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") !== "1") return;
    // Clean the URL so a later manual refresh doesn't re-trigger polling.
    window.history.replaceState({}, document.title, window.location.pathname);

    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 8;
    setPaymentConfirmMsg("Confirming your payment… this usually takes a few seconds.");

    const poll = async () => {
      if (cancelled) return;
      try {
        const { data: rows } = (await supabase.rpc(
          "public_get_proposal_by_id" as never,
          { _id: id } as never,
        )) as { data: any };
        if (cancelled) return;
        const data = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
        if (data?.client_paid) {
          setProposal(data as PublicProposal);
          setPaymentConfirmMsg(null);
          return;
        }
      } catch {
        // ignore, keep polling
      }
      attempts++;
      if (attempts >= maxAttempts) {
        setPaymentConfirmMsg(
          "Payment received — we're just confirming it on our end. This can take a minute; refresh this page shortly if it doesn't update automatically.",
        );
        return;
      }
      setTimeout(poll, 1500);
    };
    setTimeout(poll, 1500);

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const { data: rows, error } = (await supabase.rpc(
        "public_get_proposal_by_id" as never,
        { _id: id } as never,
      )) as { data: any; error: any };
      const data = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProposal(data as PublicProposal);
      setLoading(false);

      // Fetch the proposal owner's public branding (business name, logo, brand colors)
      (supabase.rpc(
        "public_get_proposal_branding_for_user" as never,
        { _user_id: (data as PublicProposal).user_id } as never,
      ) as unknown as Promise<{ data: any }>)
        .then(({ data: rows }) => {
          const b = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
          if (b) setBranding(b as PortalBranding);
        });

      // Fetch the proposal owner's first active booking link (for kickoff CTA)
      (supabase.rpc(
        "public_get_kickoff_booking_link_for_user" as never,
        { _user_id: (data as PublicProposal).user_id } as never,
      ) as unknown as Promise<{ data: any }>)
        .then(({ data: rows }) => {
          const bl = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
          if (bl) setBookingLink(bl as BookingLinkLite);
        });

      // Fetch owner's external kickoff booking URL (overrides internal booking link when set)
      (supabase.rpc(
        "public_get_kickoff_booking_url" as never,
        { _user_id: (data as PublicProposal).user_id } as never,
      ) as unknown as Promise<{ data: any }>)
        .then(({ data: url }) => {
          if (typeof url === "string" && url.trim()) setOwnerKickoffUrl(url.trim());
        });

      // Fetch the proposal owner's configured policies (Terms & Conditions, Refund Policy,
      // Privacy Policy) — only ones with real content are returned by the RPC.
      (supabase.rpc(
        "public_get_policies_for_user" as never,
        { _user_id: (data as PublicProposal).user_id } as never,
      ) as unknown as Promise<{ data: any }>)
        .then(({ data: rows }) => {
          if (Array.isArray(rows)) setPolicies(rows as any);
        });


      // Fetch latest contract for this proposal
      (supabase.rpc(
        "public_get_contract_for_proposal" as never,
        { _proposal_id: id } as never,
      ) as unknown as Promise<{ data: any }>)
        .then(({ data: rows }) => {
          const ct = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
          if (ct) setContract(ct as ContractLite);
        });

      // Fetch latest onboarding form for this proposal
      (supabase.rpc(
        "public_get_onboarding_by_proposal" as never,
        { _proposal_id: id } as never,
      ) as unknown as Promise<{ data: any }>)
        .then(({ data: rows }) => {
          const ob = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
          if (ob) setOnboarding(ob as unknown as OnboardingFormRow);
        });

      // Fetch bookings for this proposal
      (supabase.rpc(
        "public_get_bookings_for_proposal" as never,
        { _proposal_id: id } as never,
      ) as unknown as Promise<{ data: any }>)
        .then(({ data: bk }) => {
          const rows = (bk || []) as BookingLite[];
          setBookings(rows);
          if (rows.length > 0) setHasBooking(true);
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
    const { data: rpcData, error } = await supabase.rpc("client_portal_respond", {
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

    const rpcResult = (rpcData || {}) as { contract_id?: string | null; contract_is_new?: boolean };
    const contractId = rpcResult.contract_id || null;
    const contractIsNew = !!rpcResult.contract_is_new;

    if (contractId && contractIsNew) {
      // Placeholder contract was just claimed by the RPC — fill it with real content.
      try {
        const contractType = /retainer/i.test(proposal.service_type || "")
          ? "retainer_agreement"
          : "service_agreement";
        const totals = calculateCommercialTotals(
          proposal.amount_cents ?? 0,
          proposal.tax_rate,
          proposal.tax_mode as any,
        );
        const { data } = await supabase.functions.invoke("generate-contract", {
          body: {
            contract_type: contractType,
            client_name: proposal.client_name,
            company_name: proposal.company_name,
            service_type: proposal.service_type,
            project_scope: (proposal as any).project_scope || "",
            timeline: (proposal as any).timeline || "",
            budget: formattedTotal || "",
            payment_terms: proposal.payment_terms || undefined,
            currency: proposal.currency,
            subtotal_cents: totals.subtotalCents,
            tax_rate: proposal.tax_rate,
            tax_mode: proposal.tax_mode,
            tax_amount_cents: totals.taxAmountCents,
            total_cents: totals.totalCents,
          },
        });
        if (data?.body) {
          const { data: updatedRow, error: updateErr } = await supabase
            .from("contracts")
            .update({
              title: data.title || (contractType === "retainer_agreement" ? "Retainer Agreement" : "Service Agreement"),
              body: data.body,
              amount_cents: proposal.amount_cents != null ? totals.totalCents : null,
              currency: proposal.currency,
            })
            .eq("id", contractId)
            .select("id, title, status, signing_token, signed_at")
            .single();
          if (updateErr) {
            console.warn("auto-draft contract update failed", updateErr);
          } else if (updatedRow) {
            setContract(updatedRow as ContractLite);
          }
        } else {
          console.warn("generate-contract returned no body; placeholder left as draft");
        }
      } catch (err) {
        console.warn("auto-draft contract failed", err);
      }
    } else if (contractId && !contractIsNew) {
      // A prior call already claimed the placeholder — just load it.
      const { data: existing } = await supabase
        .from("contracts")
        .select("id, title, status, signing_token, signed_at")
        .eq("id", contractId)
        .maybeSingle();
      if (existing) setContract(existing as ContractLite);
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

  // Auto-create onboarding form once payment is complete
  const ensureOnboardingForm = async (p: PublicProposal) => {
    if (onboarding) return;
    const fields = buildOnboardingFields(p.service_type);
    const { data, error } = await (supabase.from("onboarding_forms") as any)
      .insert([
        {
          user_id: p.user_id,
          proposal_id: p.id,
          client_name: p.client_name,
          service_type: p.service_type,
          fields,
          status: "pending",
          sent_at: new Date().toISOString(),
        },
      ])
      .select("*")
      .single();
    if (!error && data) setOnboarding(data as unknown as OnboardingFormRow);
  };

  const handlePayAgain = async () => {
    if (!proposal) return;
    await openCheckout({
      proposalId: proposal.id,
      onPaid: () => {
        setProposal((p) => (p ? { ...p, client_paid: true } : p));
        if (proposal) ensureOnboardingForm({ ...proposal, client_paid: true });
      },
    });
  };

  // If we land on the page already paid but with no onboarding, create one.
  useEffect(() => {
    if (proposal?.client_paid && !onboarding) {
      ensureOnboardingForm(proposal);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal?.client_paid, onboarding?.id]);

  const commercialTotals = useMemo(
    () =>
      proposal
        ? calculateCommercialTotals(
            proposal.amount_cents ?? 0,
            proposal.tax_rate,
            proposal.tax_mode as any,
          )
        : null,
    [proposal],
  );

  const formattedTotal = useMemo(
    () =>
      proposal && commercialTotals && commercialTotals.totalCents
        ? formatCents(commercialTotals.totalCents, proposal.currency)
        : null,
    [proposal, commercialTotals],
  );

  // Humanized wording of the proposal's actual payment_terms field. Prefer this
  // over a separate "Payment Terms" policy document to avoid two contradictory
  // sources for the same phrase — the proposal itself is authoritative here.
  const proposalPaymentTermsLabel = useMemo(() => {
    const raw = (proposal?.payment_terms || "").trim();
    if (!raw) return null;
    const map: Record<string, string> = {
      due_immediately: "Payment due immediately on acceptance",
      net_7: "Payment due within 7 days (Net 7)",
      net_14: "Payment due within 14 days (Net 14)",
      net_30: "Payment due within 30 days (Net 30)",
      net_60: "Payment due within 60 days (Net 60)",
    };
    return map[raw] ?? raw;
  }, [proposal?.payment_terms]);

  // Split policies out so we can reference each cleanly. Only surface a policy
  // in the agreement checkbox when the seller actually configured it.
  const termsPolicy = policies.find((p) => /terms/i.test(p.policy_type)) || null;
  const refundPolicy = policies.find((p) => /refund/i.test(p.policy_type)) || null;
  const privacyPolicy = policies.find((p) => /privacy/i.test(p.policy_type)) || null;
  const hasAnyPolicy = !!(termsPolicy || refundPolicy || privacyPolicy) || !!proposalPaymentTermsLabel;


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
  const stage = deriveProjectStage(proposal, contract, onboarding, hasBooking);
  const onboardingComplete = onboarding?.status === "completed";
  const onboardingStarted = onboarding?.status === "in_progress";
  const isContractSigned = contract?.status === "signed";
  const needsContractSignature = isAccepted && contract && !isContractSigned;
  const readyToPay = isAccepted && isContractSigned && !isPaid;
  const acceptedNotPaid = isAccepted && !isPaid;
  const hasPrice = !!commercialTotals && commercialTotals.totalCents >= 70;

  // Build activity timeline events
  const activityEvents: { id: string; iso: string; label: string; tone: "blue" | "purple" | "emerald" | "amber" | "rose" }[] = [];
  if (proposal.sent_at) activityEvents.push({ id: "sent", iso: proposal.sent_at, label: "Proposal sent", tone: "blue" });
  if (proposal.viewed_at) activityEvents.push({ id: "viewed", iso: proposal.viewed_at, label: "Proposal viewed", tone: "amber" });
  if (proposal.accepted_at) activityEvents.push({ id: "accepted", iso: proposal.accepted_at, label: "Proposal accepted", tone: "emerald" });
  if (proposal.rejected_at) activityEvents.push({ id: "rejected", iso: proposal.rejected_at, label: "Proposal declined", tone: "rose" });
  if (contract?.signed_at) activityEvents.push({ id: "contract-signed", iso: contract.signed_at, label: "Contract signed", tone: "purple" });
  if (isPaid && proposal.accepted_at) {
    // Use accepted_at as a fallback; payment timestamp isn't on the public row
    activityEvents.push({ id: "paid", iso: contract?.signed_at || proposal.accepted_at, label: "Payment received", tone: "emerald" });
  }
  if ((onboarding as any)?.submitted_at) {
    activityEvents.push({ id: "onboarding-done", iso: (onboarding as any).submitted_at, label: "Onboarding completed", tone: "emerald" });
  }
  for (const b of bookings) {
    if (b.status !== "cancelled") {
      activityEvents.push({ id: `booking-${b.id}`, iso: b.created_at, label: "Kickoff call booked", tone: "purple" });
    }
  }
  activityEvents.sort((a, b) => new Date(b.iso).getTime() - new Date(a.iso).getTime());

  // Upcoming booking (first scheduled in the future, not cancelled)
  const nowMs = Date.now();
  const upcomingBooking = bookings.find((b) => b.status !== "cancelled" && new Date(b.scheduled_at).getTime() >= nowMs) || null;

  // Next action card content
  let nextAction: React.ComponentProps<typeof ProjectOverview>["nextAction"] = null;
  if (!isRejected) {
    if (stage === "proposal") {
      nextAction = {
        title: "Review and accept your proposal",
        description: "Look through the details below, then accept to receive your contract.",
        icon: FileCheck,
        ctaLabel: "Review proposal",
        onClick: () => {
          const el = document.getElementById("proposal-section");
          if (el && el.tagName === "DETAILS") {
            (el as HTMLDetailsElement).open = true;
          }
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        },
      };
    } else if (stage === "contract" && contract) {
      nextAction = {
        title: "Sign your contract",
        description: "Review the agreement and add your signature to unlock payment.",
        icon: FileSignature,
        ctaLabel: "Review & sign",
        href: `/sign/${contract.signing_token}`,
      };
    } else if (stage === "payment") {
      nextAction = {
        title: "Complete payment",
        description: formattedTotal ? `Pay ${formattedTotal} to secure your slot and begin work.` : "Complete payment to secure your slot.",
        icon: CreditCard,
        ctaLabel: "Pay now",
        onClick: handlePayAgain,
        disabled: payLoading,
      };
    } else if (stage === "onboarding" && onboarding) {
      nextAction = {
        title: onboardingStarted ? "Continue your onboarding" : "Complete your onboarding",
        description: "Tell us about your project so we can hit the ground running. Takes 3–5 minutes.",
        icon: ClipboardList,
        ctaLabel: onboardingStarted ? "Continue" : "Start onboarding",
        href: `/onboard/${onboarding.access_token}`,
      };
    } else if (stage === "kickoff" && (ownerKickoffUrl || bookingLink)) {
      nextAction = ownerKickoffUrl
        ? {
            title: "Book your kickoff call",
            description: "Pick a time that works for you and we'll get started.",
            icon: CalendarPlus,
            ctaLabel: "Schedule call",
            onClick: () => window.open(ownerKickoffUrl, "_blank", "noopener,noreferrer"),
          }
        : {
            title: "Book your kickoff call",
            description: "Pick a time that works for you and we'll get started.",
            icon: CalendarPlus,
            ctaLabel: "Schedule call",
            href: `/book/${bookingLink!.slug}?proposal=${proposal.id}`,
          };
    }
  }

  const projectName = proposal.service_type;
  const slugify = (s: string) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 32) || "project";
  const companySlug = slugify(proposal.company_name || proposal.client_name);
  const projectSlug = slugify(proposal.service_type);
  const stageOrder: ProjectStage[] = ["proposal", "contract", "payment", "onboarding", "kickoff", "active"];
  const progressPct = Math.round(((stageOrder.indexOf(stage) + (stage === "active" ? 1 : 0)) / stageOrder.length) * 100);

  // Derive seller branding for header + ambient backdrop tinting
  const sellerName = branding?.business_name?.trim() || "";
  const sellerInitials = sellerName
    ? sellerName.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()
    : "";
  const brandColor = branding?.brand_color || null;
  const brandSecondary = branding?.brand_secondary_color || brandColor;
  const showPortalLogo = branding?.show_logo_on_portal !== false;
  const brandGradient =
    brandColor && brandSecondary
      ? { backgroundImage: `linear-gradient(135deg, ${brandColor}, ${brandSecondary})` }
      : undefined;

  return (
    <div className="relative min-h-screen pb-24 sm:pb-8 overflow-hidden">
      <DynamicFavicon userId={proposal?.user_id} />
      {/* Ambient backdrop — tinted with the seller's brand colors when configured */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className={
            "absolute top-[12%] left-[10%] w-[480px] h-[480px] rounded-full blur-[120px] animate-soft-pulse " +
            (brandColor ? "" : "bg-accent/10")
          }
          style={brandColor ? { backgroundColor: brandColor, opacity: 0.1 } : undefined}
        />
        <div
          className={
            "absolute bottom-[8%] right-[8%] w-[420px] h-[420px] rounded-full blur-[120px] animate-soft-pulse " +
            (brandSecondary ? "" : "bg-purple/10")
          }
          style={{
            animationDelay: "1.5s",
            ...(brandSecondary ? { backgroundColor: brandSecondary, opacity: 0.1 } : {}),
          }}
        />
        <div
          className={
            "absolute top-1/2 left-1/2 -translate-x-1/2 w-[700px] h-[300px] rounded-full blur-[140px] " +
            (brandColor ? "" : "bg-accent/5")
          }
          style={brandColor ? { backgroundColor: brandColor, opacity: 0.05 } : undefined}
        />
      </div>

      {/* Header — leads with the seller's brand identity */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          {showPortalLogo && branding?.logo_url ? (
            <img
              src={branding.logo_url}
              alt={sellerName || "Logo"}
              className="h-7 w-auto max-w-[140px] object-contain shrink-0"
            />
          ) : showPortalLogo && sellerInitials ? (
            <div
              className={
                "flex h-7 w-7 items-center justify-center rounded-md shrink-0 " +
                (brandGradient ? "" : "bg-gradient-to-br from-purple to-accent")
              }
              style={brandGradient}
            >
              <span className="text-[10px] font-bold text-white">{sellerInitials}</span>
            </div>
          ) : null}
          <div className="flex-1 min-w-0 text-xs font-medium truncate">
            {sellerName ? (
              <>
                <span className="text-foreground">{sellerName}</span>
                <span className="text-muted-foreground">
                  {" "}· {proposal.company_name || proposal.client_name} · {projectName}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">
                {proposal.company_name || proposal.client_name} · {projectName}
              </span>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
            </span>
            Live
          </div>
          <StatusBadge status={status} />
        </div>
      </header>



      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 lg:py-10 space-y-6 lg:space-y-8">
        {paymentConfirmMsg && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-sm text-foreground/90"
          >
            {paymentConfirmMsg}
          </div>
        )}
        {/* Project Overview */}
        {!isRejected && (
          <>
            <ProjectOverview
              clientName={proposal.client_name}
              projectName={projectName}
              stage={stage}
              stageLabel={STAGE_LABEL[stage]}
              nextAction={nextAction}
              upcomingBooking={upcomingBooking}
              upcomingDeadline={null}
              activity={activityEvents}
              progressPct={progressPct}
            />
            <ProjectProgressTracker currentStage={stage} />
          </>
        )}

        {/* Proposal — collapsible (click to view, like the contract card) */}
        <details id="proposal-section" className="group rounded-xl border border-border bg-card p-6 lg:p-8 scroll-mt-24 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex items-start gap-4 cursor-pointer list-none">
            <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 bg-purple/15 text-purple">
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wider text-purple font-semibold mb-1">Proposal</p>
              <h3 className="text-lg font-semibold text-foreground mb-1">{proposal.service_type}</h3>
              <p className="text-sm text-muted-foreground">
                Prepared for {proposal.company_name || proposal.client_name} ·{" "}
                {new Date(proposal.created_at).toLocaleDateString(undefined, { dateStyle: "long" })}
              </p>
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-purple">
                <span className="group-open:hidden">View proposal</span>
                <span className="hidden group-open:inline">Hide proposal</span>
                <ChevronDown className="w-4 h-4 transition-transform group-open:rotate-180" />
              </div>
            </div>
          </summary>

          <div className="mt-6 pt-6 border-t border-border/60 space-y-6">
            {/* Hero / Summary */}
            <section className="rounded-xl border border-border bg-card p-6 lg:p-10">
              <p className="text-xs uppercase tracking-wider text-purple font-semibold mb-3">Overview</p>
              <h1 className="text-2xl lg:text-4xl font-bold text-foreground mb-4">
                {proposal.service_type}
              </h1>
              {(() => {
                // Derive a short excerpt from the real Introduction section of proposal_content,
                // if one exists. Never fabricate copy — omit the line entirely otherwise.
                const raw = proposal.proposal_content || "";
                const match = raw.match(/(?:^|\n)#{1,3}\s*Introduction\s*\n+([\s\S]*?)(?:\n#{1,3}\s|$)/i);
                let excerpt = "";
                if (match) {
                  const firstPara = match[1].split(/\n\s*\n/)[0] || "";
                  excerpt = firstPara.replace(/[*_`>#-]/g, "").replace(/\s+/g, " ").trim();
                  if (excerpt.length > 240) excerpt = excerpt.slice(0, 237).trimEnd() + "…";
                }
                if (!excerpt) return null;
                return (
                  <p className="text-base lg:text-lg text-foreground/90 leading-relaxed max-w-2xl mb-5">
                    {excerpt}
                  </p>
                );
              })()}
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

            {/* Pricing */}
            {proposal.pricing_breakdown && (
              <section
                id="pricing"
                className={cn(
                  "rounded-xl border border-purple/30 bg-card p-6 lg:p-10 shadow-lg shadow-purple/5 transition-all",
                  acceptedNotPaid && "opacity-70",
                )}
              >
                {/* "What you're getting" removed — the real "What You'll Get" section
                    rendered by PremiumProposalRenderer above already covers this. */}

                <PremiumPricingRenderer content={proposal.pricing_breakdown} showPayCta={false} />

                {formattedTotal && (
                  <div className="mt-8 pt-8 border-t border-border/60">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-1">
                      Total Investment
                    </p>
                    <p className="text-3xl lg:text-4xl font-bold text-foreground tracking-tight">
                      {formattedTotal}
                    </p>
                  </div>

                )}
              </section>
            )}
          </div>
        </details>


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
                { icon: CheckCircle2, title: "Clear deliverables", desc: "Everything included in your proposal is defined in writing before we begin." },
                { icon: Calendar, title: "Transparent milestones", desc: "You'll see the timeline and stages laid out so nothing is a surprise." },
                { icon: MessageCircle, title: "Defined communication", desc: "A single point of contact and a set cadence for updates throughout the project." },
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
          <section className="rounded-xl border border-border bg-card p-6 lg:p-8">
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
                    : "bg-accent text-accent-foreground font-semibold hover:bg-accent/90"}`}
                  variant={contract.status === "signed" ? "outline" : "default"}
                >
                  <RouterLink to={`/sign/${contract.signing_token}`}>
                    <FileSignature className="w-4 h-4" />
                    {contract.status === "signed" || contract.status === "executed" ? "Review" : "Review & sign contract"}
                  </RouterLink>
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* Onboarding step — appears once payment is complete */}
        {isPaid && onboarding && !onboardingComplete && (
          <section className="rounded-xl border border-accent/25 bg-accent/[0.05] p-6 lg:p-8">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 bg-purple/20 text-purple">
                <ClipboardList className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wider text-purple font-semibold mb-1">Next step</p>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {onboardingStarted ? "Continue your onboarding" : "Complete Your Onboarding"}
                </h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md">
                  Tell us a bit about your project so we can hit the ground running. Takes about 3–5 minutes.
                </p>
                <Button
                  asChild
                  size="lg"
                  className="gap-2 bg-accent text-accent-foreground font-semibold hover:bg-accent/90"
                >
                  <RouterLink to={`/onboard/${onboarding.access_token}`}>
                    <ClipboardList className="w-4 h-4" />
                    {onboardingStarted ? "Continue Onboarding" : "Start Onboarding"}
                    <ArrowRight className="w-4 h-4" />
                  </RouterLink>
                </Button>
              </div>
            </div>
          </section>
        )}

        {/* Onboarding completed confirmation */}
        {isPaid && onboardingComplete && (
          <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 lg:p-8">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 bg-emerald-500/15 text-emerald-500">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wider text-emerald-500 font-semibold mb-1">Project Ready</p>
                <h3 className="text-lg font-semibold text-foreground mb-1">Onboarding complete 🚀</h3>
                <p className="text-sm text-muted-foreground">
                  Thanks! Everything's in place. We'll be in touch shortly to begin your project.
                </p>
              </div>
            </div>
          </section>
        )}
        {isPaid ? (
          <section className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6 lg:p-10 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 mb-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-2">
              Payment received — we're on it
            </h2>
            <p className="text-muted-foreground text-sm mb-5">
              Thanks! A confirmation has been sent. {upcomingBooking
                ? `Your kickoff call is booked for ${new Date(upcomingBooking.scheduled_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.`
                : (ownerKickoffUrl || bookingLink) ? "Lock in your kickoff call below." : "We'll be in touch shortly to kick things off."}
            </p>
            {!upcomingBooking && (ownerKickoffUrl || bookingLink) && (
              <Button
                size="lg"
                asChild
                className="gap-2 bg-accent text-accent-foreground font-semibold hover:bg-accent/90"
              >
                {ownerKickoffUrl ? (
                  <a href={ownerKickoffUrl} target="_blank" rel="noopener noreferrer">
                    <CalendarPlus className="w-4 h-4" />
                    Book your kickoff call
                  </a>
                ) : (
                  <RouterLink to={`/book/${bookingLink!.slug}?proposal=${proposal.id}`}>
                    <CalendarPlus className="w-4 h-4" />
                    Book your kickoff call
                  </RouterLink>
                )}
              </Button>
            )}
          </section>
        ) : isAccepted && isContractSigned && !hasPrice && !upcomingBooking && (ownerKickoffUrl || bookingLink) ? (
          <section className="rounded-xl border border-accent/25 bg-accent/[0.05] p-6 lg:p-10 text-center">
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
              className="gap-2 bg-accent text-accent-foreground font-semibold hover:bg-accent/90"
            >
              {ownerKickoffUrl ? (
                <a href={ownerKickoffUrl} target="_blank" rel="noopener noreferrer">
                  <CalendarPlus className="w-4 h-4" />
                  Schedule Call
                </a>
              ) : (
                <RouterLink to={`/book/${bookingLink!.slug}?proposal=${proposal.id}`}>
                  <CalendarPlus className="w-4 h-4" />
                  Schedule Call
                </RouterLink>
              )}
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
          <section id="accept-section" className="rounded-xl border border-border bg-card p-6 lg:p-10 scroll-mt-24">

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
                className="gap-2 bg-accent text-accent-foreground font-semibold hover:bg-accent/90 transition-colors h-12 disabled:opacity-50"
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
            className="w-full gap-2 bg-accent text-accent-foreground font-semibold h-12"
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
