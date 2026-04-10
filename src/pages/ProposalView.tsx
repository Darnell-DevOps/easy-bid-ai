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

  const handleExportPDF = (type: "proposal" | "invoice") => {
    const content = type === "proposal" ? editedProposal + "\n\n---\n\n" + editedPricing : editedInvoice;
    const title = type === "proposal"
      ? `Proposal - ${proposal?.client_name}`
      : `Invoice - ${proposal?.client_name}`;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    // Convert markdown to simple HTML for print
    const htmlContent = content
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^\*\*(.+?)\*\*/gm, '<strong>$1</strong>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/\|(.+)\|/g, (match) => {
        const cells = match.split('|').filter(Boolean).map(c => c.trim());
        return '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
      })
      .replace(/(<tr>.*<\/tr>\n?)+/g, '<table>$&</table>')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/^(?!<[hultop])(.+)$/gm, '<p>$1</p>')
      .replace(/---/g, '<hr />');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: 'Inter', system-ui, sans-serif; max-width: 750px; margin: 40px auto; padding: 0 32px; color: #1a1a2e; line-height: 1.7; font-size: 14px; }
          h2 { color: #1a1a2e; font-size: 18px; margin-top: 28px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e5e5e5; }
          h3 { color: #1a1a2e; font-size: 15px; margin-top: 20px; }
          p { margin: 8px 0; }
          ul { padding-left: 24px; margin: 8px 0; }
          li { margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
          th, td { padding: 8px 12px; border: 1px solid #e5e5e5; text-align: left; }
          th { background: #f5f5f5; font-weight: 600; }
          hr { border: none; border-top: 1px solid #e5e5e5; margin: 24px 0; }
          strong { color: #1a1a2e; }
        </style>
      </head>
      <body>
        ${htmlContent}
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
