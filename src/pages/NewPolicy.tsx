import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, AlertTriangle, ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";

const POLICY_TYPES = ["Terms & Conditions", "Privacy Policy", "Refund Policy"];
const BUSINESS_TYPES = [
  "Freelancer",
  "Agency",
  "E-commerce",
  "Clinic",
  "SaaS",
  "Consultant",
  "Restaurant",
  "Other",
];

export default function NewPolicy() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState({
    business_name: "",
    business_type: "Freelancer",
    country: "",
    policy_type: searchParams.get("type") ?? "",
    services_offered: "",
    payment_methods: "",
    refund_rules: "",
    data_collection: "",
    special_requirements: "",
  });

  useEffect(() => {
    const t = searchParams.get("type");
    if (t && POLICY_TYPES.includes(t)) {
      setForm((f) => ({ ...f, policy_type: t }));
    }
  }, [searchParams]);

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleGenerate = async () => {
    if (!form.business_name || !form.business_type || !form.country || !form.policy_type) {
      toast({
        title: "Please fill in business name, type, country and policy type.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-policy", { body: form });
      if (error) throw error;
      const content = (data as { content?: string })?.content;
      if (!content) throw new Error("No content returned");

      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const { data: inserted, error: insertErr } = await supabase
        .from("policies")
        .insert({ ...form, content, user_id: userId })
        .select("id")
        .single();
      if (insertErr) throw insertErr;

      toast({ title: "Policy generated" });
      navigate(`/dashboard/policies/${inserted.id}`);
    } catch (e: any) {
      toast({
        title: e?.message ?? "Failed to generate policy",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/policies")} className="mb-4">
        <ArrowLeft aria-hidden="true" className="w-4 h-4 mr-2" /> Back to policies
      </Button>

      <h1 className="type-page-title mb-2">
        Generate {form.policy_type || "policy"} in seconds
      </h1>
      <p className="text-muted-foreground mb-6">
        Just tell us the basics — AI handles the rest.
      </p>

      <Alert className="mb-6 border-destructive/30 bg-destructive/5">
        <AlertTriangle aria-hidden="true" className="h-4 w-4 text-destructive" />
        <AlertDescription className="text-sm">
          AI-generated policies should be reviewed by a qualified legal professional before use.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">The essentials</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {!searchParams.get("type") && (
              <div className="space-y-2">
                <Label htmlFor="policy-type">
                  Policy Type
                  <span aria-hidden="true"> *</span>
                  <span className="sr-only"> (required)</span>
                </Label>
                <Select value={form.policy_type} onValueChange={(v) => update("policy_type", v)}>
                  <SelectTrigger id="policy-type" aria-required="true">
                    <SelectValue placeholder="Select policy" />
                  </SelectTrigger>
                  <SelectContent>
                    {POLICY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="policy-business-name">
                Business Name
                <span aria-hidden="true"> *</span>
                <span className="sr-only"> (required)</span>
              </Label>
              <Input
                id="policy-business-name"
                value={form.business_name}
                onChange={(e) => update("business_name", e.target.value)}
                placeholder="Acme Studio"
                maxLength={120}
                autoComplete="organization"
                aria-required="true"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy-country">
                Country
                <span aria-hidden="true"> *</span>
                <span className="sr-only"> (required)</span>
              </Label>
              <Input
                id="policy-country"
                value={form.country}
                onChange={(e) => update("country", e.target.value)}
                placeholder="United Kingdom"
                maxLength={80}
                autoComplete="country-name"
                aria-required="true"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="policy-services">
                Services / What you sell
                <span aria-hidden="true"> *</span>
                <span className="sr-only"> (required)</span>
              </Label>
              <Textarea
                id="policy-services"
                value={form.services_offered}
                onChange={(e) => update("services_offered", e.target.value)}
                placeholder="Branding, web design, ongoing support…"
                maxLength={2000}
                rows={3}
                aria-required="true"
              />
            </div>
          </CardContent>
        </Card>

        <button
          type="button"
          onClick={() => setShowAdvanced((s) => !s)}
          aria-expanded={showAdvanced}
          aria-controls="policy-optional-details"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors self-start"
        >
          {showAdvanced ? <ChevronUp aria-hidden="true" className="w-4 h-4" /> : <ChevronDown aria-hidden="true" className="w-4 h-4" />}
          {showAdvanced ? "Hide" : "Add"} optional details (business type, refund rules, data collected)
        </button>

        {showAdvanced && (
          <Card id="policy-optional-details">
            <CardHeader>
              <CardTitle className="text-base">Optional details</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="policy-business-type">Business Type</Label>
                  <Select value={form.business_type} onValueChange={(v) => update("business_type", v)}>
                    <SelectTrigger id="policy-business-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUSINESS_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="policy-payment-methods">Payment Methods</Label>
                  <Input
                    id="policy-payment-methods"
                    value={form.payment_methods}
                    onChange={(e) => update("payment_methods", e.target.value)}
                    placeholder="Stripe, bank transfer"
                    maxLength={200}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="policy-refund-rules">Refund Rules</Label>
                <Input
                  id="policy-refund-rules"
                  value={form.refund_rules}
                  onChange={(e) => update("refund_rules", e.target.value)}
                  placeholder="14-day refund window"
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="policy-data-collected">Data Collected</Label>
                <Textarea
                  id="policy-data-collected"
                  value={form.data_collection}
                  onChange={(e) => update("data_collection", e.target.value)}
                  placeholder="Name, email, payment info, analytics cookies…"
                  maxLength={1000}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="policy-special-requirements">Special Requirements</Label>
                <Textarea
                  id="policy-special-requirements"
                  value={form.special_requirements}
                  onChange={(e) => update("special_requirements", e.target.value)}
                  placeholder="Anything unique we should include…"
                  maxLength={1000}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end">
          <Button onClick={handleGenerate} disabled={loading} aria-busy={loading} size="lg">
            <Sparkles aria-hidden="true" className="w-4 h-4 mr-2" />
            {loading ? "Generating…" : "Generate Policy"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
