import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Star, Copy, Send, Check, X, ExternalLink, Plus, Trash2 } from "lucide-react";

type Settings = {
  id?: string;
  user_id?: string;
  public_slug?: string;
  wall_headline?: string;
  wall_intro?: string;
  google_review_url?: string;
  auto_request_on_contract_signed?: boolean;
  auto_request_on_proposal_paid?: boolean;
  follow_up_days?: number;
  max_reminders?: number;
  from_name?: string;
  custom_message?: string;
};

type Testimonial = {
  id: string;
  client_name: string;
  company?: string | null;
  role_title?: string | null;
  rating?: number | null;
  content: string;
  source: string;
  is_published: boolean;
  is_featured: boolean;
  allow_public: boolean;
  created_at: string;
};

type ReviewRequest = {
  id: string;
  client_name: string;
  client_email?: string | null;
  status: string;
  source: string;
  reminder_count: number;
  sent_at?: string | null;
  created_at: string;
  token: string;
};

export default function TestimonialsDashboard() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Settings>({});
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [requestOpen, setRequestOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    let { data: s } = await supabase
      .from("testimonial_settings").select("*").eq("user_id", u.user.id).maybeSingle();
    if (!s) {
      const { data: created } = await supabase
        .from("testimonial_settings")
        .insert({ user_id: u.user.id, from_name: u.user.email?.split("@")[0] || "" })
        .select().single();
      s = created;
    }
    setSettings(s || {});

    const [{ data: t }, { data: r }] = await Promise.all([
      supabase.from("testimonials").select("*").order("created_at", { ascending: false }),
      supabase.from("review_requests").select("*").order("created_at", { ascending: false }).limit(100),
    ]);
    setTestimonials(t || []);
    setRequests(r || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveSettings = async () => {
    if (!settings.id) return;
    const { error } = await supabase.from("testimonial_settings")
      .update({
        wall_headline: settings.wall_headline,
        wall_intro: settings.wall_intro,
        google_review_url: settings.google_review_url,
        auto_request_on_contract_signed: settings.auto_request_on_contract_signed,
        auto_request_on_proposal_paid: settings.auto_request_on_proposal_paid,
        follow_up_days: settings.follow_up_days,
        max_reminders: settings.max_reminders,
        from_name: settings.from_name,
        custom_message: settings.custom_message,
      })
      .eq("id", settings.id);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: "Settings saved" });
  };

  const wallUrl = settings.public_slug ? `${window.location.origin}/wall/${settings.public_slug}` : "";

  const stats = {
    total: testimonials.length,
    avg: testimonials.filter(t => t.rating).reduce((a, t) => a + (t.rating || 0), 0) /
         (testimonials.filter(t => t.rating).length || 1),
    pending: requests.filter(r => r.status === "pending" || r.status === "sent").length,
    completed: requests.filter(r => r.status === "completed").length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Testimonials & Reputation</h1>
            <p className="text-sm text-muted-foreground">Collect, manage and showcase client reviews automatically.</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={manualOpen} onOpenChange={setManualOpen}>
              <DialogTrigger asChild><Button variant="outline" size="sm"><Plus aria-hidden="true" className="w-4 h-4" /> Add manually</Button></DialogTrigger>
              <ManualTestimonialDialog onClose={() => { setManualOpen(false); load(); }} />
            </Dialog>
            <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
              <DialogTrigger asChild><Button size="sm"><Send aria-hidden="true" className="w-4 h-4" /> Request review</Button></DialogTrigger>
              <RequestDialog onClose={() => { setRequestOpen(false); load(); }} />
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Testimonials" value={stats.total.toString()} />
          <StatCard label="Avg rating" value={stats.total ? stats.avg.toFixed(1) : "—"} icon={<Star className="w-4 h-4 text-amber-500" />} />
          <StatCard label="Pending requests" value={stats.pending.toString()} />
          <StatCard label="Completed" value={stats.completed.toString()} />
        </div>

        <Tabs defaultValue="wall">
          <TabsList aria-label="Testimonial dashboard sections">
            <TabsTrigger value="wall">Testimonials</TabsTrigger>
            <TabsTrigger value="requests">Requests</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="share">Share</TabsTrigger>
          </TabsList>

          <TabsContent value="wall" className="space-y-4 mt-6">
            {loading ? <p role="status" aria-live="polite" className="text-sm text-muted-foreground">Loading…</p> :
             testimonials.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
                No testimonials yet. Send a review request or add one manually.
              </CardContent></Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {testimonials.map(t => (
                  <TestimonialCard key={t.id} t={t} onChanged={load} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests" className="space-y-2 mt-6">
            {requests.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No review requests yet.</CardContent></Card>
            ) : requests.map(r => <RequestRow key={r.id} r={r} onChanged={load} />)}
          </TabsContent>

          <TabsContent value="settings" className="space-y-6 mt-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Sender</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Field id="testimonial-from-name" label="From name (used in emails)">
                  <Input id="testimonial-from-name" value={settings.from_name || ""} onChange={e => setSettings({ ...settings, from_name: e.target.value })} placeholder="Your name or studio" />
                </Field>
                <Field id="testimonial-personal-message" label="Personal message (optional)">
                  <Textarea id="testimonial-personal-message" rows={3} value={settings.custom_message || ""} onChange={e => setSettings({ ...settings, custom_message: e.target.value })} placeholder="Add a sentence clients will see in the request email." />
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Automation</CardTitle><CardDescription>Auto-send review requests after key milestones.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <ToggleRow id="testimonial-auto-contract" label="When a contract is signed" checked={!!settings.auto_request_on_contract_signed}
                  onChange={v => setSettings({ ...settings, auto_request_on_contract_signed: v })} />
                <ToggleRow id="testimonial-auto-payment" label="When a proposal is paid" checked={!!settings.auto_request_on_proposal_paid}
                  onChange={v => setSettings({ ...settings, auto_request_on_proposal_paid: v })} />
                <div className="grid grid-cols-2 gap-3">
                  <Field id="testimonial-follow-up-days" label="Follow-up after (days)">
                    <Input id="testimonial-follow-up-days" type="number" min={1} max={30} value={settings.follow_up_days || 4}
                      onChange={e => setSettings({ ...settings, follow_up_days: Number(e.target.value) })} />
                  </Field>
                  <Field id="testimonial-max-reminders" label="Max reminders">
                    <Input id="testimonial-max-reminders" type="number" min={0} max={5} value={settings.max_reminders ?? 2}
                      onChange={e => setSettings({ ...settings, max_reminders: Number(e.target.value) })} />
                  </Field>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Reputation channels</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Field id="testimonial-google-review-url" label="Google review link">
                  <Input id="testimonial-google-review-url" aria-describedby="testimonial-google-review-help" value={settings.google_review_url || ""} onChange={e => setSettings({ ...settings, google_review_url: e.target.value })}
                    placeholder="https://g.page/r/..." />
                  <p id="testimonial-google-review-help" className="text-xs text-muted-foreground mt-1">Shown in review emails and on your wall. Get yours from your Google Business profile.</p>
                </Field>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Public wall</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <Field id="testimonial-wall-headline" label="Headline">
                  <Input id="testimonial-wall-headline" value={settings.wall_headline || ""} onChange={e => setSettings({ ...settings, wall_headline: e.target.value })} />
                </Field>
                <Field id="testimonial-wall-intro" label="Intro (optional)">
                  <Textarea id="testimonial-wall-intro" rows={2} value={settings.wall_intro || ""} onChange={e => setSettings({ ...settings, wall_intro: e.target.value })} />
                </Field>
              </CardContent>
            </Card>

            <Button onClick={saveSettings}>Save settings</Button>
          </TabsContent>

          <TabsContent value="share" className="space-y-4 mt-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Your testimonial wall</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Label htmlFor="testimonial-wall-url" className="sr-only">Testimonial wall URL</Label>
                  <Input id="testimonial-wall-url" readOnly value={wallUrl} />
                  <Button aria-label="Copy testimonial wall URL" variant="outline" onClick={() => { navigator.clipboard.writeText(wallUrl); toast({ title: "Copied" }); }}>
                    <Copy aria-hidden="true" className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" asChild>
                    <a href={wallUrl} target="_blank" rel="noreferrer" aria-label="Open testimonial wall in a new tab"><ExternalLink aria-hidden="true" className="w-4 h-4" /></a>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Share this link anywhere — it shows your published testimonials and Google review button.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function Field({
  id,
  label,
  children,
  required = false,
  group = false,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  required?: boolean;
  group?: boolean;
}) {
  const labelContent = <>{label}{required && <span className="sr-only"> (required)</span>}</>;
  return (
    <div>
      {group ? (
        <p id={`${id}-label`} className="mb-2 block text-sm font-medium">{labelContent}</p>
      ) : (
        <Label htmlFor={id} className="mb-2 block">{labelContent}</Label>
      )}
      {children}
    </div>
  );
}
function ToggleRow({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label htmlFor={id} className="text-sm font-normal cursor-pointer">{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  );
}
function StatCard({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-1 flex items-center gap-2">{value}{icon}</div>
    </CardContent></Card>
  );
}

function TestimonialCard({ t, onChanged }: { t: Testimonial; onChanged: () => void }) {
  const toggle = async (field: "is_published" | "is_featured", value: boolean) => {
    const patch: any = { [field]: value };
    await supabase.from("testimonials").update(patch).eq("id", t.id);
    onChanged();
  };
  const remove = async () => {
    if (!confirm("Delete this testimonial?")) return;
    await supabase.from("testimonials").delete().eq("id", t.id);
    onChanged();
  };
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1" role="img" aria-label={`${t.rating || 0} out of 5 stars`}>
            {[1,2,3,4,5].map(i => (
              <Star aria-hidden="true" key={i} className={`w-4 h-4 ${(t.rating || 0) >= i ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30"}`} />
            ))}
          </div>
          <Badge variant={t.is_published ? "default" : "secondary"}>{t.is_published ? "Published" : "Hidden"}</Badge>
        </div>
        <p className="text-sm leading-relaxed">"{t.content}"</p>
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{t.client_name}</span>
          {t.role_title && <span> · {t.role_title}</span>}
          {t.company && <span> · {t.company}</span>}
        </div>
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <Switch
                id={`testimonial-${t.id}-published`}
                checked={t.is_published}
                onCheckedChange={v => toggle("is_published", v)}
                aria-label={`Publish testimonial from ${t.client_name}`}
              />
              <Label htmlFor={`testimonial-${t.id}-published`} className="text-xs font-normal cursor-pointer">Published</Label>
            </div>
            <div className="flex items-center gap-1">
              <Switch
                id={`testimonial-${t.id}-featured`}
                checked={t.is_featured}
                onCheckedChange={v => toggle("is_featured", v)}
                aria-label={`Feature testimonial from ${t.client_name}`}
              />
              <Label htmlFor={`testimonial-${t.id}-featured`} className="text-xs font-normal cursor-pointer">Featured</Label>
            </div>
          </div>
          <Button aria-label={`Delete testimonial from ${t.client_name}`} variant="ghost" size="sm" onClick={remove}><Trash2 aria-hidden="true" className="w-4 h-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RequestRow({ r, onChanged }: { r: ReviewRequest; onChanged: () => void }) {
  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/testimonial/${r.token}`);
    toast({ title: "Link copied" });
  };
  const remove = async () => {
    await supabase.from("review_requests").delete().eq("id", r.id);
    onChanged();
  };
  const statusColor: Record<string, string> = {
    pending: "secondary", sent: "default", completed: "default", expired: "outline", declined: "outline",
  };
  return (
    <Card><CardContent className="p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{r.client_name || r.client_email}</div>
        <div className="text-xs text-muted-foreground truncate">
          {r.client_email} · {r.source} · {r.reminder_count} reminders
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={statusColor[r.status] as any}>{r.status}</Badge>
        <Button aria-label={`Copy review link for ${r.client_name || r.client_email}`} variant="ghost" size="sm" onClick={copyLink}><Copy aria-hidden="true" className="w-4 h-4" /></Button>
        <Button aria-label={`Delete review request for ${r.client_name || r.client_email}`} variant="ghost" size="sm" onClick={remove}><Trash2 aria-hidden="true" className="w-4 h-4" /></Button>
      </div>
    </CardContent></Card>
  );
}

function RequestDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!email || !name) return toast({ title: "Name and email required", variant: "destructive" });
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("review_requests").insert({
      user_id: u.user!.id, client_name: name, client_email: email, source: "manual",
    });
    setBusy(false);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Request created", description: "It will be sent on the next cycle (within 30 min)." });
    onClose();
  };
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Request a review</DialogTitle>
        <DialogDescription>Create a review request for a client using their name and email address.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <Field id="review-request-name" label="Client name" required>
          <Input id="review-request-name" autoComplete="name" aria-required="true" value={name} onChange={e => setName(e.target.value)} />
        </Field>
        <Field id="review-request-email" label="Client email" required>
          <Input id="review-request-email" type="email" autoComplete="email" aria-required="true" value={email} onChange={e => setEmail(e.target.value)} />
        </Field>
      </div>
      <DialogFooter><Button onClick={submit} disabled={busy} aria-busy={busy}>{busy ? "Creating…" : "Create request"}</Button></DialogFooter>
    </DialogContent>
  );
}

function ManualTestimonialDialog({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ client_name: "", company: "", role_title: "", rating: 5, content: "" });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!form.client_name || !form.content) return toast({ title: "Name and content required", variant: "destructive" });
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("testimonials").insert({
      user_id: u.user!.id, ...form, source: "manual", is_published: true, allow_public: true,
    });
    setBusy(false);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    onClose();
  };
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Add testimonial</DialogTitle>
        <DialogDescription>Add a testimonial collected outside CloseSync.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field id="manual-testimonial-name" label="Client name" required><Input id="manual-testimonial-name" autoComplete="name" aria-required="true" value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} /></Field>
          <Field id="manual-testimonial-company" label="Company"><Input id="manual-testimonial-company" autoComplete="organization" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></Field>
        </div>
        <Field id="manual-testimonial-role" label="Role / title"><Input id="manual-testimonial-role" value={form.role_title} onChange={e => setForm({ ...form, role_title: e.target.value })} /></Field>
        <Field id="manual-testimonial-rating" label="Rating" group>
          <div className="flex items-center gap-1" role="group" aria-labelledby="manual-testimonial-rating-label">
            {[1,2,3,4,5].map(i => (
              <button
                key={i}
                type="button"
                aria-label={`${i} star${i === 1 ? "" : "s"}`}
                aria-pressed={form.rating === i}
                onClick={() => setForm({ ...form, rating: i })}
                className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Star aria-hidden="true" className={`w-6 h-6 ${form.rating >= i ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30"}`} />
              </button>
            ))}
          </div>
        </Field>
        <Field id="manual-testimonial-content" label="Testimonial" required><Textarea id="manual-testimonial-content" rows={4} aria-required="true" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} /></Field>
      </div>
      <DialogFooter><Button onClick={submit} disabled={busy} aria-busy={busy}>{busy ? "Saving…" : "Add testimonial"}</Button></DialogFooter>
    </DialogContent>
  );
}
