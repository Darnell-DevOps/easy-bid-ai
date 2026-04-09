import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Download, Save, Loader2 } from "lucide-react";

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

export default function ProposalView() {
  const { id } = useParams();
  const { toast } = useToast();
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editedProposal, setEditedProposal] = useState("");
  const [editedPricing, setEditedPricing] = useState("");
  const [editedInvoice, setEditedInvoice] = useState("");

  useEffect(() => {
    const fetch = async () => {
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
    fetch();
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

  const handleExportPDF = async (type: "proposal" | "invoice") => {
    const content = type === "proposal" ? editedProposal + "\n\n" + editedPricing : editedInvoice;
    const title = type === "proposal"
      ? `Proposal - ${proposal?.client_name}`
      : `Invoice - ${proposal?.client_name}`;

    // Simple browser print-to-PDF approach
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: 'Inter', system-ui, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1a1a2e; line-height: 1.6; }
          h1, h2, h3 { color: #1a1a2e; }
          pre { white-space: pre-wrap; font-family: inherit; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <p style="color:#666; font-size:14px;">${proposal?.company_name} · ${proposal?.service_type} · ${new Date(proposal?.created_at || "").toLocaleDateString()}</p>
        <hr style="border:none;border-top:1px solid #e5e5e5;margin:20px 0;" />
        <pre>${content}</pre>
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

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{proposal.client_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {proposal.company_name} · {proposal.service_type} · {new Date(proposal.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </Button>
          <Button variant="outline" onClick={() => handleExportPDF("proposal")} className="gap-2">
            <Download className="w-4 h-4" /> Export Proposal
          </Button>
          <Button variant="outline" onClick={() => handleExportPDF("invoice")} className="gap-2">
            <Download className="w-4 h-4" /> Export Invoice
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Tabs defaultValue="proposal">
            <TabsList className="w-full justify-start border-b border-border rounded-none bg-transparent px-6 pt-4">
              <TabsTrigger value="proposal">Proposal</TabsTrigger>
              <TabsTrigger value="pricing">Pricing</TabsTrigger>
              <TabsTrigger value="invoice">Invoice</TabsTrigger>
            </TabsList>
            <div className="p-6">
              <TabsContent value="proposal" className="mt-0">
                <Textarea
                  value={editedProposal}
                  onChange={(e) => setEditedProposal(e.target.value)}
                  rows={20}
                  className="font-mono text-sm"
                />
              </TabsContent>
              <TabsContent value="pricing" className="mt-0">
                <Textarea
                  value={editedPricing}
                  onChange={(e) => setEditedPricing(e.target.value)}
                  rows={15}
                  className="font-mono text-sm"
                />
              </TabsContent>
              <TabsContent value="invoice" className="mt-0">
                <Textarea
                  value={editedInvoice}
                  onChange={(e) => setEditedInvoice(e.target.value)}
                  rows={15}
                  className="font-mono text-sm"
                />
              </TabsContent>
            </div>
          </Tabs>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
