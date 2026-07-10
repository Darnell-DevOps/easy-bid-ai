import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText,
  Plus,
  Trash2,
  Shield,
  Lock,
  RotateCcw,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Sparkles,
  Crown,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { usePlan } from "@/hooks/use-plan";
import UpgradeModal from "@/components/plan/UpgradeModal";

interface Policy {
  id: string;
  business_name: string;
  policy_type: string;
  country: string;
  created_at: string;
  updated_at: string;
}

type PolicyKey = "Terms & Conditions" | "Privacy Policy" | "Refund Policy";

const ESSENTIAL_POLICIES: {
  type: PolicyKey;
  headline: string;
  icon: typeof FileText;
  accent: string;
  iconBg: string;
  bullets: string[];
  usedIn: string;
  warning: string;
}[] = [
  {
    type: "Terms & Conditions",
    headline: "Protect your work, scope, and payment terms",
    icon: FileText,
    accent: "from-violet-500 to-purple-600",
    iconBg: "bg-violet-500/10 text-violet-500",
    bullets: ["Prevent scope creep", "Set payment rules", "Avoid disputes"],
    usedIn: "Used in: proposals, invoices, checkout",
    warning: "No Terms → risk non-payment",
  },
  {
    type: "Privacy Policy",
    headline: "Stay compliant and build client trust",
    icon: Lock,
    accent: "from-blue-500 to-cyan-500",
    iconBg: "bg-blue-500/10 text-blue-500",
    bullets: ["Required for websites", "Protect client data", "Avoid legal issues"],
    usedIn: "Used in: website, checkout, signup forms",
    warning: "No Privacy Policy → risk compliance issues",
  },
  {
    type: "Refund Policy",
    headline: "Reduce chargebacks and protect revenue",
    icon: RotateCcw,
    accent: "from-emerald-500 to-teal-600",
    iconBg: "bg-emerald-500/10 text-emerald-500",
    bullets: ["Set refund conditions", "Avoid disputes", "Increase buyer confidence"],
    usedIn: "Used in: proposals, invoices, checkout",
    warning: "No Refund Policy → risk chargebacks",
  },
];

const STALE_DAYS = 180;

