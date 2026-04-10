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

  const LOGO_BASE64 = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCIgdmlld0JveD0iMCAwIDgwIDgwIj4KICA8ZGVmcz4KICAgIDxsaW5lYXJHcmFkaWVudCBpZD0iZyIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+CiAgICAgIDxzdG9wIG9mZnNldD0iMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM2YzVjZTciLz4KICAgICAgPHN0b3Agb2Zmc2V0PSIxMDAlIiBzdHlsZT0ic3RvcC1jb2xvcjojYTI5YmZlIi8+CiAgICA8L2xpbmVhckdyYWRpZW50PgogIDwvZGVmcz4KICA8cmVjdCB3aWR0aD0iODAiIGhlaWdodD0iODAiIHJ4PSIxNiIgZmlsbD0idXJsKCNnKSIvPgogIDx0ZXh0IHg9IjQwIiB5PSI1MiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZm9udC1mYW1pbHk9IkFyaWFsLHNhbnMtc2VyaWYiIGZvbnQtd2VpZ2h0PSI3MDAiIGZvbnQtc2l6ZT0iMzYiIGZpbGw9IndoaXRlIj5DUzwvdGV4dD4KPC9zdmc+";

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
            padding-bottom: 24px;
            border-bottom: 2px solid #6c5ce7;
            margin-bottom: 24px;
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
          <div class="brand-group">
            <img src="${LOGO_BASE64}" alt="CloseSync AI" class="logo" />
            <div class="brand">CloseSync <span>AI</span></div>
          </div>
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
          <div className="px-6 py-5 border-b border-border bg-secondary/30">
            <p className="text-xs text-muted-foreground mb-4">Your proposal is ready</p>
            <div className="flex flex-col gap-3">
              <Button
                onClick={() => handleExportPDF("proposal")}
                size="lg"
                className="w-full gap-2 bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold shadow-lg hover:brightness-110 hover:shadow-purple/30 transition-all h-11"
              >
                <Download className="w-4 h-4" /> Export Proposal
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={handleSave} disabled={saving} className="gap-2 hover:brightness-125 transition-all h-10">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </Button>
                <Button variant="outline" onClick={() => handleExportPDF("invoice")} className="gap-2 hover:brightness-125 transition-all h-10">
                  <Download className="w-4 h-4" /> Export Invoice
                </Button>
              </div>
              <Button variant="outline" onClick={handleCopyProposal} className="w-full gap-2 hover:brightness-125 transition-all h-10">
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
