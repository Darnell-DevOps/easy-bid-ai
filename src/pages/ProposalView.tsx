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
import { Download, Save, Loader2, Pencil, Eye, Copy, Check, DollarSign } from "lucide-react";
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

  const [editedProposal, setEditedProposal] = useState("");
  const [editedPricing, setEditedPricing] = useState("");
  const [editedInvoice, setEditedInvoice] = useState("");
  const [copied, setCopied] = useState(false);
  const [clientPaid, setClientPaid] = useState(false);

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
          @page { size: A4; margin: 48px 56px 56px 56px; }
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

          body {
            font-family: 'Inter', -apple-system, sans-serif;
            color: #374151;
            line-height: 1.8;
            font-size: 13px;
            background: #ffffff;
            -webkit-font-smoothing: antialiased;
          }

          /* ═══════════ HERO / COVER ═══════════ */
          .hero {
            padding: 48px 0 40px 0;
            border-bottom: none;
            margin-bottom: 8px;
            position: relative;
          }
          .hero::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, #6c5ce7, #a78bfa, #c4b5fd, transparent);
            border-radius: 4px;
          }
          .hero-brand {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 36px;
          }
          .hero-logo {
            width: 36px;
            height: 36px;
            border-radius: 10px;
          }
          .hero-brand-name {
            font-size: 15px;
            font-weight: 700;
            color: #6c5ce7;
            letter-spacing: -0.3px;
          }
          .hero-title {
            font-size: 38px;
            font-weight: 900;
            color: #111827;
            letter-spacing: -1.5px;
            line-height: 1.1;
            margin-bottom: 16px;
          }
          .hero-meta {
            display: flex;
            gap: 24px;
            flex-wrap: wrap;
          }
          .hero-meta-item {
            font-size: 12px;
            color: #9ca3af;
            font-weight: 500;
          }
          .hero-meta-item span {
            display: block;
            font-size: 14px;
            font-weight: 600;
            color: #374151;
            margin-top: 2px;
          }

          /* ═══════════ SECTIONS ═══════════ */
          .section {
            margin-top: 36px;
            padding: 0;
          }
          .section-title-wrap {
            margin-bottom: 16px;
          }
          h2 {
            font-size: 17px;
            font-weight: 800;
            color: #111827;
            letter-spacing: -0.4px;
            text-transform: uppercase;
            font-size: 12px;
            letter-spacing: 1.2px;
            margin-bottom: 6px;
          }
          .section-accent {
            width: 32px;
            height: 3px;
            background: linear-gradient(90deg, #6c5ce7, #a78bfa);
            border-radius: 2px;
          }
          h3 {
            font-size: 14px;
            font-weight: 700;
            color: #1f2937;
            margin: 20px 0 8px 0;
          }
          p {
            margin: 8px 0;
            color: #4b5563;
            max-width: 60ch;
            font-size: 13px;
          }
          strong { color: #111827; font-weight: 700; }

          /* ═══════════ LISTS ═══════════ */
          ul {
            padding: 0;
            margin: 12px 0;
            list-style: none;
          }
          li {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 8px 0;
            color: #4b5563;
            line-height: 1.6;
            border-bottom: 1px solid #f3f4f6;
          }
          li:last-child { border-bottom: none; }
          .bullet {
            flex-shrink: 0;
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #6c5ce7;
            margin-top: 7px;
          }
          .li-text { flex: 1; }

          /* ═══════════ PRICING ═══════════ */
          .pricing-card {
            margin: 20px 0;
            border: 1.5px solid #e5e7eb;
            border-radius: 12px;
            overflow: hidden;
            background: #fff;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
          }
          td {
            padding: 14px 24px;
            border-bottom: 1px solid #f3f4f6;
            color: #4b5563;
          }
          td.th {
            background: #f9fafb;
            font-weight: 700;
            color: #111827;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            border-bottom: 1.5px solid #e5e7eb;
            padding: 12px 24px;
          }
          .total-row td {
            background: linear-gradient(135deg, #f5f3ff, #ede9fe);
            border-top: 2px solid #6c5ce7;
            border-bottom: none;
            font-weight: 800;
            color: #111827;
            font-size: 15px;
            padding: 18px 24px;
          }
          tr:last-child td:not(.th) {
            border-bottom: none;
          }

          /* ═══════════ NEXT STEPS CTA ═══════════ */
          .section:last-child {
            background: #f5f3ff;
            border: 1.5px solid #ddd6fe;
            border-radius: 12px;
            padding: 28px 32px;
            margin-top: 40px;
          }
          .section:last-child .section-accent {
            background: #6c5ce7;
          }

          /* ═══════════ FOOTER ═══════════ */
          .doc-footer {
            margin-top: 56px;
            padding-top: 20px;
            border-top: 1.5px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 10px;
            color: #9ca3af;
          }
          .footer-brand {
            font-weight: 700;
            color: #6c5ce7;
          }

          /* ═══════════ PRINT ═══════════ */
          @media print {
            body { padding: 0; }
            .hero { break-after: avoid; }
            h2 { break-after: avoid; }
            .pricing-card, table { break-inside: avoid; }
            .section { break-inside: avoid; }
            .section:last-child { break-inside: avoid; }
          }
        </style>
      </head>
      <body>

        <div class="hero">
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

        ${htmlContent}

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
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{proposal.client_name}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {proposal.company_name} · {proposal.service_type} · {new Date(proposal.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
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
        <div className="rounded-xl border border-border bg-card p-5 mb-6">
          <p className="text-xs text-muted-foreground mb-4">Your proposal is ready</p>
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => handleExportPDF("proposal")}
              size="lg"
              className="w-full gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold shadow-lg hover:brightness-110 hover:shadow-purple/30 transition-all h-11"
            >
              <Download className="w-4 h-4" /> Export Proposal
            </Button>
            <div className="grid grid-cols-3 gap-3">
              <Button variant="outline" onClick={handleSave} disabled={saving} className="gap-2 hover:brightness-125 transition-all h-10">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </Button>
              <Button variant="outline" onClick={() => handleExportPDF("invoice")} className="gap-2 hover:brightness-125 transition-all h-10">
                <Download className="w-4 h-4" /> Invoice
              </Button>
              <Button variant="outline" onClick={handleCopyProposal} className="gap-2 hover:brightness-125 transition-all h-10">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy"}
              </Button>
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
                </>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
