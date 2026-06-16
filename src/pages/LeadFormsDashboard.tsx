import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, Copy, ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";

interface LeadForm {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  submission_count: number;
  view_count: number;
  created_at: string;
}

export default function LeadFormsDashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("lead_forms" as any)
      .select("id, name, slug, is_active, submission_count, view_count, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setForms((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const slug = "lf-" + Math.random().toString(36).slice(2, 10);
      const { data, error } = await supabase
        .from("lead_forms" as any)
        .insert({
          user_id: user.id,
          name: "New lead form",
          slug,
          title: "Get in touch",
          description: "Tell us about your project and we'll be in touch within one business day.",
          fields: [
            { id: "name", label: "Your name", type: "short_text", required: true, group: "Contact" },
            { id: "email", label: "Email", type: "email", required: true, group: "Contact" },
            { id: "message", label: "What can we help with?", type: "long_text", required: true, group: "Project" },
          ],
        })
        .select("id")
        .single();
      if (error) throw error;
      navigate(`/dashboard/lead-forms/${(data as any).id}`);
    } catch (e: any) {
      toast({ title: "Couldn't create form", description: e.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (id: string, val: boolean) => {
    await supabase.from("lead_forms" as any).update({ is_active: val }).eq("id", id);
    setForms((arr) => arr.map((f) => f.id === id ? { ...f, is_active: val } : f));
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this form? Submissions are preserved as leads.")) return;
    await supabase.from("lead_forms" as any).delete().eq("id", id);
    setForms((arr) => arr.filter((f) => f.id !== id));
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/f/${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copied" });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-purple" /> Lead Forms
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Public forms with conditional logic. Submissions become leads in your inbox.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/dashboard/lead-inbox">View Lead Inbox</Link>
            </Button>
            <Button onClick={create} disabled={creating} className="gap-2 bg-gradient-to-r from-purple to-accent">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              New form
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : forms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/30 p-12 text-center">
            <ClipboardList className="w-10 h-10 mx-auto text-muted-foreground/60 mb-3" />
            <h2 className="text-base font-semibold text-foreground">No lead forms yet</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first form, share the link, and watch leads roll in.</p>
            <Button onClick={create} className="gap-2"><Plus className="w-4 h-4" />Create your first form</Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {forms.map((f) => (
              <div key={f.id} className="rounded-xl border border-border bg-card p-4 flex flex-wrap items-center gap-4">
                <Link to={`/dashboard/lead-forms/${f.id}`} className="flex-1 min-w-0">
                  <div className="font-semibold text-foreground truncate hover:text-purple transition">{f.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">/f/{f.slug}</div>
                </Link>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="text-center">
                    <div className="text-sm font-semibold text-foreground">{f.submission_count}</div>
                    <div>Submissions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold text-foreground">{f.view_count}</div>
                    <div>Views</div>
                  </div>
                  <Badge variant={f.is_active ? "default" : "secondary"} className="text-[10px]">
                    {f.is_active ? "Active" : "Off"}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Switch checked={f.is_active} onCheckedChange={(v) => toggleActive(f.id, v)} />
                  <Button size="icon" variant="ghost" onClick={() => copyLink(f.slug)} title="Copy link">
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => window.open(`/f/${f.slug}`, "_blank")} title="Open">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => remove(f.id)} title="Delete" className="text-rose-500 hover:text-rose-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
