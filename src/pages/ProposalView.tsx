import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, Save, Loader2, Pencil, Eye, Copy, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ProposalData {
  id: string;
  client_name: string;
  company_name: string;
  service_type: string;
  proposal_content: string;
  pricing_breakdown: string;
  invoice_content: string;
  created_at: string;
}

function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="proposal-preview prose prose-invert prose-base max-w-none
      prose-headings:font-bold prose-headings:tracking-tight prose-headings:leading-snug
      prose-h1:text-2xl prose-h1:mt-10 prose-h1:mb-4
      prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:pb-3 prose-h2:border-b prose-h2:border-purple/20
      prose-h3:text-lg prose-h3:mt-8 prose-h3:mb-3
      prose-p:text-muted-foreground prose-p:leading-[1.85] prose-p:mb-4 prose-p:max-w-[65ch]
      prose-li:text-muted-foreground prose-li:leading-[1.85] prose-li:mb-1
      prose-ul:my-4 prose-ol:my-4
      prose-strong:font-semibold
      prose-hr:border-purple/15 prose-hr:my-8
      prose-table:text-sm prose-table:my-6
      prose-th:text-foreground prose-th:font-semibold prose-th:px-5 prose-th:py-3 prose-th:text-left prose-th:border-b prose-th:border-purple/20 prose-th:bg-purple/5
      prose-td:text-muted-foreground prose-td:px-5 prose-td:py-3 prose-td:border-b prose-td:border-border/60
      prose-a:text-purple prose-a:no-underline hover:prose-a:underline
      prose-blockquote:border-l-purple/40 prose-blockquote:text-muted-foreground prose-blockquote:italic
    ">
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

  const LOGO_BASE64 = "data:image/png;base64,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";

  const handleExportPDF = (type: "proposal" | "invoice") => {
    const content = type === "proposal" ? editedProposal + "\n\n---\n\n" + editedPricing : editedInvoice;
    const docTitle = type === "proposal" ? "Project Proposal" : "Invoice";
    const title = type === "proposal"
      ? `Proposal - ${proposal?.client_name}`
      : `Invoice - ${proposal?.client_name}`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // Convert markdown to HTML
    let htmlContent = content
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^\*\*(.+?)\*\*/gm, '<strong>$1</strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/\|(.+)\|/g, (match) => {
        const cells = match.split('|').filter(Boolean).map(c => c.trim());
        if (cells.every(c => /^[-:]+$/.test(c))) return '';
        const isHeader = cells.some(c => /^[-:]+$/.test(c));
        if (isHeader) return '';
        return '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
      })
      .replace(/(<tr>.*<\/tr>\n?)+/g, '<table><tbody>$&</tbody></table>')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/^(?!<[hultop])(.+)$/gm, '<p>$1</p>')
      .replace(/---/g, '<hr />');

    // Bold the last row of each table (total row)
    htmlContent = htmlContent.replace(
      /<tbody>([\s\S]*?)<\/tbody>/g,
      (match) => {
        const rows = match.match(/<tr>[\s\S]*?<\/tr>/g);
        if (!rows || rows.length < 2) return match;
        const lastRow = rows[rows.length - 1];
        const boldedRow = lastRow.replace(/<td>/g, '<td class="total-row">');
        return match.replace(lastRow, boldedRow);
      }
    );

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
        <style>
          @page { margin: 48px 56px; }
          * { box-sizing: border-box; }
          body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            max-width: 100%;
            margin: 0;
            padding: 0;
            color: #2d2d3a;
            line-height: 1.8;
            font-size: 13.5px;
            -webkit-font-smoothing: antialiased;
          }

          /* Header */
          .doc-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 20px;
            border-bottom: 2px solid #6c5ce7;
            margin-bottom: 8px;
          }
          .doc-header .brand-group {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .doc-header .logo {
            width: 36px;
            height: 36px;
          }
          .doc-header .brand {
            font-size: 18px;
            font-weight: 700;
            color: #6c5ce7;
            letter-spacing: -0.3px;
          }
          .doc-header .brand span {
            font-weight: 400;
            color: #8b8ba3;
          }
          .doc-header .meta {
            text-align: right;
            font-size: 11px;
            color: #8b8ba3;
            line-height: 1.6;
          }

          /* Title */
          .doc-title {
            font-size: 28px;
            font-weight: 700;
            color: #1a1a2e;
            margin: 32px 0 4px 0;
            letter-spacing: -0.5px;
          }
          .doc-subtitle {
            font-size: 14px;
            color: #8b8ba3;
            margin: 0 0 32px 0;
            font-weight: 400;
          }

          /* Section headings */
          h2 {
            font-size: 17px;
            font-weight: 700;
            color: #1a1a2e;
            margin: 36px 0 12px 0;
            padding-bottom: 10px;
            border-bottom: 1px solid #e8e8f0;
            letter-spacing: -0.2px;
          }
          h3 {
            font-size: 14.5px;
            font-weight: 600;
            color: #2d2d3a;
            margin: 28px 0 10px 0;
          }

          /* Body */
          p { margin: 10px 0; color: #4a4a5a; }
          ul { padding-left: 20px; margin: 12px 0; }
          li { margin: 6px 0; color: #4a4a5a; }
          li::marker { color: #6c5ce7; }
          strong { color: #1a1a2e; font-weight: 600; }

          /* Table */
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 13px;
          }
          tr:first-child td {
            background: #f8f8fc;
            font-weight: 600;
            color: #1a1a2e;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
          }
          td {
            padding: 11px 16px;
            border-bottom: 1px solid #ececf4;
            color: #4a4a5a;
            vertical-align: top;
          }
          td.total-row {
            font-weight: 700;
            color: #1a1a2e;
            border-top: 2px solid #6c5ce7;
            background: #f8f7ff;
            font-size: 14px;
          }

          /* Dividers */
          hr {
            border: none;
            border-top: 1px solid #ececf4;
            margin: 32px 0;
          }

          /* Footer */
          .doc-footer {
            margin-top: 48px;
            padding-top: 16px;
            border-top: 1px solid #ececf4;
            font-size: 11px;
            color: #a0a0b8;
            text-align: center;
          }

          @media print {
            body { padding: 0; }
            .doc-header { break-inside: avoid; }
            h2, h3 { break-after: avoid; }
            table { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="doc-header">
          <div class="brand">CloseSync <span>AI</span></div>
          <div class="meta">
            Prepared for: ${proposal?.client_name}<br>
            ${proposal?.company_name}<br>
            ${new Date(proposal?.created_at || '').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>

        <div class="doc-title">${docTitle}</div>
        <div class="doc-subtitle">${proposal?.service_type} · ${proposal?.company_name}</div>

        ${htmlContent}

        <div class="doc-footer">
          Generated by CloseSync AI · Confidential
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{proposal.client_name}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {proposal.company_name} · {proposal.service_type} · {new Date(proposal.created_at).toLocaleDateString()}
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="px-6 pt-4 pb-3 border-b border-border bg-secondary/30">
            <p className="text-xs text-muted-foreground mb-3">Your proposal is ready</p>
            <div className="flex items-center gap-3 flex-wrap">
            <Button
              onClick={() => handleExportPDF("proposal")}
              size="lg"
              className="gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold shadow-lg hover:brightness-110 hover:shadow-purple/30 transition-all"
            >
              <Download className="w-4 h-4" /> Export Proposal
            </Button>
            <Button variant="outline" onClick={handleSave} disabled={saving} className="gap-2 hover:brightness-125 transition-all">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save
            </Button>
            <Button variant="outline" onClick={() => handleExportPDF("invoice")} className="gap-2 hover:brightness-125 transition-all">
              <Download className="w-4 h-4" /> Export Invoice
            </Button>
            <Button variant="outline" onClick={handleCopyProposal} className="gap-2 hover:brightness-125 transition-all">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy Proposal"}
            </Button>
            </div>
          </div>
          <Tabs defaultValue="proposal">
            <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent px-6 pt-4">
              {tabs.map((t) => (
                <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
              ))}
            </TabsList>
            <div className="p-6">
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
                    <MarkdownPreview content={t.content} />
                  )}
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