export default function Policies() {
  const navigate = useNavigate();
  const { hasFeature } = usePlan();
  const policiesUnlocked = hasFeature("policies");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoAttach, setAutoAttach] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem("policies:auto_attach");
    return v === null ? true : v === "true";
  });

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("policies")
      .select("id, business_name, policy_type, country, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setPolicies(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    localStorage.setItem("policies:auto_attach", String(autoAttach));
  }, [autoAttach]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this policy?")) return;
    const { error } = await supabase.from("policies").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Policy deleted");
    setPolicies((p) => p.filter((x) => x.id !== id));
  };

  // Status per policy type
  const statusByType = useMemo(() => {
    const map = new Map<
      PolicyKey,
      { status: "created" | "missing" | "needs_update"; policy?: Policy }
    >();
    for (const ess of ESSENTIAL_POLICIES) {
      const found = policies.find((p) => p.policy_type === ess.type);
      if (!found) {
        map.set(ess.type, { status: "missing" });
      } else {
        const updated = new Date(found.updated_at).getTime();
        const stale = Date.now() - updated > STALE_DAYS * 86400 * 1000;
        map.set(ess.type, { status: stale ? "needs_update" : "created", policy: found });
      }
    }
    return map;
  }, [policies]);

  const missingCount = ESSENTIAL_POLICIES.filter(
    (e) => statusByType.get(e.type)?.status === "missing",
  ).length;

  const handleCardClick = (type: PolicyKey) => {
    const entry = statusByType.get(type);
    if (entry?.policy) {
      // Viewing existing policies is always allowed
      navigate(`/dashboard/policies/${entry.policy.id}`);
      return;
    }
    if (!policiesUnlocked) {
      setUpgradeOpen(true);
      return;
    }
    navigate(`/dashboard/policies/new?type=${encodeURIComponent(type)}`);
  };

  const handleGenerateClick = (e: React.MouseEvent) => {
    if (!policiesUnlocked) {
      e.preventDefault();
      setUpgradeOpen(true);
    }
  };

  return (
    <DashboardLayout>
      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        requiredPlan="pro"
        title="Protect your deals with professional policies"
        description="Generate client-ready Terms, Privacy, and Refund policies and auto-attach them to every proposal. Available on the Pro plan."
      />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium mb-3">
              <Shield className="w-3.5 h-3.5" />
              Business protection
            </div>
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
              Protect your revenue with professional policies
            </h1>
            <p className="text-muted-foreground mt-2 text-base">
              Avoid disputes, chargebacks, and unclear agreements — generate client-ready policies in seconds.
            </p>
          </div>
          {policiesUnlocked ? (
            <Button asChild size="lg" className="shrink-0">
              <Link to="/dashboard/policies/new">
                <Plus className="w-4 h-4 mr-2" />
                Generate Policy
              </Link>
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={handleGenerateClick}
              className="shrink-0 bg-accent text-accent-foreground font-semibold hover:bg-accent/90"
            >
              <Crown className="w-4 h-4 mr-2" />
              Unlock with Pro
            </Button>
          )}
        </div>
      </div>

      {/* Urgency message when no policies */}
      {!loading && policies.length === 0 && (
        <Card className="mb-6 border-destructive/30 bg-destructive/5">
          <CardContent className="p-5 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-destructive" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">You haven't set your policies yet</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Without policies, every proposal you send carries unnecessary risk. It only takes 60 seconds.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Awareness: Before you send proposals */}
      <Card className="mb-6 border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-sm text-foreground">Before you send proposals…</h3>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {ESSENTIAL_POLICIES.map((p) => {
              const status = statusByType.get(p.type)?.status ?? "missing";
              const isMissing = status === "missing";
              return (
                <div
                  key={p.type}
                  className={`flex items-start gap-2.5 p-3 rounded-lg border ${
                    isMissing
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-emerald-500/20 bg-emerald-500/5"
                  }`}
                >
                  {isMissing ? (
                    <Circle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                  )}
                  <div className="text-xs">
                    <div className="font-medium text-foreground">{p.type}</div>
                    <div className="text-muted-foreground mt-0.5">
                      {isMissing ? p.warning : "Covered"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Auto-attach toggle */}
      <Card className="mb-6">
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-accent" />
            </div>
            <div>
              <div className="font-medium text-sm text-foreground">Auto-attach to proposals & invoices</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Automatically include relevant policies in every document you send.
              </div>
            </div>
          </div>
          <Switch checked={autoAttach} onCheckedChange={setAutoAttach} />
        </CardContent>
      </Card>

      {/* Essential policy cards (always visible) */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide">
            Essential policies
          </h2>
          {missingCount > 0 && (
            <span className="text-xs text-destructive font-medium">
              {missingCount} missing
            </span>
          )}
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {ESSENTIAL_POLICIES.map((p) => {
            const entry = statusByType.get(p.type);
            const status = entry?.status ?? "missing";
            return (
              <Card
                key={p.type}
                onClick={() => handleCardClick(p.type)}
                className="group cursor-pointer relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-accent/40"
              >
                <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${p.accent}`} />
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-11 h-11 rounded-lg ${p.iconBg} flex items-center justify-center`}>
                      <p.icon className="w-5 h-5" />
                    </div>
                    {status === "created" && (
                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 bg-emerald-500/5 text-[10px]">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Created
                      </Badge>
                    )}
                    {status === "needs_update" && (
                      <Badge variant="outline" className="border-amber-500/40 text-amber-600 bg-amber-500/5 text-[10px]">
                        Needs update
                      </Badge>
                    )}
                    {status === "missing" && (
                      <Badge variant="outline" className="border-destructive/40 text-destructive bg-destructive/5 text-[10px]">
                        Missing
                      </Badge>
                    )}
                  </div>
                  <h4 className="font-semibold text-foreground text-sm mb-1">{p.type}</h4>
                  <p className="text-xs text-muted-foreground mb-3">{p.headline}</p>
                  <ul className="space-y-1.5 mb-4">
                    {p.bullets.map((b) => (
                      <li key={b} className="flex items-center gap-2 text-xs text-foreground/80">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <div className="text-[10px] text-muted-foreground mb-3 italic">{p.usedIn}</div>
                  <div className="mt-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 group-hover:border-accent/40 group-hover:text-accent transition-colors"
                    >
                      {status === "missing" ? "Generate now" : "View & edit"}
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* All policies list */}
      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : policies.length > 0 ? (
        <div>
          <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-3">
            Your policies
          </h2>
          <div className="grid gap-2">
            {policies.map((p) => (
              <Card key={p.id} className="hover:border-primary/40 transition-colors">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      to={`/dashboard/policies/${p.id}`}
                      className="font-medium text-sm hover:underline block truncate"
                    >
                      {p.business_name}
                    </Link>
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      <Badge variant="secondary" className="text-[10px]">{p.policy_type}</Badge>
                      <Badge variant="outline" className="text-[10px]">{p.country}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {format(new Date(p.created_at), "MMM d, yyyy")}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(p.id)}
                      aria-label="Delete policy"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}
