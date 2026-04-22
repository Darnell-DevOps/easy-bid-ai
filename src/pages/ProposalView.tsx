import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, Save, Loader2, Pencil, Eye, Copy, Check, DollarSign, Sparkles, RefreshCw, Wand2, Zap } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import ReactMarkdown from "react-markdown";
import PremiumProposalRenderer from "@/components/proposal/PremiumProposalRenderer";
import ProposalHeader from "@/components/proposal/ProposalHeader";

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
}

const SECTION_HEADINGS = [
  "Introduction",
  "Understanding of Your Needs",
  "Proposed Solution",
  "Scope of Work",
  "Deliverables",
  "Timeline",
  "Expected Outcomes",
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
  const { toast } = useToast();
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState<Record<string, boolean>>({});
  const [regenerating, setRegenerating] = useState<string | null>(null);

  const [editedProposal, setEditedProposal] = useState("");
  const [editedPricing, setEditedPricing] = useState("");
  const [editedInvoice, setEditedInvoice] = useState("");
  const [copied, setCopied] = useState(false);
  const [clientPaid, setClientPaid] = useState(false);

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
    };
  };

  const handleRegenerateFull = async (tone?: "concise" | "persuasive" | "alternative") => {
    const source = buildSourcePayload();
    if (!source) return;
    const key = tone || "full";
    setRegenerating(key);
    try {
      const { data, error } = await supabase.functions.invoke("generate-proposal", {
        body: { ...source, tone },
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

  const LOGO_BASE64 = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCIgdmlld0JveD0iMCAwIDgwIDgwIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZyIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM2YzVjZTciLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojYTI5YmZlIi8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iODAiIGhlaWdodD0iODAiIHJ4PSIxNiIgZmlsbD0idXJsKCNnKSIvPgogIDx0ZXh0IHg9IjQwIiB5PSI1MiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtd2VpZ2h0PSI3MDAiIGZvbnQtc2l6ZT0iMzYiIGZpbGw9IndoaXRlIj5DUzwvdGV4dD4KPC9zdmc+";

  const handleExportPDF = (type: "proposal" | "invoice") => {
    const content = type === "proposal" ? editedProposal + "\n\n---\n\n" + editedPricing : editedInvoice;
    const docTitle = type === "proposal" ? "Project Proposal" : "Invoice";
    const title = type === "proposal"
      ? `Proposal - ${proposal?.client_name}`
      : `Invoice - ${proposal?.client_name}`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // Convert markdown to structured HTML
    let htmlContent = content
      .replace(/^## (.+)$/gm, '</div><div class="section"><div class="section-title-wrap"><h2>$1</h2><div class="section-accent"></div></div>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<li><span class="bullet"></span><span class="li-text">$1</span></li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/\|(.+)\|/g, (match) => {
        const cells = match.split('|').filter(Boolean).map(c => c.trim());
        if (cells.every(c => /^[-:]+$/.test(c))) return '';
        return '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
      })
      .replace(/(<tr>.*<\/tr>\n?)+/g, '<div class="pricing-card"><table><tbody>$&</tbody></table></div>')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/^(?!<[hultdops])(.+)$/gm, '<p>$1</p>')
      .replace(/---/g, '');

    // Style table header and total rows
    htmlContent = htmlContent.replace(
      /<tbody>([\s\S]*?)<\/tbody>/g,
      (match) => {
        const rows = match.match(/<tr>[\s\S]*?<\/tr>/g);
        if (!rows || rows.length < 2) return match;
        const firstRow = rows[0];
        const headerRow = firstRow.replace(/<td>/g, '<td class="th">');
        let result = match.replace(firstRow, headerRow);
        const lastRow = rows[rows.length - 1];
        const totalRow = lastRow.replace(/<tr>/, '<tr class="total-row">');
        result = result.replace(lastRow, totalRow);
        return result;
      }
    );

    // Remove leading empty div
    htmlContent = htmlContent.replace(/^<\/div>/, '');
    htmlContent += '</div>';

    const dateStr = new Date(proposal?.created_at || '').toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          @page { size: A4; margin: 0; }
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

          body {
            font-family: 'Inter', -apple-system, sans-serif;
            color: #cbd5e1;
            line-height: 1.75;
            font-size: 14px;
            background: #0a0e1a;
            -webkit-font-smoothing: antialiased;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .page-wrap {
            max-width: 760px;
            margin: 0 auto;
            padding: 48px 40px 0 40px;
          }

          /* ═══════════ HERO / COVER ═══════════ */
          .hero {
            background: linear-gradient(160deg, #0f172a 0%, #1a1340 40%, #0f172a 100%);
            padding: 64px 0 56px 0;
            position: relative;
            overflow: hidden;
          }
          .hero-inner {
            max-width: 760px;
            margin: 0 auto;
            padding: 0 40px;
            position: relative;
            z-index: 1;
          }
          .hero::before {
            content: '';
            position: absolute;
            top: -40%;
            right: -10%;
            width: 500px;
            height: 500px;
            background: radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%);
            pointer-events: none;
          }
          .hero::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 2px;
            background: linear-gradient(90deg, transparent 10%, #6c5ce7 30%, #a78bfa 50%, #6c5ce7 70%, transparent 90%);
          }
          .hero-brand {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 48px;
          }
          .hero-logo {
            width: 32px;
            height: 32px;
            border-radius: 8px;
          }
          .hero-brand-name {
            font-size: 13px;
            font-weight: 700;
            color: #a78bfa;
            letter-spacing: 0.3px;
          }
          .hero-title {
            font-size: 40px;
            font-weight: 900;
            color: #f8fafc;
            letter-spacing: -1.5px;
            line-height: 1.1;
            margin-bottom: 28px;
          }
          .hero-meta {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 24px;
          }
          .hero-meta-item {
            font-size: 10px;
            color: #64748b;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .hero-meta-item span {
            display: block;
            font-size: 15px;
            font-weight: 600;
            color: #e2e8f0;
            margin-top: 6px;
            text-transform: none;
            letter-spacing: -0.2px;
          }

          /* ═══════════ SECTIONS ═══════════ */
          .section {
            margin-top: 40px;
            padding: 0 0 32px 0;
            border-bottom: 1px solid rgba(148, 163, 184, 0.08);
          }
          .section:last-of-type {
            border-bottom: none;
            margin-top: 40px;
            padding: 32px;
            background: linear-gradient(135deg, rgba(139,92,246,0.08), rgba(99,102,241,0.04));
            border: 1px solid rgba(139, 92, 246, 0.2);
            border-radius: 12px;
          }
          .section-title-wrap {
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 2px solid rgba(139,92,246,0.2);
            display: inline-block;
          }
          h2 {
            font-size: 12px;
            font-weight: 800;
            color: #a78bfa;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin: 0;
          }
          .section-accent {
            display: none;
          }
          h3 {
            font-size: 16px;
            font-weight: 700;
            color: #e2e8f0;
            margin: 24px 0 8px 0;
          }
          p {
            margin: 10px 0;
            color: #94a3b8;
            font-size: 14px;
            line-height: 1.75;
          }
          strong { color: #e2e8f0; font-weight: 600; }

          /* ═══════════ LISTS ═══════════ */
          ul {
            padding: 0;
            margin: 16px 0;
            list-style: none;
          }
          li {
            display: flex;
            align-items: flex-start;
            gap: 14px;
            padding: 12px 0;
            color: #94a3b8;
            line-height: 1.65;
            border-bottom: 1px solid rgba(148, 163, 184, 0.06);
            font-size: 14px;
          }
          li:last-child { border-bottom: none; }
          .bullet {
            flex-shrink: 0;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #a78bfa;
            margin-top: 8px;
          }
          .li-text { flex: 1; }

          /* ═══════════ PRICING ═══════════ */
          .pricing-card {
            margin: 20px 0;
            border: 1px solid rgba(139, 92, 246, 0.15);
            border-radius: 10px;
            overflow: hidden;
            background: rgba(15, 23, 42, 0.4);
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
          }
          td {
            padding: 14px 28px;
            border-bottom: 1px solid rgba(148, 163, 184, 0.06);
            color: #94a3b8;
          }
          td.th {
            background: rgba(139, 92, 246, 0.06);
            font-weight: 700;
            color: #a78bfa;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            border-bottom: 1px solid rgba(139, 92, 246, 0.12);
            padding: 12px 28px;
          }
          .total-row td {
            background: linear-gradient(135deg, rgba(139,92,246,0.12), rgba(99,102,241,0.08));
            border-top: 2px solid rgba(139, 92, 246, 0.3);
            border-bottom: none;
            font-weight: 800;
            color: #f1f5f9;
            font-size: 16px;
            padding: 20px 28px;
          }
          tr:last-child td:not(.th) {
            border-bottom: none;
          }

          /* ═══════════ FOOTER ═══════════ */
          .doc-footer {
            max-width: 760px;
            margin: 56px auto 40px auto;
            padding: 20px 40px 0 40px;
            border-top: 1px solid rgba(148, 163, 184, 0.08);
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
            color: #475569;
          }
          .footer-brand {
            font-weight: 700;
            color: #a78bfa;
          }

          /* ═══════════ PRINT ═══════════ */
          @media print {
            body { padding: 0; background: #0a0e1a; }
            .hero { break-after: avoid; }
            h2 { break-after: avoid; }
            .pricing-card, table { break-inside: avoid; }
            .section { break-inside: avoid; }
          }
        </style>
      </head>
      <body>

        <div class="hero">
          <div class="hero-inner">
            <div class="hero-brand">
              <img src="${LOGO_BASE64}" alt="CloseSync AI" class="hero-logo" />
              <div class="hero-brand-name">CloseSync AI</div>
            </div>
            <div class="hero-title">${docTitle}</div>
            <div class="hero-meta">
              <div class="hero-meta-item">Prepared for<span>${proposal?.client_name}</span></div>
              <div class="hero-meta-item">Company<span>${proposal?.company_name}</span></div>
              <div class="hero-meta-item">Service<span>${proposal?.service_type}</span></div>
              <div class="hero-meta-item">Date<span>${dateStr}</span></div>
            </div>
          </div>
        </div>

        <div class="page-wrap">
          ${htmlContent}
        </div>

        <div class="doc-footer">
          <div>Prepared by <span class="footer-brand">CloseSync AI</span></div>
          <div>Confidential · All rights reserved</div>
        </div>

      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
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

  const tabs = [
    { key: "proposal", label: "Proposal", content: editedProposal, setter: setEditedProposal, rows: 24 },
    { key: "pricing", label: "Pricing", content: editedPricing, setter: setEditedPricing, rows: 16 },
    { key: "invoice", label: "Invoice", content: editedInvoice, setter: setEditedInvoice, rows: 16 },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-2 sm:px-4 lg:px-8">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">{proposal.client_name}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {proposal.company_name} · {proposal.service_type} · {new Date(proposal.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border shrink-0">
              <DollarSign className={`w-4 h-4 ${clientPaid ? "text-emerald-400" : "text-muted-foreground"}`} />
              <Label htmlFor="client-paid" className="text-sm font-medium text-foreground cursor-pointer">
                Client Paid
              </Label>
              <Switch
                id="client-paid"
                checked={clientPaid}
                onCheckedChange={async (checked) => {
                  setClientPaid(checked);
                  const { error } = await supabase
                    .from("proposals")
                    .update({ client_paid: checked })
                    .eq("id", id);
                  if (error) {
                    setClientPaid(!checked);
                    toast({ title: "Failed to update", description: error.message, variant: "destructive" });
                  } else {
                    toast({ title: checked ? "Marked as paid" : "Marked as unpaid" });
                  }
                }}
              />
            </div>
          </div>
        </div>

        {/* Action bar */}
        <div className="rounded-xl border border-border bg-card p-5 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <p className="text-xs text-muted-foreground">Your proposal is ready</p>
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <Button
                onClick={() => handleExportPDF("proposal")}
                size="lg"
                className="gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold shadow-lg hover:brightness-110 hover:shadow-purple/30 transition-all h-11 sm:flex-1 lg:flex-none lg:px-8"
              >
                <Download className="w-4 h-4" /> Export Proposal
              </Button>
              <div className="flex gap-3 sm:flex-1 lg:flex-none">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" disabled={!!regenerating} className="gap-2 hover:brightness-125 transition-all h-10 flex-1 lg:px-6">
                      {regenerating === "full" || regenerating === "concise" || regenerating === "persuasive" || regenerating === "alternative" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      Regenerate
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
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
                <Button variant="outline" onClick={handleSave} disabled={saving} className="gap-2 hover:brightness-125 transition-all h-10 flex-1 lg:px-6">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </Button>
                <Button variant="outline" onClick={() => handleExportPDF("invoice")} className="gap-2 hover:brightness-125 transition-all h-10 flex-1 lg:px-6">
                  <Download className="w-4 h-4" /> Invoice
                </Button>
                <Button variant="outline" onClick={handleCopyProposal} className="gap-2 hover:brightness-125 transition-all h-10 flex-1 lg:px-6">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
          </div>
        </div>

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
                  {t.key === "proposal" && !editMode[t.key] && (
                    <ProposalHeader
                      clientName={proposal.client_name}
                      companyName={proposal.company_name}
                      serviceType={proposal.service_type}
                      createdAt={proposal.created_at}
                    />
                  )}
                  <div className={t.key === "proposal" ? "mt-6" : ""}>
                    <MarkdownPreview content={t.content} isPremium={t.key === "proposal"} />
                  </div>
                  {t.key === "proposal" && (
                    <div className="mt-8 rounded-xl border border-border bg-card/50 p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-accent" />
                        <h3 className="text-sm font-semibold text-foreground">Regenerate a section</h3>
                      </div>
                      <p className="text-xs text-muted-foreground mb-4">
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
    </DashboardLayout>
  );
}
