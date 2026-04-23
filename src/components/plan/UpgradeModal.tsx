import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Check, Sparkles } from "lucide-react";
import { PLANS, type PlanId } from "@/lib/plans";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The plan needed to unlock the feature. */
  requiredPlan: PlanId;
  /** Headline shown at the top of the modal. */
  title?: string;
  /** Sub-headline / explanation. */
  description?: string;
}

export default function UpgradeModal({
  open,
  onOpenChange,
  requiredPlan,
  title,
  description,
}: UpgradeModalProps) {
  const navigate = useNavigate();
  const target = PLANS[requiredPlan];

  const headline = title || `Unlock with ${target.name}`;
  const sub =
    description ||
    `${target.tagline}. Upgrade to ${target.name} for ${target.currencySymbol}${target.priceMonthly}/month.`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center">
              {requiredPlan === "pro" ? (
                <Crown className="w-4 h-4 text-accent" />
              ) : (
                <Sparkles className="w-4 h-4 text-accent" />
              )}
            </div>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
              {target.name} plan
            </span>
          </div>
          <DialogTitle className="text-xl">{headline}</DialogTitle>
          <DialogDescription>{sub}</DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 py-2">
          {target.bullets.slice(0, 5).map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm text-foreground">
              <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="sm:flex-none"
          >
            Maybe later
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              navigate("/dashboard/billing");
            }}
            className="bg-gradient-to-r from-purple to-accent text-accent-foreground font-semibold hover:brightness-110 sm:flex-1"
          >
            Upgrade to {target.name} — {target.currencySymbol}{target.priceMonthly}/mo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
