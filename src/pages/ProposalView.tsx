import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, Save, Loader2, Pencil, Eye, Copy, Check, Sparkles, RefreshCw, Wand2, Zap, Send, XCircle, CheckCircle2, Mail, ExternalLink, AlertTriangle, Banknote, FileText, Crown, Lock, MessageCircle } from "lucide-react";
import { waLink } from "@/lib/whatsapp";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ReactMarkdown from "react-markdown";
import PremiumProposalRenderer from "@/components/proposal/PremiumProposalRenderer";
import { renderMergeTags } from "@/lib/merge-tags";
import PremiumPricingRenderer from "@/components/proposal/PremiumPricingRenderer";
import PremiumInvoiceRenderer from "@/components/proposal/PremiumInvoiceRenderer";
import ProposalHeader from "@/components/proposal/ProposalHeader";
import StatusBadge, { normalizeStatus, type ProposalStatus } from "@/components/proposal/StatusBadge";
import FollowUpDialog from "@/components/proposal/FollowUpDialog";
import { getFollowUpScenario, FOLLOW_UP_META } from "@/lib/follow-up";
import FollowUpStatus from "@/components/proposal/FollowUpStatus";
import { sendEmail } from "@/lib/email";
import { usePlan } from "@/hooks/use-plan";
import UpgradeModal from "@/components/plan/UpgradeModal";
import ProposalWatermark from "@/components/plan/ProposalWatermark";
import DealScoreBadge from "@/components/ai/DealScoreBadge";
import ProposalAuditPanel from "@/components/ai/ProposalAuditPanel";
import TemplateEditorDialog from "@/components/templates/TemplateEditorDialog";
import { Bookmark } from "lucide-react";
import { calculateCommercialTotals } from "@/lib/commercial-calc";

interface ProposalData {
  id: string;
  client_name: string;
  company_name: string;
  service_type: string;
  proposal_content: string;
  pricing_breakdown: string;
  invoice_content: string;
  created_at: string;
  client_paid: boolean;
  budget: string;
  project_scope: string;
  timeline: string;
  notes: string | null;
  client_id: string | null;
  status: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  amount_cents: number | null;
  currency: string | null;
  paid_at: string | null;
  goals: string | null;
  deliverables: string | null;
  tax_rate: number | null;
  payment_terms: string | null;
  tax_mode: string | null;
}

const SECTION_HEADINGS = [
  "What You'll Get",
  "Introduction",
  "Your Current Challenge",
  "How We'll Solve This",
  "Scope of Work",
  "Deliverables",
  "Timeline",
  "Expected Outcomes",
  "Investment",
  "Why Choose Us",
  "Next Steps",
];

// Replace the markdown of a single "## Section" block within a proposal document.
function replaceSection(fullMarkdown: string, sectionTitle: string, newSectionMarkdown: string): string {
  const escaped = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|\\n)##\\s+${escaped}\\b[\\s\\S]*?(?=\\n##\\s+|$)`, "i");
  const trimmed = newSectionMarkdown.trim();
  if (re.test(fullMarkdown)) {
    return fullMarkdown.replace(re, (match, leading) => `${leading}${trimmed}\n`);
  }
  // Section missing — append at end
  return `${fullMarkdown.trimEnd()}\n\n${trimmed}\n`;
}

