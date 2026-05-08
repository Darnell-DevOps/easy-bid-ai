import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaOnClick?: () => void;
  /**
   * card    – full-width dashed-border card, padded ~10. Use for full-page empty states.
   * panel   – plain card surface, padded ~6. Use for full-page empty states inside an existing Card grid.
   * inline  – compact, no card wrapper. Use inside an existing widget Card body.
   */
  variant?: "card" | "panel" | "inline";
  tone?: "default" | "accent" | "purple";
  className?: string;
}

const TONE = {
  default: { bg: "bg-muted", icon: "text-muted-foreground" },
  accent: { bg: "bg-accent/15", icon: "text-accent" },
  purple: { bg: "bg-purple/15", icon: "text-purple" },
} as const;

export default function EmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaHref,
  ctaOnClick,
  variant = "card",
  tone = "accent",
  className,
}: EmptyStateProps) {
  const t = TONE[tone];

  const cta =
    ctaLabel && (ctaHref || ctaOnClick) ? (
      ctaHref ? (
        <Button asChild size="sm" className="gap-2">
          <Link to={ctaHref}>{ctaLabel}</Link>
        </Button>
      ) : (
        <Button size="sm" className="gap-2" onClick={ctaOnClick}>
          {ctaLabel}
        </Button>
      )
    ) : null;

  if (variant === "inline") {
    return (
      <div className={cn("text-center py-5 px-2 space-y-2", className)}>
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mx-auto", t.bg)}>
          <Icon className={cn("w-4 h-4", t.icon)} />
        </div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground max-w-[260px] mx-auto leading-relaxed">
          {description}
        </p>
        {cta && <div className="pt-1">{cta}</div>}
      </div>
    );
  }

  const padding = variant === "card" ? "p-10" : "p-6";
  const border = variant === "card" ? "border-dashed border-border/60" : "";

  return (
    <Card className={cn(border, className)}>
      <CardContent className={cn(padding, "text-center space-y-3")}>
        <div className={cn("w-12 h-12 rounded-full flex items-center justify-center mx-auto", t.bg)}>
          <Icon className={cn("w-5 h-5", t.icon)} />
        </div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
        {cta && <div className="pt-1">{cta}</div>}
      </CardContent>
    </Card>
  );
}
