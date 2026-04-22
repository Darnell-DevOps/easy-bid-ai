import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Sparkles, X } from "lucide-react";

/**
 * Subtle, dismissible "you can do these things" highlight shown the first time
 * a user lands on the dashboard after completing onboarding (via ?onboarded=1).
 */
export default function OnboardingHighlight() {
  const [params, setParams] = useSearchParams();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (params.get("onboarded") === "1") {
      setVisible(true);
    }
  }, [params]);

  const dismiss = () => {
    setVisible(false);
    const next = new URLSearchParams(params);
    next.delete("onboarded");
    setParams(next, { replace: true });
  };

  if (!visible) return null;

  return (
    <div className="relative rounded-xl border border-accent/30 bg-gradient-to-r from-accent/10 via-purple/10 to-transparent p-4 sm:p-5">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="w-9 h-9 rounded-lg bg-accent/20 text-accent flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            You're set up. Here's where to go next.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Use <span className="text-foreground font-medium">Quick Actions</span>{" "}
            below to add another client, create a proposal, or browse your saved
            proposals.
          </p>
        </div>
      </div>
    </div>
  );
}
