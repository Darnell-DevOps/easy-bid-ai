import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Target,
  Banknote,
  FileSignature,
  Send,
  Eye,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ProposalLite {
  id: string;
  client_name: string;
  company_name: string;
  service_type: string;
  budget: string;
  status?: string | null;
  client_paid?: boolean;
  sent_at?: string | null;
  viewed_at?: string | null;
  accepted_at?: string | null;
  paid_at?: string | null;
  created_at: string;
}

interface ContractLite {
  id: string;
  title: string;
  client_name: string;
  status: string;
  created_at: string;
  signed_at: string | null;
  proposal_id: string | null;
}

interface Props {
  proposals: ProposalLite[];
}

interface Opportunity {
  key: string;
  clientName: string;
  stageLabel: string;
  stageTone: string;
  stageIcon: typeof Send;
  value: number;
  lastActivity: string;
  lastActivityIso: string;
  nextStep: string;
  onClick: () => void;
  weight: number;
}

function parseAmount(s?: string | null): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatMoney(n: number): string {
  if (!n) return "—";
  return `£${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function relTime(iso?: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days >= 1) return `${days}d ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours >= 1) return `${hours}h ago`;
  return "just now";
}

export default function OpportunitiesToRevenue({ proposals }: Props) {
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<ContractLite[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("contracts")
        .select("id, title, client_name, status, created_at, signed_at, proposal_id")
        .is("deleted_at", null)
        .in("status", ["sent", "viewed", "signed"])
        .order("created_at", { ascending: false })
        .limit(50);
      setContracts(((data as any[]) || []) as ContractLite[]);
    })();
  }, [proposals.length]);

  const { opportunities, pipelineValue } = useMemo(() => {
    const items: Opportunity[] = [];
    const contractProposalIds = new Set(contracts.map((c) => c.proposal_id).filter(Boolean) as string[]);

    // Stage 1 (closest to revenue): accepted, unpaid — payment step
    for (const p of proposals) {
      const s = (p.status || "").toLowerCase();
      if (s !== "accepted" || p.client_paid) continue;
      // If a contract exists for it, we'll represent under contract instead
      if (contractProposalIds.has(p.id)) continue;
      const value = parseAmount(p.budget);
      items.push({
        key: `p-${p.id}`,
        clientName: p.client_name,
        stageLabel: "Awaiting payment",
        stageTone: "text-rose-400 bg-rose-500/15",
        stageIcon: Banknote,
        value,
        lastActivity: `Accepted ${relTime(p.accepted_at)}`,
        lastActivityIso: p.accepted_at || p.created_at,
        nextStep: "Send payment link",
        onClick: () => navigate(`/dashboard/proposal/${p.id}`),
        weight: 100 + value / 1000,
      });
    }

    // Stage 2: contract signed by client — needs countersign, then payment
    for (const c of contracts) {
      if (c.status !== "signed") continue;
      const linkedProp = proposals.find((p) => p.id === c.proposal_id);
      const value = linkedProp ? parseAmount(linkedProp.budget) : 0;
      items.push({
        key: `c-${c.id}`,
        clientName: c.client_name,
        stageLabel: "Awaiting countersign",
        stageTone: "text-amber-400 bg-amber-500/15",
        stageIcon: FileSignature,
        value,
        lastActivity: `Client signed ${relTime(c.signed_at || c.created_at)}`,
        lastActivityIso: c.signed_at || c.created_at,
        nextStep: "Countersign to execute",
        onClick: () => navigate(`/dashboard/contracts/${c.id}`),
        weight: 90 + value / 1000,
      });
    }

    // Stage 3: contract sent, awaiting client signature
    for (const c of contracts) {
      if (c.status !== "sent" && c.status !== "viewed") continue;
      const linkedProp = proposals.find((p) => p.id === c.proposal_id);
      const value = linkedProp ? parseAmount(linkedProp.budget) : 0;
      items.push({
        key: `c-${c.id}`,
        clientName: c.client_name,
        stageLabel: c.status === "viewed" ? "Contract viewed" : "Contract sent",
        stageTone: "text-blue-400 bg-blue-500/15",
        stageIcon: FileSignature,
        value,
        lastActivity: `${c.status === "viewed" ? "Viewed" : "Sent"} ${relTime(c.created_at)}`,
        lastActivityIso: c.created_at,
        nextStep: c.status === "viewed" ? "Follow up on signature" : "Nudge client to sign",
        onClick: () => navigate(`/dashboard/contracts/${c.id}`),
        weight: 75 + value / 1000,
      });
    }

    // Stage 4: proposals viewed but not yet accepted
    for (const p of proposals) {
      const s = (p.status || "").toLowerCase();
      if (s !== "viewed") continue;
      const value = parseAmount(p.budget);
      items.push({
        key: `p-${p.id}`,
        clientName: p.client_name,
        stageLabel: "Proposal viewed",
        stageTone: "text-amber-400 bg-amber-500/15",
        stageIcon: Eye,
        value,
        lastActivity: `Viewed ${relTime(p.viewed_at)}`,
        lastActivityIso: p.viewed_at || p.created_at,
        nextStep: "Send follow-up",
        onClick: () => navigate(`/dashboard/proposal/${p.id}`),
        weight: 60 + value / 1000,
      });
    }

    // Stage 5: proposals sent, awaiting engagement (last resort fills)
    for (const p of proposals) {
      const s = (p.status || "").toLowerCase();
      if (s !== "sent") continue;
      const value = parseAmount(p.budget);
      items.push({
        key: `p-${p.id}`,
        clientName: p.client_name,
        stageLabel: "Proposal sent",
        stageTone: "text-blue-400 bg-blue-500/15",
        stageIcon: Send,
        value,
        lastActivity: `Sent ${relTime(p.sent_at)}`,
        lastActivityIso: p.sent_at || p.created_at,
        nextStep: "Monitor engagement",
        onClick: () => navigate(`/dashboard/proposal/${p.id}`),
        weight: 40 + value / 2000,
      });
    }

    // Dedupe by clientName+stageLabel to avoid noise
    const seen = new Set<string>();
    const deduped: Opportunity[] = [];
    for (const it of items.sort((a, b) => b.weight - a.weight)) {
      const k = `${it.clientName}::${it.stageLabel}`;
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(it);
    }

    const pipelineValue = deduped.reduce((acc, it) => acc + it.value, 0);
    return { opportunities: deduped.slice(0, 5), pipelineValue };
  }, [proposals, contracts, navigate]);

  if (opportunities.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="revenue-heading" className="space-y-3">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 id="revenue-heading" className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-400" />
            Opportunities closest to revenue
            <span className="text-sm font-normal text-muted-foreground">({opportunities.length})</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Deals furthest along the workflow — nudge these first.
          </p>
        </div>
        {pipelineValue > 0 && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-medium">In-flight pipeline</p>
            <p className="text-lg font-bold text-foreground flex items-center gap-1.5 justify-end">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              {formatMoney(pipelineValue)}
            </p>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-0 divide-y divide-border">
          {opportunities.map((o) => {
            const Icon = o.stageIcon;
            return (
              <button
                key={o.key}
                onClick={o.onClick}
                className="w-full text-left px-3 sm:px-4 py-3 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center gap-3 group"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${o.stageTone}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">{o.clientName}</p>
                      <span className={`text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded ${o.stageTone}`}>
                        {o.stageLabel}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {o.lastActivity} · Next: {o.nextStep}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 pl-12 sm:pl-0">
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">{formatMoney(o.value)}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-foreground transition-colors" />
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
