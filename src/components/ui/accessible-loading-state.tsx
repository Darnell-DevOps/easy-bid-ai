import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccessibleLoadingStateProps {
  label: string;
  className?: string;
  spinnerClassName?: string;
  showLabel?: boolean;
}

/** A consistently announced loading state for routed and in-page content. */
export function AccessibleLoadingState({
  label,
  className,
  spinnerClassName,
  showLabel = false,
}: AccessibleLoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={cn("flex items-center justify-center gap-2", className)}
    >
      <Loader2
        aria-hidden="true"
        className={cn("h-5 w-5 animate-spin text-muted-foreground", spinnerClassName)}
      />
      <span className={showLabel ? "text-sm text-muted-foreground" : "sr-only"}>{label}</span>
    </div>
  );
}

export default AccessibleLoadingState;
