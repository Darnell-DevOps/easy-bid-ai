import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Sparkles, X, ArrowRight, UserPlus, FileText, Send, CreditCard, CalendarCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  label: string;
  description: string;
  done: boolean;
  href: string;
  ctaLabel: string;
  icon: typeof UserPlus;
}

const dismissKey = (uid: string) => `activation:dismissed:${uid}`;

/**
 * Persistent activation tracker shown to users until they reach key milestones
 * (or explicitly dismiss it). Replaces the one-shot OnboardingHighlight banner
 * for users who still have setup left. Auto-hides once all steps are complete.
 */
export default function ActivationChecklist() {
  const [userId, setUserId] = useState<string | null>(null);
  const [counts, setCounts] = useState({
    clients: 0,
    proposals: 0,
    sent: 0,
    paid: 0,
    recurring: 0, // booking_links + retainers
  });
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) {
        setLoading(false);
        return;
      }
      setUserId(user.id);
      setDismissed(localStorage.getItem(dismissKey(user.id)) === "1");

      const [clients, proposals, sent, paid, links, retainers] = await Promise.all([
        supabase.from("clients").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("proposals").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("proposals").select("id", { count: "exact", head: true }).eq("user_id", user.id).not("sent_at", "is", null),
        supabase.from("proposals").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("client_paid", true),
        supabase.from("booking_links").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("retainers").select("id", { count: "exact", head: true }).eq("user_id", user.id).is("deleted_at", null),
      ]);
      if (cancelled) return;
      setCounts({
        clients: clients.count ?? 0,
        proposals: proposals.count ?? 0,
        sent: sent.count ?? 0,
        paid: paid.count ?? 0,
        recurring: (links.count ?? 0) + (retainers.count ?? 0),
      });
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const steps: Step[] = useMemo(() => [
    {
      id: "client",
      label: "Add your first client",
      description: "Start your pipeline with a real lead.",
      done: counts.clients > 0,
      href: "/dashboard/clients/new",
      ctaLabel: "Add client",
      icon: UserPlus,
    },
    {
      id: "proposal",
      label: "Create your first proposal",
      description: "Generate a polished proposal in under 2 minutes.",
      done: counts.proposals > 0,
      href: "/dashboard/new",
      ctaLabel: "Create proposal",
      icon: FileText,
    },
    {
      id: "sent",
      label: "Send a proposal to a client",
      description: "Share the link so the client can view and accept.",
      done: counts.sent > 0,
      href: "/dashboard/proposals",
      ctaLabel: "Open proposals",
      icon: Send,
    },
    {
      id: "paid",
      label: "Get your first payment",
      description: "Send the payment link once a client accepts.",
      done: counts.paid > 0,
      href: "/dashboard/proposals",
      ctaLabel: "Request payment",
      icon: CreditCard,
    },
    {
      id: "recurring",
      label: "Set up booking or recurring revenue",
      description: "Create a booking link or retainer to scale.",
      done: counts.recurring > 0,
      href: "/dashboard/calendar",
      ctaLabel: "Set up",
      icon: CalendarCheck,
    },
  ], [counts]);

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const allDone = completed === total;
  const next = steps.find((s) => !s.done);

  const dismiss = () => {
    if (userId) localStorage.setItem(dismissKey(userId), "1");
    setDismissed(true);
  };

  if (loading || !userId || dismissed || allDone) return null;

  const pct = Math.round((completed / total) * 100);

  return (
    <div className="relative rounded-xl border border-accent/30 bg-gradient-to-br from-accent/10 via-purple/5 to-transparent p-4 sm:p-5">
      <button
        onClick={dismiss}
        aria-label="Dismiss activation checklist"
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="w-9 h-9 rounded-lg bg-accent/20 text-accent flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-semibold text-foreground">
              Get set up — {completed} of {total} steps complete
            </p>
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              {pct}%
            </span>
          </div>

          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent to-purple transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>

          {next && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <next.icon className="w-4 h-4 text-accent shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">
                    Next: {next.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 sm:truncate">{next.description}</p>
                </div>
              </div>
              <Button asChild size="sm" className="h-7 px-2.5 text-xs gap-1 shrink-0">
                <Link to={next.href}>
                  {next.ctaLabel} <ArrowRight className="w-3 h-3" />
                </Link>
              </Button>
            </div>
          )}

          <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
            {steps.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-xs">
                <span
                  className={cn(
                    "w-4 h-4 rounded-full flex items-center justify-center shrink-0 border",
                    s.done
                      ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-500"
                      : "bg-muted border-border text-muted-foreground",
                  )}
                >
                  {s.done && <Check className="w-2.5 h-2.5" />}
                </span>
                <span className={cn(s.done ? "text-muted-foreground line-through" : "text-foreground")}>
                  {s.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
