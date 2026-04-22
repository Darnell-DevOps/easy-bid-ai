import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Backwards compatible: legacy "pending" rows are treated as "draft".
export type ProposalStatus = "draft" | "sent" | "viewed" | "accepted" | "rejected";

export const normalizeStatus = (raw?: string | null): ProposalStatus => {
  const s = (raw || "").toLowerCase();
  if (s === "sent" || s === "viewed" || s === "accepted" || s === "rejected") return s;
  return "draft";
};

const STATUS_STYLES: Record<ProposalStatus, { label: string; cls: string }> = {
  draft:    { label: "Draft",    cls: "bg-muted text-muted-foreground border-border hover:bg-muted" },
  sent:     { label: "Sent",     cls: "bg-blue-500/15 text-blue-500 border-blue-500/30 hover:bg-blue-500/15" },
  viewed:   { label: "Viewed",   cls: "bg-amber-500/15 text-amber-500 border-amber-500/30 hover:bg-amber-500/15" },
  accepted: { label: "Accepted", cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/15" },
  rejected: { label: "Rejected", cls: "bg-rose-500/15 text-rose-500 border-rose-500/30 hover:bg-rose-500/15" },
};

interface StatusBadgeProps {
  status?: string | null;
  className?: string;
  paid?: boolean;
  descriptive?: boolean;
}

export default function StatusBadge({ status, className, paid, descriptive }: StatusBadgeProps) {
  const s = normalizeStatus(status);
  const cfg = STATUS_STYLES[s];
  let label = cfg.label;
  if (descriptive) {
    if (s === "draft") label = "Draft • Not sent";
    else if (s === "sent") label = "Sent • Awaiting reply";
    else if (s === "viewed") label = "Viewed • Awaiting reply";
    else if (s === "accepted") label = paid ? "Accepted • Paid" : "Accepted • Awaiting payment";
    else if (s === "rejected") label = "Rejected";
  }
  return (
    <Badge variant="outline" className={cn("font-medium", cfg.cls, className)}>
      {label}
    </Badge>
  );
}
