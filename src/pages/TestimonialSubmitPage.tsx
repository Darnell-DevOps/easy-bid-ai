import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Star, Check, ExternalLink } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function TestimonialSubmitPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<any>(null);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", company: "", role_title: "", rating: 5, content: "", allow_public: true });
  const [busy, setBusy] = useState(false);
  const [reviewError, setReviewError] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc("testimonial_request_get", { _token: token! });
      if (error) { toast({ title: "Invalid link", variant: "destructive" }); setLoading(false); return; }
      const d = data as any;
      setInfo(d);
      setForm(f => ({ ...f, name: d?.client_name || "" }));
      if (d?.status === "completed") setSubmitted(true);
      setLoading(false);
    })();
  }, [token]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.content.trim().length < 5) {
      setReviewError("Please write a review of at least 5 characters.");
      document.getElementById("testimonial-review")?.focus();
      return;
    }

    setReviewError("");
    setBusy(true);
    const { error } = await supabase.rpc("testimonial_submit", {
      _token: token!,
      _rating: form.rating,
      _content: form.content,
      _client_name: form.name,
      _company: form.company || null,
      _role_title: form.role_title || null,
      _allow_public: form.allow_public,
    });
    setBusy(false);
    if (error) return toast({ title: "Submission failed", description: error.message, variant: "destructive" });
    setSubmitted(true);
  };

  if (loading) return <CenterShell><p role="status" aria-live="polite" className="text-sm text-muted-foreground">Loading…</p></CenterShell>;
  if (!info) return <CenterShell><h1 className="type-page-title">Link not found</h1><p className="text-sm text-muted-foreground mt-2">This review link is invalid or has expired.</p></CenterShell>;

  if (submitted) {
    return (
      <CenterShell>
        <div className="text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-green-500/10 mx-auto flex items-center justify-center">
            <Check aria-hidden="true" className="w-7 h-7 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold">Thank you</h1>
          <p className="text-sm text-muted-foreground">Your feedback means a lot{info.from_name ? ` to ${info.from_name}` : ""}.</p>
          {info.google_review_url && (
            <Button asChild variant="outline">
              <a href={info.google_review_url} target="_blank" rel="noreferrer" aria-label="Share a review on Google (opens in a new tab)">
                Share on Google too <ExternalLink aria-hidden="true" className="w-4 h-4 ml-1" />
              </a>
            </Button>
          )}
        </div>
      </CenterShell>
    );
  }

  return (
    <CenterShell>
      <div className="space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Leave a review</h1>
          <p className="text-sm text-muted-foreground">{info.from_name ? `${info.from_name} would love your feedback.` : "Your feedback helps."}</p>
          {info.custom_message && <p className="text-sm text-foreground/80 mt-3 italic">"{info.custom_message}"</p>}
        </div>

        <form onSubmit={submit} noValidate aria-busy={busy} className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-sm font-medium leading-none">Rating</legend>
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(i => (
                <label
                  key={i}
                  className="relative inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
                >
                  <input
                    type="radio"
                    name="testimonial-rating"
                    value={i}
                    checked={form.rating === i}
                    onChange={() => setForm({ ...form, rating: i })}
                    aria-label={`${i} ${i === 1 ? "star" : "stars"}`}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                  <Star
                    aria-hidden="true"
                    className={`pointer-events-none h-8 w-8 ${form.rating >= i ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30"}`}
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <Label htmlFor="testimonial-review" className="mb-2 block">Your review</Label>
            <Textarea
              id="testimonial-review"
              rows={5}
              required
              minLength={5}
              value={form.content}
              onChange={event => {
                const content = event.target.value;
                setForm({ ...form, content });
                if (reviewError && content.trim().length >= 5) setReviewError("");
              }}
              aria-invalid={!!reviewError}
              aria-describedby={reviewError ? "testimonial-review-error" : undefined}
              placeholder="What was the experience like? What stood out?"
            />
            {reviewError && (
              <p id="testimonial-review-error" role="alert" className="mt-2 text-sm text-destructive">
                {reviewError}
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><Label htmlFor="testimonial-name" className="mb-2 block">Name</Label>
              <Input id="testimonial-name" autoComplete="name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label htmlFor="testimonial-company" className="mb-2 block">Company (optional)</Label>
              <Input id="testimonial-company" autoComplete="organization" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
          </div>
          <div><Label htmlFor="testimonial-role" className="mb-2 block">Role / title (optional)</Label>
            <Input id="testimonial-role" autoComplete="organization-title" value={form.role_title} onChange={e => setForm({ ...form, role_title: e.target.value })} /></div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input className="h-6 w-6 shrink-0" type="checkbox" checked={form.allow_public} onChange={e => setForm({ ...form, allow_public: e.target.checked })} />
            Allow this review to be shown publicly
          </label>
          <Button type="submit" disabled={busy} className="w-full">{busy ? "Submitting…" : "Submit review"}</Button>
          {info.google_review_url && (
            <Button asChild variant="outline" className="w-full">
              <a href={info.google_review_url} target="_blank" rel="noreferrer" aria-label="Leave a Google review (opens in a new tab)">
                Or leave a Google review <ExternalLink aria-hidden="true" className="w-4 h-4 ml-1" />
              </a>
            </Button>
          )}
        </form>
      </div>
    </CenterShell>
  );
}

function CenterShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg"><CardContent className="p-8">{children}</CardContent></Card>
    </main>
  );
}