function MarkdownPreview({ content, isPremium }: { content: string; isPremium?: boolean }) {
  if (isPremium) {
    return <PremiumProposalRenderer content={content} />;
  }
  return (
    <div className="prose prose-invert prose-sm max-w-none text-muted-foreground leading-relaxed">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}

export default function ProposalView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasFeature, isFree } = usePlan();
  const paymentsUnlocked = hasFeature("payments");
  const watermark = !hasFeature("watermark"); // free plan keeps watermark
  const [paymentsUpgradeOpen, setPaymentsUpgradeOpen] = useState(false);
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);

  const [editedProposal, setEditedProposal] = useState("");
  const [editedPricing, setEditedPricing] = useState("");
  const [editedInvoice, setEditedInvoice] = useState("");
  const [copied, setCopied] = useState(false);
  const [clientPaid, setClientPaid] = useState(false);
  const [clientEmail, setClientEmail] = useState<string | null>(null);
  const [clientPhone, setClientPhone] = useState<string | null>(null);
  const [mergeIntake, setMergeIntake] = useState<Record<string, string> | null>(null);
  const [autoFillingPrice, setAutoFillingPrice] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [linkedContract, setLinkedContract] = useState<{
    id: string;
    body: string | null;
    source: string | null;
    status: string | null;
    title: string | null;
  } | null>(null);
  const [retryingContract, setRetryingContract] = useState(false);

  const [leadContext, setLeadContext] = useState<{ original_lead_message?: string; recent_thread?: string }>({});
  const [defaultCurrency, setDefaultCurrency] = useState<string>("USD");
  const [ownerBranding, setOwnerBranding] = useState<{
    business_name: string | null;
    legal_name: string | null;
    trading_name: string | null;
    tagline: string | null;
    logo_url: string | null;
    brand_color: string | null;
    brand_secondary_color: string | null;
    show_logo_on_proposals: boolean | null;
    proposal_cover_show_name: boolean | null;
    proposal_cover_show_tagline: boolean | null;
    proposal_cover_show_date: boolean | null;
  } | null>(null);

  const buildSourcePayload = () => {
    if (!proposal) return null;
    return {
      client_name: proposal.client_name,
      company_name: proposal.company_name,
      service_type: proposal.service_type,
      project_scope: proposal.project_scope || "",
      budget: proposal.budget || "",
      timeline: proposal.timeline || "",
      notes: proposal.notes || "",
      goals: proposal.goals || "",
      deliverables: proposal.deliverables || "",
      currency: proposal.currency || defaultCurrency || undefined,
      amount_cents: proposal.amount_cents ?? undefined,
      tax_mode: proposal.tax_mode ?? undefined,
      tax_rate: proposal.tax_rate ?? undefined,
      payment_terms: proposal.payment_terms ?? undefined,
      original_lead_message: leadContext.original_lead_message || undefined,
      recent_thread: leadContext.recent_thread || undefined,
    };
  };

  const handleRegenerateFull = async (tone?: "concise" | "persuasive" | "alternative") => {
    const source = buildSourcePayload();
    if (!source) return;
    const key = tone || "full";
    setRegenerating(key);
    try {
      const { data, error } = await supabase.functions.invoke("generate-proposal", {
        body: { ...source, tone, proposal_id: id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.proposal) setEditedProposal(data.proposal);
      if (data?.pricing) setEditedPricing(data.pricing);
      if (data?.invoice) setEditedInvoice(data.invoice);
      await supabase.from("proposals").update({
        proposal_content: data.proposal,
        pricing_breakdown: data.pricing,
        invoice_content: data.invoice,
      }).eq("id", id);
      toast({ title: tone ? `Regenerated (${tone})` : "Proposal regenerated" });
    } catch (e: any) {
      toast({ title: "Regeneration failed", description: e.message || "Try again.", variant: "destructive" });
    } finally {
      setRegenerating(null);
    }
  };

  const handleRegenerateSection = async (section: string) => {
    const source = buildSourcePayload();
    if (!source) return;
    setRegenerating(section);
    try {
      const { data, error } = await supabase.functions.invoke("generate-proposal", {
        body: { ...source, section, existing_proposal: editedProposal },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const newSection = (data?.section || "").trim();
      if (!newSection) throw new Error("Empty section returned");
      const updated = replaceSection(editedProposal, section, newSection);
      setEditedProposal(updated);
      await supabase.from("proposals").update({ proposal_content: updated }).eq("id", id);
      toast({ title: `${section} regenerated` });
    } catch (e: any) {
      toast({ title: "Regeneration failed", description: e.message || "Try again.", variant: "destructive" });
    } finally {
      setRegenerating(null);
    }
  };

  // updateStatus performs the raw status transition and optionally tags a source
  // for the matching `{status}_source` column. Explicit actions pass "system" or
  // "owner_manual"; the stage-progress bar defaults to "owner_manual".
  // Note: this function no longer sends any client email as a side-effect —
  // system-confirmed sends live in `sendViaCloseSync` below.
  const updateStatus = async (
    next: ProposalStatus,
    source: "system" | "owner_manual" | null = null,
  ) => {
    if (!proposal) return true;
    const nowIso = new Date().toISOString();
    const updates: Record<string, string | null> = { status: next };
    // Stamp timestamps once, preserving original event time.
    if (next === "sent" && !proposal.sent_at) updates.sent_at = nowIso;
    if (next === "viewed" && !proposal.viewed_at) updates.viewed_at = nowIso;
    if (next === "accepted") {
      if (!proposal.accepted_at) updates.accepted_at = nowIso;
      // Accepted and rejected are mutually exclusive — clear the opposite stamp.
      updates.rejected_at = null;
    }
    if (next === "rejected") {
      if (!proposal.rejected_at) updates.rejected_at = nowIso;
      updates.accepted_at = null;
    }

    // Only stamp the *_source column when it isn't already set — a real client
    // action recorded through client_portal_respond ("client") must never be
    // downgraded to "owner_manual" by a later manual toggle. "system" from an
    // explicit CloseSync send is allowed to overwrite a null.
    if (source) {
      const key = `${next}_source` as
        | "sent_source" | "viewed_source" | "accepted_source" | "rejected_source";
      const existing = (proposal as any)[key] as string | null | undefined;
      if (!existing) updates[key] = source;
    }

    const previous = proposal;
    setProposal({ ...proposal, ...(updates as Partial<ProposalData>) });
    const { error } = await supabase.from("proposals").update(updates as never).eq("id", proposal.id);
    if (error) {
      setProposal(previous);
      toast({ title: "Status update failed", description: error.message, variant: "destructive" });
      return false;
    }
    const labels: Record<ProposalStatus, string> = {
      draft: "Draft", sent: "Sent", viewed: "Viewed", accepted: "Accepted", rejected: "Rejected",
    };
    toast({ title: `Marked as ${labels[next]}` });
    return true;
  };

  // Explicit owner action — "Mark as sent" without a delivery confirmation.
  // Tags sent_source="owner_manual" so downstream automations can tell this
  // apart from a real system-confirmed send.
  const markAsSent = async () => {
    if (!proposal) return;
    if (currentStatus !== "draft") {
      toast({ title: "Already sent" });
      return;
    }
    await updateStatus("sent", "owner_manual");
  };

  // System-confirmed send — call the transactional email helper directly and
  // ONLY on confirmed success mark the proposal as sent with source="system".
  const sendViaCloseSync = async () => {
    if (!proposal) return;
    if (!clientEmail) {
      toast({
        title: "No client email on file",
        description: "Add a client email to send via CloseSync.",
        variant: "destructive",
      });
      return;
    }
    try {
      const { data: udata } = await supabase.auth.getUser();
      const fromName =
        (udata.user?.user_metadata as any)?.full_name ||
        udata.user?.email?.split("@")[0] ||
        "Your contact";
      const amount =
        proposal.amount_cents != null
          ? new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: proposal.currency || "USD",
            }).format((proposal.amount_cents || 0) / 100)
          : undefined;
      // Call the edge function directly instead of the `sendEmail` helper —
      // the helper swallows errors, but here we must be certain the send
      // succeeded before marking the proposal as sent.
      const { data: res, error: sendErr } = await supabase.functions.invoke("send-email", {
        body: {
          templateName: "proposal-sent",
          recipientEmail: clientEmail,
          userId: udata.user?.id,
          idempotencyKey: `proposal-sent-${proposal.id}`,
          data: {
            from_name: fromName,
            title: proposal.client_name,
            amount,
            url: `${window.location.origin}/proposal/view/${proposal.id}`,
          },
        },
      });
      if (sendErr) throw new Error(sendErr.message || "Email send failed");
      if (res && typeof res === "object" && (res as any).error) {
        throw new Error((res as any).error?.message || (res as any).error || "Email send failed");
      }
      if (currentStatus === "draft") await updateStatus("sent", "system");
      toast({ title: "Sent via CloseSync", description: `Email delivered to ${clientEmail}.` });
    } catch (e: any) {
      toast({
        title: "Send failed",
        description: e?.message || "Couldn't send the email. Proposal is still marked as draft.",
        variant: "destructive",
      });
    }
  };

  const handleCopyProposal = async () => {
    const fullText = [editedProposal, editedPricing, editedInvoice].filter(Boolean).join("\n\n---\n\n");
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast({ title: "Copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    const fetchProposal = async () => {
      const { data } = await supabase
        .from("proposals")
        .select("*")
        .eq("id", id)
        .single();

      if (data) {
        setProposal(data);
        setEditedProposal(data.proposal_content || "");
        setEditedPricing(data.pricing_breakdown || "");
        setEditedInvoice(data.invoice_content || "");
        setClientPaid(data.client_paid || false);
        if (data.client_id) {
          const { data: client } = await supabase
            .from("clients")
            .select("email, phone, intake_responses, original_lead_message, lead_thread")
            .eq("id", data.client_id)
            .single();
          if (client?.email) setClientEmail(client.email);
          if ((client as any)?.phone) setClientPhone((client as any).phone);
          if (client && (client as any).intake_responses) {
            setMergeIntake((client as any).intake_responses as Record<string, string>);
          }

          // Live-fetch original lead message + recent thread summary for regeneration context.
          const originalLeadMessage = (client as any)?.original_lead_message || undefined;
          const leadThread: Array<{ subject?: string; body?: string; received_at?: string }> =
            Array.isArray((client as any)?.lead_thread) ? (client as any).lead_thread : [];
          let recentThread = "";
          if (leadThread.length) {
            const sorted = [...leadThread].sort((a, b) => {
              const ta = a?.received_at ? new Date(a.received_at).getTime() : 0;
              const tb = b?.received_at ? new Date(b.received_at).getTime() : 0;
              return tb - ta;
            });
            recentThread = sorted
              .slice(0, 3)
              .map((e) => (e?.body || "").toString().trim().slice(0, 500))
              .filter(Boolean)
              .join("\n---\n");
          }
          setLeadContext({ original_lead_message: originalLeadMessage, recent_thread: recentThread || undefined });
        }

        // Fetch the owner's default currency + public-facing branding (used for the
        // ProposalHeader identity block and the exported PDF cover/footer/accent color).
        try {
          const { data: udata } = await supabase.auth.getUser();
          if (udata?.user) {
            const { data: branding } = await supabase
              .from("business_branding")
              .select(
                "default_currency, business_name, legal_name, trading_name, tagline, logo_url, brand_color, brand_secondary_color, show_logo_on_proposals, proposal_cover_show_name, proposal_cover_show_tagline, proposal_cover_show_date",
              )
              .eq("user_id", udata.user.id)
              .maybeSingle();
            if ((branding as any)?.default_currency) setDefaultCurrency((branding as any).default_currency);
            if (branding) {
              const b = branding as any;
              setOwnerBranding({
                business_name: b.business_name ?? null,
                legal_name: b.legal_name ?? null,
                trading_name: b.trading_name ?? null,
                tagline: b.tagline ?? null,
                logo_url: b.logo_url ?? null,
                brand_color: b.brand_color ?? null,
                brand_secondary_color: b.brand_secondary_color ?? null,
                show_logo_on_proposals: b.show_logo_on_proposals ?? null,
                proposal_cover_show_name: b.proposal_cover_show_name ?? null,
                proposal_cover_show_tagline: b.proposal_cover_show_tagline ?? null,
                proposal_cover_show_date: b.proposal_cover_show_date ?? null,
              });
            }
          }
        } catch {
          // Ignore — dropdown will fall back to USD and header will render without branding.
        }
        // Fetch the linked contract (if any) so we can detect an empty
        // placeholder from acceptance-auto and offer a retry action.
        try {
          const { data: contractRow } = await supabase
            .from("contracts")
            .select("id, body, source, status, title")
            .eq("proposal_id", id)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          setLinkedContract(contractRow ? {
            id: contractRow.id,
            body: contractRow.body ?? null,
            source: (contractRow as any).source ?? null,
            status: contractRow.status ?? null,
            title: contractRow.title ?? null,
          } : null);
        } catch {
          // Non-fatal — alert simply won't trigger.
        }
      }
      setLoading(false);
    };
    fetchProposal();
  }, [id]);


  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("proposals")
      .update({
        proposal_content: editedProposal,
        pricing_breakdown: editedPricing,
        invoice_content: editedInvoice,
      })
      .eq("id", id);

    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved successfully" });
    }
  };

  const toggleEdit = (tab: string) => {
    setEditMode((prev) => ({ ...prev, [tab]: !prev[tab] }));
  };

  // Note: no generic-brand logo fallback — if the owner hasn't configured a logo,
  // we simply render no logo image in the exported PDF.

  const handleExportPDF = (type: "proposal" | "invoice") => {
    const rawContent = type === "proposal" ? editedProposal + "\n\n## Pricing\n\n" + editedPricing : editedInvoice;
    const docTitle = type === "proposal" ? "Project Proposal" : "Invoice";
    const title = type === "proposal"
      ? `Proposal - ${proposal?.client_name}`
      : `Invoice - ${proposal?.client_name}`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // Owner branding for the exported PDF. Fall back to a neutral slate accent
    // and omit the brand mark entirely when the owner hasn't configured branding.
    const brandName = (ownerBranding?.business_name || "").trim();
    const brandLogoUrl = ownerBranding?.logo_url || "";
    const accent = ownerBranding?.brand_color || "#334155"; // neutral slate fallback
    const accentSoftBg = ownerBranding?.brand_color ? `${ownerBranding.brand_color}0f` : "#f8fafc";

    // Markdown → structured HTML, section-wrapped
    const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const renderInline = (s: string) =>
      escapeHtml(s)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>");

    const lines = rawContent.replace(/\r\n/g, "\n").split("\n");
    const sections: { title: string; html: string }[] = [];
    let current: { title: string; buffer: string[] } | null = { title: docTitle === "Invoice" ? "Invoice" : "Overview", buffer: [] };

    const flushBuffer = (buf: string[]): string => {
      const out: string[] = [];
      let i = 0;
      while (i < buf.length) {
        const line = buf[i];
        if (/^---+$/.test(line.trim())) { i++; continue; }
        // Table
        if (/^\s*\|.+\|\s*$/.test(line)) {
          const rows: string[][] = [];
          while (i < buf.length && /^\s*\|.+\|\s*$/.test(buf[i])) {
            const cells = buf[i].trim().split("|").slice(1, -1).map(c => c.trim());
            if (!cells.every(c => /^[-:]+$/.test(c))) rows.push(cells);
            i++;
          }
          if (rows.length) {
            const header = rows[0];
            const body = rows.slice(1);
            const totalIdx = body.findIndex(r => /total/i.test(r[0] || ""));
            out.push('<div class="pricing-card"><table><thead><tr>' +
              header.map(h => `<th>${renderInline(h)}</th>`).join("") +
              '</tr></thead><tbody>' +
              body.map((r, ri) => {
                const cls = ri === totalIdx ? ' class="total-row"' : '';
                return `<tr${cls}>` + r.map((c, ci) => `<td${ci === r.length - 1 ? ' class="num"' : ''}>${renderInline(c)}</td>`).join("") + '</tr>';
              }).join("") +
              '</tbody></table></div>');
          }
          continue;
        }
        // List
        if (/^\s*[-*]\s+/.test(line)) {
          const items: string[] = [];
          while (i < buf.length && /^\s*[-*]\s+/.test(buf[i])) {
            items.push(buf[i].replace(/^\s*[-*]\s+/, ""));
            i++;
          }
          out.push('<ul>' + items.map(it => `<li><span class="bullet"></span><span>${renderInline(it)}</span></li>`).join("") + '</ul>');
          continue;
        }
        // H3
        const h3 = line.match(/^###\s+(.+)$/);
        if (h3) { out.push(`<h3>${renderInline(h3[1])}</h3>`); i++; continue; }
        // Blank → paragraph break
        if (!line.trim()) { i++; continue; }
        // Paragraph (consume consecutive non-special lines)
        const paraLines: string[] = [];
        while (
          i < buf.length &&
          buf[i].trim() &&
          !/^###\s+/.test(buf[i]) &&
          !/^\s*[-*]\s+/.test(buf[i]) &&
          !/^\s*\|.+\|\s*$/.test(buf[i]) &&
          !/^---+$/.test(buf[i].trim())
        ) {
          paraLines.push(buf[i]);
          i++;
        }
        if (paraLines.length) out.push(`<p>${renderInline(paraLines.join(" "))}</p>`);
      }
      return out.join("\n");
    };

    for (const line of lines) {
      const h2 = line.match(/^##\s+(.+)$/);
      if (h2) {
        if (current && current.buffer.length) sections.push({ title: current.title, html: flushBuffer(current.buffer) });
        current = { title: h2[1].trim(), buffer: [] };
      } else {
        current!.buffer.push(line);
      }
    }
    if (current && current.buffer.length) sections.push({ title: current.title, html: flushBuffer(current.buffer) });

    const sectionsHtml = sections
      .filter(s => s.html.trim())
      .map(s => `<section class="section"><h2>${escapeHtml(s.title)}</h2><div class="section-body">${s.html}</div></section>`)
      .join("");

    const dateStr = new Date(proposal?.created_at || '').toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });

    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fraunces:wght@600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 18mm 16mm; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #ffffff; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #1f2937;
    line-height: 1.65;
    font-size: 11pt;
    -webkit-font-smoothing: antialiased;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .doc { max-width: 780px; margin: 0 auto; padding: 32px 28px 56px; }

  /* COVER */
  .cover {
    border: 1px solid #e5e7eb;
    border-top: 4px solid ${accent};
    border-radius: 6px;
    padding: 28px 32px 32px;
    margin-bottom: 32px;
    background: #ffffff;
  }
  .cover-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 28px; }
  .cover-brand img { width: 28px; height: 28px; border-radius: 6px; }
  .cover-brand-name { font-size: 11pt; font-weight: 700; color: #111827; letter-spacing: -0.2px; }
  .cover-brand-tag { font-size: 8.5pt; color: #6b7280; margin-left: auto; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; }
  .cover-eyebrow { font-size: 9pt; color: ${accent}; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px; }
  .cover-title { font-family: 'Fraunces', 'Inter', serif; font-size: 28pt; font-weight: 700; color: #0f172a; letter-spacing: -0.8px; line-height: 1.1; margin-bottom: 22px; }
  .cover-meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px 32px; padding-top: 20px; border-top: 1px solid #f1f5f9; }
  .meta-label { font-size: 8pt; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; margin-bottom: 4px; }
  .meta-value { font-size: 11pt; color: #0f172a; font-weight: 600; }

  /* SECTIONS */
  .section { padding: 22px 0 8px; border-top: 1px solid #f1f5f9; }
  .section:first-of-type { border-top: none; padding-top: 8px; }
  .section h2 {
    font-family: 'Fraunces', 'Inter', serif;
    font-size: 16pt;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.3px;
    margin-bottom: 14px;
    position: relative;
    padding-left: 14px;
  }
  .section h2::before {
    content: '';
    position: absolute;
    left: 0; top: 8px; bottom: 8px;
    width: 3px;
    background: ${accent};
    border-radius: 2px;
  }
  .section-body h3 {
    font-size: 11pt;
    font-weight: 700;
    color: #111827;
    margin: 18px 0 6px;
    letter-spacing: -0.1px;
  }
  .section-body p {
    margin: 8px 0;
    color: #374151;
    font-size: 11pt;
    line-height: 1.7;
  }
  .section-body strong { color: #0f172a; font-weight: 600; }
  .section-body em { color: #4b5563; }

  /* LISTS */
  .section-body ul { list-style: none; margin: 10px 0 14px; padding: 0; }
  .section-body li {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 5px 0;
    color: #374151;
    font-size: 11pt;
    line-height: 1.6;
  }
  .bullet {
    flex-shrink: 0;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: ${accent};
    margin-top: 8px;
  }

  /* PRICING */
  .pricing-card {
    margin: 14px 0 18px;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    overflow: hidden;
  }
  table { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
  thead th {
    background: #f8fafc;
    text-align: left;
    padding: 10px 16px;
    font-size: 8.5pt;
    font-weight: 700;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    border-bottom: 1px solid #e5e7eb;
  }
  tbody td {
    padding: 12px 16px;
    border-bottom: 1px solid #f1f5f9;
    color: #374151;
    vertical-align: top;
  }
  tbody tr:last-child td { border-bottom: none; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; color: #0f172a; }
  tr.total-row td {
    background: ${accentSoftBg};
    border-top: 2px solid ${accent};
    font-weight: 700;
    color: #0f172a;
    font-size: 11.5pt;
    padding: 14px 16px;
  }

  /* FOOTER */
  .doc-footer {
    margin-top: 40px;
    padding-top: 16px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8.5pt;
    color: #94a3b8;
  }
  .footer-brand { font-weight: 700; color: ${accent}; }

  /* PRINT */
  @media print {
    .doc { padding: 0; max-width: none; }
    .cover { break-after: avoid; page-break-after: avoid; }
    .section { break-inside: avoid-page; page-break-inside: avoid; }
    .pricing-card, table, tr { break-inside: avoid; page-break-inside: avoid; }
    h2, h3 { break-after: avoid; page-break-after: avoid; }
  }
</style>
</head>
<body>
  <div class="doc">
    <div class="cover">
      <div class="cover-brand">
        ${brandLogoUrl ? `<img src="${escapeHtml(brandLogoUrl)}" alt="${escapeHtml(brandName || "Logo")}" />` : ""}
        ${brandName ? `<div class="cover-brand-name">${escapeHtml(brandName)}</div>` : ""}
        <div class="cover-brand-tag">${type === "proposal" ? "Proposal" : "Invoice"}</div>
      </div>
      <div class="cover-eyebrow">Prepared for ${escapeHtml(proposal?.client_name || "")}</div>
      <div class="cover-title">${escapeHtml(docTitle)}</div>
      <div class="cover-meta">
        <div><div class="meta-label">Client</div><div class="meta-value">${escapeHtml(proposal?.client_name || "")}</div></div>
        <div><div class="meta-label">Company</div><div class="meta-value">${escapeHtml(proposal?.company_name || "")}</div></div>
        <div><div class="meta-label">Service</div><div class="meta-value">${escapeHtml(proposal?.service_type || "")}</div></div>
        <div><div class="meta-label">Date</div><div class="meta-value">${dateStr}</div></div>
      </div>
    </div>

    ${sectionsHtml}

    <div class="doc-footer">
      <div>${brandName ? `Prepared by <span class="footer-brand">${escapeHtml(brandName)}</span>` : ""}</div>
      <div>Confidential · ${dateStr}</div>
    </div>
  </div>
</body>
</html>`);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 350);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!proposal) {
    return (
      <DashboardLayout>
        <p className="text-muted-foreground">Proposal not found.</p>
      </DashboardLayout>
    );
  }

  const mergeCtx = {
    client: { name: proposal.client_name, company: proposal.company_name },
    business: null,
    intake: mergeIntake,
  };
  const merge = (s: string) => renderMergeTags(s, mergeCtx);
  const tabs = [
    { key: "proposal", label: "Proposal", content: editedProposal, rendered: merge(editedProposal), setter: setEditedProposal, rows: 24 },
    { key: "pricing", label: "Pricing", content: editedPricing, rendered: merge(editedPricing), setter: setEditedPricing, rows: 16 },
    { key: "invoice", label: "Invoice", content: editedInvoice, rendered: merge(editedInvoice), setter: setEditedInvoice, rows: 16 },
  ];

  const currentStatus = normalizeStatus(proposal.status);
  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

  // Linear progress: Draft → Sent → Viewed → Accepted → Paid
  type StageKey = "draft" | "sent" | "viewed" | "accepted" | "paid";
  const stageOrder: StageKey[] = ["draft", "sent", "viewed", "accepted", "paid"];
  const stageMeta: Record<StageKey, { label: string; at: string | null; icon: typeof Send }> = {
    draft:    { label: "Draft",    at: proposal.created_at,  icon: FileText },
    sent:     { label: "Sent",     at: proposal.sent_at,     icon: Send },
    viewed:   { label: "Viewed",   at: proposal.viewed_at,   icon: Eye },
    accepted: { label: "Accepted", at: proposal.accepted_at, icon: CheckCircle2 },
    paid:     { label: "Paid",     at: proposal.paid_at,     icon: Banknote },
  };
  const currentStageIndex: number = clientPaid
    ? 4
    : (() => {
        let last = 0;
        stageOrder.forEach((s, idx) => {
          if (idx === 0) return;
          if (stageMeta[s].at) last = idx;
        });
        if (currentStatus === "accepted" && last < 3) last = 3;
        return last;
      })();
  const isRejected = currentStatus === "rejected";

  // Auto follow-up scenario (timestamp-based)
  const followUpScenario = getFollowUpScenario({
    status: currentStatus,
    client_paid: clientPaid,
    sent_at: proposal.sent_at,
    viewed_at: proposal.viewed_at,
    accepted_at: proposal.accepted_at,
    paid_at: proposal.paid_at,
  });

  // Owner-triggered retry for auto-generated contract when the placeholder was
  // left empty (or when no contract row exists yet despite acceptance). Uses
  // the same idempotency guarantee as client_portal_respond's accept branch:
  // only inserts if no acceptance_auto row already exists for this proposal.
  const handleRetryContractGeneration = async () => {
    if (!proposal || retryingContract) return;
    setRetryingContract(true);
    try {
      const contractType = /retainer/i.test(proposal.service_type || "")
        ? "retainer_agreement"
        : "service_agreement";
      const totals = calculateCommercialTotals(
        proposal.amount_cents ?? 0,
        proposal.tax_rate,
        proposal.tax_mode as any,
      );

      // Resolve an existing acceptance_auto row for this proposal — do not
      // create a duplicate if one already exists (Batch 1 idempotency).
      let targetContractId: string | null = null;
      const { data: existingAuto } = await supabase
        .from("contracts")
        .select("id, body")
        .eq("proposal_id", proposal.id)
        .eq("source", "acceptance_auto")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingAuto?.id) {
        targetContractId = existingAuto.id;
      } else {
        // No acceptance_auto row at all — safe to insert one now.
        const { data: udata } = await supabase.auth.getUser();
        const ownerId = udata?.user?.id;
        if (!ownerId) throw new Error("Not authenticated");
        const { data: inserted, error: insertErr } = await supabase
          .from("contracts")
          .insert({
            user_id: ownerId,
            proposal_id: proposal.id,
            client_id: proposal.client_id,
            contract_type: contractType,
            title: (contractType === "retainer_agreement" ? "Retainer Agreement" : "Service Agreement")
              + " — " + (proposal.client_name || "Client"),
            client_name: proposal.client_name,
            company_name: proposal.company_name,
            body: "",
            currency: proposal.currency || "USD",
            amount_cents: null,
            status: "draft",
            source: "acceptance_auto",
          } as any)
          .select("id")
          .single();
        if (insertErr) throw insertErr;
        targetContractId = inserted?.id ?? null;
      }

      if (!targetContractId) throw new Error("Could not resolve contract row");

      const { data: genData, error: genErr } = await supabase.functions.invoke("generate-contract", {
        body: {
          contract_type: contractType,
          client_name: proposal.client_name,
          company_name: proposal.company_name,
          service_type: proposal.service_type,
          project_scope: proposal.project_scope || "",
          timeline: proposal.timeline || "",
          budget: proposal.budget || "",
          payment_terms: proposal.payment_terms || undefined,
          currency: proposal.currency,
          subtotal_cents: totals.subtotalCents,
          tax_rate: proposal.tax_rate,
          tax_mode: proposal.tax_mode,
          tax_amount_cents: totals.taxAmountCents,
          total_cents: totals.totalCents,
        },
      });
      if (genErr) throw genErr;
      if (!genData?.body) throw new Error("Generator returned no body");

      const { data: updated, error: updErr } = await supabase
        .from("contracts")
        .update({
          title: genData.title || (contractType === "retainer_agreement" ? "Retainer Agreement" : "Service Agreement"),
          body: genData.body,
          amount_cents: proposal.amount_cents != null ? totals.totalCents : null,
          currency: proposal.currency,
        })
        .eq("id", targetContractId)
        .select("id, body, source, status, title")
        .single();
      if (updErr) throw updErr;

      setLinkedContract(updated ? {
        id: updated.id,
        body: updated.body ?? null,
        source: (updated as any).source ?? null,
        status: updated.status ?? null,
        title: updated.title ?? null,
      } : null);

      toast({ title: "Contract regenerated", description: "The agreement draft is ready to review." });
    } catch (err: any) {
      toast({
        title: "Couldn't regenerate contract",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setRetryingContract(false);
    }
  };

  // Contract-draft-needs-attention: accepted proposal, but the linked contract
  // either doesn't exist or has an empty body (Batch 1's placeholder was left
  // unfilled because generate-contract failed at accept time).
  const contractNeedsAttention =
    currentStatus === "accepted" &&
    !clientPaid &&
    (!linkedContract || !((linkedContract.body || "").trim()));

  const contractReadyForSend =
    currentStatus === "accepted" &&
    linkedContract?.status === "draft" &&
    ((linkedContract.body || "").trim());

  const contractSentOrViewed =
    currentStatus === "accepted" &&
    linkedContract &&
    (linkedContract.status === "sent" || linkedContract.status === "viewed");

  const contractSigned =
    currentStatus === "accepted" &&
    linkedContract?.status === "signed";

  const contractExecutedUnpaid =
    currentStatus === "accepted" &&
    linkedContract?.status === "executed" &&
    !clientPaid;

  // Smart alerts (priority order)
  const alerts: {
    tone: "warning" | "info" | "success";
    icon: typeof AlertTriangle;
    text: string;
    action?: { label: string; onClick: () => void; loading?: boolean };
  }[] = [];
  if (isRejected) {
    alerts.push({ tone: "warning", icon: XCircle, text: "Client rejected this proposal. Consider following up or revising." });
  } else if (clientPaid) {
    alerts.push({ tone: "success", icon: CheckCircle2, text: "Payment received in full. You're all set." });
  } else if (contractNeedsAttention) {
    alerts.push({
      tone: "warning",
      icon: AlertTriangle,
      text: "Contract draft needs attention — the auto-generated agreement is empty or missing.",
      action: {
        label: retryingContract ? "Generating…" : "Retry generation",
        onClick: () => { void handleRetryContractGeneration(); },
        loading: retryingContract,
      },
    });
  } else if (contractReadyForSend) {
    alerts.push({
      tone: "info",
      icon: FileText,
      text: `Review and send the agreement to ${proposal.client_name}. It's ready for their signature.`,
      action: {
        label: "Review & send contract",
        onClick: () => navigate(`/dashboard/contracts/${linkedContract.id}`),
      },
    });
  } else if (contractSentOrViewed) {
    alerts.push({
      tone: "info",
      icon: Eye,
      text: "Awaiting client signature. You'll be notified once they've signed.",
    });
  } else if (contractSigned) {
    alerts.push({
      tone: "warning",
      icon: Pencil,
      text: "Client has signed — countersign the agreement to execute it.",
      action: {
        label: "Countersign contract",
        onClick: () => navigate(`/dashboard/contracts/${linkedContract.id}`),
      },
    });
  } else if (contractExecutedUnpaid) {
    alerts.push({ tone: "success", icon: Banknote, text: "Accepted — request payment now to close the deal." });
  } else if (followUpScenario !== "none") {
    const meta = FOLLOW_UP_META[followUpScenario];
    alerts.push({ tone: meta.tone, icon: Sparkles, text: `${meta.headline} — ${meta.description}` });
  } else if (currentStatus === "draft") {
    alerts.push({ tone: "warning", icon: AlertTriangle, text: "Proposal not sent yet. Send to client to start the clock." });
  } else if (currentStatus === "sent") {
    alerts.push({ tone: "info", icon: Eye, text: "Sent — waiting for the client to view it." });
  } else if (currentStatus === "viewed") {
    alerts.push({ tone: "info", icon: Sparkles, text: "Client has viewed the proposal. Now's a great time to follow up." });
  }


  const clientUrl = `${window.location.origin}/proposal/view/${proposal.id}`;

  const handleSendCopy = async () => {
    await navigator.clipboard.writeText(clientUrl);
    toast({
      title: "Link copied",
      description: "Share this with your client, then mark as sent when you have.",
    });
  };
  const handleSendEmail = () => {
    const subject = encodeURIComponent(`Your proposal from CloseSync`);
    const body = encodeURIComponent(
      `Hi ${proposal.client_name},\n\nYour proposal is ready. You can review it here:\n${clientUrl}\n\nLet me know if you have any questions.`,
    );
    const to = clientEmail ? encodeURIComponent(clientEmail) : "";
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  };
  const handlePreview = () => window.open(clientUrl, "_blank", "noopener,noreferrer");

  // Auto-fill price by parsing pricing/proposal markdown for a Total
  const handleAutoFillPrice = async () => {
    setAutoFillingPrice(true);
    try {
      const text = (editedPricing || "") + "\n" + (editedProposal || "");
      const totalMatch = text.match(/total[^\n|]*\|\s*([£$€]\s*[\d,]+(?:\.\d+)?)/i)
        || text.match(/\*\*\s*total[^*]*\*\*\s*[:\s]*([£$€]\s*[\d,]+(?:\.\d+)?)/i)
        || text.match(/\*\*\s*([£$€]\s*[\d,]+(?:\.\d+)?)\s*\*\*/);
      if (!totalMatch) {
        toast({ title: "No price found", description: "Couldn't detect a total in the proposal pricing.", variant: "destructive" });
        return;
      }
      const symbol = totalMatch[1].match(/[£$€]/)?.[0] || "£";
      const num = parseFloat(totalMatch[1].replace(/[^\d.]/g, ""));
      if (!Number.isFinite(num) || num <= 0) {
        toast({ title: "Couldn't parse amount", variant: "destructive" });
        return;
      }
      const cents = Math.round(num * 100);

      // Never overwrite an already-set structured currency — this button is a legacy fallback
      // for proposals that predate structured amount_cents/currency.
      const currencyAlreadySet = !!proposal.currency;
      const guessedCurrency = symbol === "£" ? "GBP" : symbol === "€" ? "EUR" : "USD";
      const updates: { amount_cents: number; currency?: string } = { amount_cents: cents };
      if (!currencyAlreadySet) updates.currency = guessedCurrency;

      const { error } = await supabase
        .from("proposals")
        .update(updates)
        .eq("id", proposal.id);
      if (error) throw error;
      setProposal({
        ...proposal,
        amount_cents: cents,
        currency: currencyAlreadySet ? proposal.currency : guessedCurrency,
      });
      const displayCurrency = currencyAlreadySet ? proposal.currency : guessedCurrency;
      toast({ title: "Price filled from proposal", description: `${symbol}${num.toLocaleString()} (${displayCurrency})` });
    } catch (e: any) {
      toast({ title: "Couldn't auto-fill", description: e.message || "Try again.", variant: "destructive" });
    } finally {
      setAutoFillingPrice(false);
    }
  };

  return (
    <DashboardLayout>
      <UpgradeModal
        open={paymentsUpgradeOpen}
        onOpenChange={setPaymentsUpgradeOpen}
        requiredPlan="pro"
        title="Get paid directly through your proposals"
        description="Unlock the Accept & Pay flow to collect payments from clients without leaving the proposal. Available on the Pro plan."
      />
      <div className="max-w-4xl mx-auto px-2 sm:px-4 lg:px-8">
        {/* Compact top meta strip */}
        <div className="mb-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <p className="text-xs text-muted-foreground truncate">
              <span className="text-foreground font-medium">{proposal.client_name}</span>
              <span className="mx-2 text-muted-foreground/50">·</span>
              {proposal.company_name}
            </p>
            <StatusBadge status={currentStatus} paid={clientPaid} descriptive />
            <DealScoreBadge proposalId={proposal.id} enabled={currentStatus !== "draft"} />
          </div>
        </div>

        {/* AI proposal audit (collapsible-feel: hidden until run) */}
        <div className="mb-5">
          <ProposalAuditPanel proposalId={proposal.id} />
        </div>

        {/* Smart alerts */}
        {alerts.length > 0 && (
          <div className="mb-5 space-y-2">
            {alerts.map((a, i) => {
              const Icon = a.icon;
              const toneCls =
                a.tone === "warning"
                  ? "border-amber-500/30 bg-amber-500/5"
                  : a.tone === "success"
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-blue-500/30 bg-blue-500/5";
              const iconCls =
                a.tone === "warning"
                  ? "text-amber-500"
                  : a.tone === "success"
                    ? "text-emerald-500"
                    : "text-blue-500";
              return (
                <div key={i} className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-4 py-2.5 ${toneCls}`}>
                  <Icon className={`w-4 h-4 shrink-0 ${iconCls}`} />
                  <p className="text-sm flex-1 min-w-[12rem] text-foreground/90">{a.text}</p>
                  {a.action && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 w-full sm:w-auto"
                      onClick={a.action.onClick}
                      disabled={a.action.loading}
                    >
                      {a.action.loading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                      {a.action.label}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Unified Proposal Controls */}
        <details open className="group mb-8 rounded-xl border border-border/60 bg-card/40 overflow-hidden">
          <summary className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer list-none hover:bg-card/60 transition-colors">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Proposal Controls</span>
              <span className="text-[10px] text-muted-foreground">(only you can see this)</span>
            </div>
            <span className="text-xs text-muted-foreground transition-transform group-open:rotate-180">▾</span>
          </summary>
          <div className="px-4 pb-5 pt-1 space-y-6 border-t border-border/60">
            {/* === PROPOSAL PROGRESS === */}
            <div className="pt-5">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-4">Proposal Progress</p>
              <div className="flex items-center gap-1 sm:gap-2">
                {stageOrder.map((key, idx) => {
                  const stage = stageMeta[key];
                  const Icon = stage.icon;
                  const isActive = idx === currentStageIndex && !isRejected;
                  const isComplete = idx < currentStageIndex || (idx === currentStageIndex && idx === 4 && clientPaid);
                  const isFuture = idx > currentStageIndex;
                  const isClickable = !isFuture || idx === currentStageIndex + 1;

                  const handleStageClick = () => {
                    if (!isClickable) return;
                    if (key === "draft") return;
                    if (key === "paid") {
                      const next = !clientPaid;
                      setClientPaid(next);
                      void supabase
                        .from("proposals")
                        .update({ client_paid: next, paid_at: next ? new Date().toISOString() : null })
                        .eq("id", proposal.id);
                      toast({ title: next ? "Marked as paid" : "Marked as unpaid" });
                      return;
                    }
                    // Route "sent" through the dedicated "Mark as sent" path so
                    // there's a single consistent code path for owner-manual
                    // sent-marking (no duplicate slightly-different behaviors).
                    if (key === "sent") {
                      void markAsSent();
                      return;
                    }
                    void updateStatus(key as ProposalStatus, "owner_manual");
                  };

                  return (
                    <div key={key} className="flex items-center flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={handleStageClick}
                        disabled={!isClickable}
                        className={`flex flex-col items-center gap-1.5 flex-1 min-w-0 transition-all ${
                          !isClickable ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:opacity-90"
                        }`}
                        title={stage.at ? `${stage.label} · ${fmt(stage.at)}` : stage.label}
                      >
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all ${
                            isComplete
                              ? "border-accent bg-accent text-accent-foreground"
                              : isActive
                                ? "border-purple bg-purple/15 text-purple ring-4 ring-purple/10"
                                : "border-border bg-background/40 text-muted-foreground"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <p className={`text-[10px] sm:text-xs font-medium truncate w-full text-center ${
                          isComplete || isActive ? "text-foreground" : "text-muted-foreground"
                        }`}>
                          {stage.label}
                        </p>
                      </button>
                      {idx < stageOrder.length - 1 && (
                        <div className={`h-0.5 flex-1 min-w-[12px] -mt-5 transition-colors ${
                          idx < currentStageIndex ? "bg-accent" : "bg-border"
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>
              {isRejected && (
                <p className="text-xs text-rose-500 mt-3 text-center">
                  Marked as rejected · {fmt(proposal.rejected_at)}
                </p>
              )}
              <div className="mt-4 flex justify-center gap-2">
                {!isRejected && currentStatus !== "draft" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateStatus("rejected", "owner_manual")}
                    className="gap-1.5 h-7 text-[11px] border-rose-500/30 text-rose-500 hover:bg-rose-500/10 hover:text-rose-500"
                  >
                    <XCircle className="w-3 h-3 shrink-0" /> Mark as rejected
                  </Button>
                )}
                {isRejected && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => markAsSent()}
                    className="gap-1.5 h-7 text-[11px]"
                  >
                    Reopen proposal
                  </Button>
                )}
              </div>
            </div>

            {/* === PAYMENT SETUP === */}
            <div className="pt-5 border-t border-border/60">
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Payment Setup</p>
                {paymentsUnlocked && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleAutoFillPrice}
                    disabled={autoFillingPrice}
                    className="gap-1.5 h-7 text-[11px] text-purple hover:text-purple hover:bg-purple/10"
                  >
                    {autoFillingPrice ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    Auto-fill from proposal
                  </Button>
                )}
              </div>

              {!paymentsUnlocked ? (
                <div className="rounded-lg border border-accent/25 bg-accent/[0.05] p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-purple/15 flex items-center justify-center shrink-0">
                      <Lock className="w-4 h-4 text-purple" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        Get paid directly through your proposals
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                        Upgrade to Pro to collect payments from clients with the Accept &amp; Pay flow — no extra tools needed.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => setPaymentsUpgradeOpen(true)}
                        className="gap-1.5 bg-accent text-accent-foreground font-semibold hover:bg-accent/90"
                      >
                        <Crown className="w-3.5 h-3.5" />
                        Unlock Payments with Pro
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-stretch gap-2 max-w-md">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-muted-foreground pointer-events-none">
                        {proposal.currency === "EUR" ? "€" : proposal.currency === "GBP" ? "£" : "$"}
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={proposal.amount_cents != null ? (proposal.amount_cents / 100).toString() : ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          const cents = v === "" ? null : Math.round(parseFloat(v) * 100);
                          setProposal({ ...proposal, amount_cents: Number.isFinite(cents as number) ? (cents as number) : null });
                        }}
                        onBlur={async () => {
                          const cents = proposal.amount_cents;
                          const { error } = await supabase
                            .from("proposals")
                            .update({ amount_cents: cents, currency: proposal.currency || defaultCurrency })
                            .eq("id", proposal.id);
                          if (error) {
                            toast({ title: "Couldn't save amount", description: error.message, variant: "destructive" });
                          } else {
                            toast({ title: "Amount saved" });
                          }
                        }}
                        className={`h-12 pl-8 text-lg font-semibold ${
                          proposal.amount_cents == null
                            ? "border-amber-500/40 focus-visible:ring-amber-500/30"
                            : ""
                        }`}
                      />
                    </div>
                    <select
                      value={proposal.currency || defaultCurrency}
                      onChange={async (e) => {
                        const currency = e.target.value;
                        setProposal({ ...proposal, currency });
                        await supabase.from("proposals").update({ currency }).eq("id", proposal.id);
                      }}
                      className="h-12 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground"
                    >
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                      <option value="CAD">CAD</option>
                      <option value="AUD">AUD</option>
                    </select>
                  </div>
                  <p className={`text-xs mt-2 ${
                    proposal.amount_cents == null ? "text-amber-500" : "text-muted-foreground"
                  }`}>
                    {clientPaid
                      ? "✓ Paid in full"
                      : proposal.amount_cents
                        ? "This is the amount your client will pay"
                        : "Set a payment amount to enable client payment"}
                  </p>
                </>
              )}
            </div>

            {/* === ACTIONS === */}
            <div className="pt-5 border-t border-border/60">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Actions</p>

              {/* Primary: Send to Client */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="lg"
                    className="w-full sm:w-auto gap-2 bg-accent text-accent-foreground font-semibold hover:bg-accent/90 transition-colors h-11 px-6"
                  >
                    <Send className="w-4 h-4 shrink-0" />
                    Send to Client
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Send proposal</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={sendViaCloseSync}
                    disabled={!clientEmail}
                    className="gap-2"
                  >
                    <Send className="w-4 h-4" /> Email via CloseSync {clientEmail ? "" : "(no client email)"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSendCopy} className="gap-2">
                    <Copy className="w-4 h-4" /> Copy client link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSendEmail} className="gap-2">
                    <Mail className="w-4 h-4" /> Open in mail app {clientEmail ? "" : "(no client email)"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handlePreview} className="gap-2">
                    <ExternalLink className="w-4 h-4" /> Open client preview
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!clientPhone}
                    onClick={() => {
                      const msg = `Hi ${proposal.client_name}, your proposal${proposal.service_type ? ` for ${proposal.service_type}` : ""} is ready. You can review it here:\n${clientUrl}`;
                      const link = waLink(clientPhone, msg);
                      if (link) {
                        window.open(link, "_blank", "noopener,noreferrer");
                      }
                    }}
                    className="gap-2"
                  >
                    <MessageCircle className="w-4 h-4" /> WhatsApp {clientPhone ? "client" : "(no phone)"}
                  </DropdownMenuItem>
                  {currentStatus === "draft" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={markAsSent} className="gap-2">
                        <CheckCircle2 className="w-4 h-4" /> Mark as sent (I sent it myself)
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Secondary actions */}
              <div className="mt-3 flex flex-wrap gap-2">
                {followUpScenario !== "none" && (
                  <Button
                    onClick={() => setFollowUpOpen(true)}
                    size="sm"
                    className="gap-1.5 h-9 bg-amber-500/15 text-amber-500 border border-amber-500/30 hover:bg-amber-500/25"
                  >
                    <Sparkles className="w-3.5 h-3.5 shrink-0" /> Send Follow-Up
                  </Button>
                )}
                <Button onClick={() => handleExportPDF("proposal")} variant="outline" size="sm" className="gap-1.5 h-9">
                  <Download className="w-3.5 h-3.5 shrink-0" /> Export Proposal
                </Button>
                <Button variant="outline" size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 h-9">
                  {saving ? <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" /> : <Save className="w-3.5 h-3.5 shrink-0" />}
                  Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSaveTemplateOpen(true)}
                  className="gap-1.5 h-9"
                  title="Reuse this proposal's setup as a template"
                >
                  <Bookmark className="w-3.5 h-3.5 shrink-0" /> Save as template
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={!!regenerating} className="gap-1.5 h-9">
                      {regenerating === "full" || regenerating === "concise" || regenerating === "persuasive" || regenerating === "alternative" ? (
                        <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      )}
                      Regenerate
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuLabel>AI Variations</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => handleRegenerateFull()} className="gap-2">
                      <RefreshCw className="w-4 h-4" /> Regenerate full proposal
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleRegenerateFull("concise")} className="gap-2">
                      <Zap className="w-4 h-4" /> Make more concise
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleRegenerateFull("persuasive")} className="gap-2">
                      <Wand2 className="w-4 h-4" /> Make more persuasive
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleRegenerateFull("alternative")} className="gap-2">
                      <Sparkles className="w-4 h-4" /> Alternative version
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Tertiary actions */}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 pt-3 border-t border-border/40">
                <button
                  type="button"
                  onClick={handlePreview}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Eye className="w-3 h-3" /> Preview Client View
                </button>
                <button
                  type="button"
                  onClick={handleSendCopy}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Copy className="w-3 h-3" /> Copy Link
                </button>
                <button
                  type="button"
                  onClick={() => handleExportPDF("invoice")}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <FileText className="w-3 h-3" /> Generate Invoice
                </button>
                <button
                  type="button"
                  onClick={handleCopyProposal}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied!" : "Copy Markdown"}
                </button>
              </div>
            </div>
          </div>
        </details>

        <FollowUpStatus
          proposalId={proposal.id}
          clientEmail={clientEmail}
          clientName={proposal.client_name}
          proposal={{
            status: proposal.status,
            client_paid: proposal.client_paid,
            sent_at: proposal.sent_at,
            viewed_at: proposal.viewed_at,
            accepted_at: proposal.accepted_at,
            paid_at: proposal.paid_at,
          }}
        />


        {/* Tabs */}
        <Tabs defaultValue="proposal">

          <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent mb-6">
            {tabs.map((t) => (
              <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((t) => (
            <TabsContent key={t.key} value={t.key} className="mt-0">
              <div className="flex justify-end mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleEdit(t.key)}
                  className="gap-2 text-muted-foreground"
                >
                  {editMode[t.key] ? <><Eye className="w-4 h-4" /> Preview</> : <><Pencil className="w-4 h-4" /> Edit</>}
                </Button>
              </div>
              {editMode[t.key] ? (
                <Textarea
                  value={t.content}
                  onChange={(e) => t.setter(e.target.value)}
                  rows={t.rows}
                  className="font-mono text-sm"
                />
              ) : (
                <>
                  {t.key === "proposal" ? (
                    <div className="relative rounded-2xl border border-border/60 bg-card/40 px-6 sm:px-10 lg:px-14 py-8 lg:py-10 shadow-sm">
                      <ProposalHeader
                        clientName={proposal.client_name}
                        companyName={proposal.company_name}
                        serviceType={proposal.service_type}
                        createdAt={proposal.created_at}
                        branding={ownerBranding}
                      />
                      <MarkdownPreview content={t.rendered} isPremium />
                      {watermark && <ProposalWatermark />}
                    </div>
                  ) : t.key === "pricing" ? (
                    <div className="rounded-2xl border border-border/60 bg-card/40 px-6 sm:px-10 lg:px-14 py-8 lg:py-10 shadow-sm">
                      <PremiumPricingRenderer content={t.rendered} />
                    </div>
                  ) : t.key === "invoice" ? (
                    <div className="rounded-2xl border border-border/60 bg-card/40 px-6 sm:px-10 lg:px-14 py-8 lg:py-10 shadow-sm">
                      <PremiumInvoiceRenderer
                        content={t.rendered}
                        clientName={proposal.client_name}
                        companyName={proposal.company_name}
                      />
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border/60 bg-card/40 px-6 sm:px-10 lg:px-14 py-8 lg:py-10 shadow-sm">
                      <MarkdownPreview content={t.rendered} />
                    </div>
                  )}
                  {t.key === "proposal" && (
                    <div className="mt-6 rounded-xl border border-border/60 bg-card/30 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-3.5 h-3.5 text-accent" />
                        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">Regenerate a section</h3>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Don't love a part? Regenerate just that section — the rest stays untouched.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {SECTION_HEADINGS.map((s) => (
                          <Button
                            key={s}
                            variant="outline"
                            size="sm"
                            disabled={!!regenerating}
                            onClick={() => handleRegenerateSection(s)}
                            className="gap-2 h-8 text-xs"
                          >
                            {regenerating === s ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3" />
                            )}
                            {s}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      {followUpScenario !== "none" && (
        <FollowUpDialog
          open={followUpOpen}
          onOpenChange={setFollowUpOpen}
          scenario={followUpScenario}
          clientEmail={clientEmail}
          templateInput={{
            clientName: proposal.client_name,
            companyName: proposal.company_name,
            serviceType: proposal.service_type,
            proposalUrl: clientUrl,
          }}
        />
      )}
      <TemplateEditorDialog
        open={saveTemplateOpen}
        onOpenChange={setSaveTemplateOpen}
        forceCreate
        initial={{
          name: `${proposal.service_type || "Proposal"} – ${proposal.client_name || "Template"}`,
          description: `Saved from "${proposal.client_name}" proposal.`,
          service_type: proposal.service_type || "",
          project_scope: proposal.project_scope || "",
          budget: proposal.budget || "",
          timeline: proposal.timeline || "",
          notes: proposal.notes || "",
        }}
      />
    </DashboardLayout>
  );
}
