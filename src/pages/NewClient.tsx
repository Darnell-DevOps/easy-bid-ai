import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Save } from "lucide-react";

const STATUS_OPTIONS = ["New", "Qualified", "Proposal Sent", "Won", "Lost"];

export default function NewClient() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    service_requested: "",
    project_description: "",
    budget: "",
    timeline: "",
    goals: "",
    status: "New",
  });

  const update = (field: string, value: string) =>
    setForm((p) => ({ ...p, [field]: value }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast({
        title: "Missing required fields",
        description: "Client name and email are required.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("clients")
        .insert({
          user_id: user.id,
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          company: form.company.trim() || null,
          service_requested: form.service_requested.trim() || null,
          project_description: form.project_description.trim() || null,
          budget: form.budget.trim() || null,
          timeline: form.timeline.trim() || null,
          goals: form.goals.trim() || null,
          status: form.status,
        })
        .select("id")
        .single();
      if (error) throw error;
      toast({ title: "Client added", description: `${form.name} has been saved.` });
      navigate(`/dashboard/clients/${data.id}`);
    } catch (err: any) {
      toast({
        title: "Could not save client",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <button
          onClick={() => navigate("/dashboard/clients")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Clients
        </button>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Add New Client</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Capture intake details so you can generate proposals in one click.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* Basic Info */}
          <Card className="glass-card">
            <CardContent className="p-6 space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  Basic Info
                </h2>
                <div className="h-px bg-border mt-2" />
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <Label htmlFor="name">
                    Client Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={form.name}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="John Smith"
                    required
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="email">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                    placeholder="john@company.com"
                    required
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="+1 555 000 0000"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={form.company}
                    onChange={(e) => update("company", e.target.value)}
                    placeholder="Company name"
                    className="mt-2"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Project Details */}
          <Card className="glass-card">
            <CardContent className="p-6 space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  Project Details
                </h2>
                <div className="h-px bg-border mt-2" />
              </div>
              <div>
                <Label htmlFor="service_requested">Service Requested</Label>
                <Input
                  id="service_requested"
                  value={form.service_requested}
                  onChange={(e) => update("service_requested", e.target.value)}
                  placeholder="e.g. Brand Identity, Web Design, SEO…"
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="project_description">Project Description</Label>
                <Textarea
                  id="project_description"
                  value={form.project_description}
                  onChange={(e) => update("project_description", e.target.value)}
                  placeholder="What does the client need? Scope, deliverables, context…"
                  rows={4}
                  className="mt-2"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <Label htmlFor="budget">Budget</Label>
                  <Input
                    id="budget"
                    value={form.budget}
                    onChange={(e) => update("budget", e.target.value)}
                    placeholder="e.g. $5,000"
                    className="mt-2"
                  />
                </div>
                <div>
                  <Label htmlFor="timeline">Timeline / Deadline</Label>
                  <TimelineInput
                    value={form.timeline}
                    onChange={(v) => update("timeline", v)}
                  />
                </div>

              </div>
            </CardContent>
          </Card>

          {/* Goals */}
          <Card className="glass-card">
            <CardContent className="p-6 space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  Goals
                </h2>
                <div className="h-px bg-border mt-2" />
              </div>
              <div>
                <Label htmlFor="goals">What is the client trying to achieve?</Label>
                <Textarea
                  id="goals"
                  value={form.goals}
                  onChange={(e) => update("goals", e.target.value)}
                  placeholder="Outcomes, KPIs, the bigger picture…"
                  rows={4}
                  className="mt-2"
                />
              </div>
            </CardContent>
          </Card>

          {/* Internal */}
          <Card className="glass-card">
            <CardContent className="p-6 space-y-5">
              <div>
                <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                  Internal
                </h2>
                <div className="h-px bg-border mt-2" />
              </div>
              <div className="md:w-1/2">
                <Label htmlFor="status">Status</Label>
                <Select value={form.status} onValueChange={(v) => update("status", v)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/dashboard/clients")}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-gradient-to-r from-accent to-purple text-accent-foreground hover:opacity-90 gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Client
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
