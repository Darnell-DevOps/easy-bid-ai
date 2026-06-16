import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { waLink, buildWaMessage, type WaContext, type WaTemplateVars } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

interface WhatsAppButtonProps {
  phone?: string | null;
  context?: WaContext;
  vars?: WaTemplateVars;
  /** Override the templated message entirely. */
  message?: string;
  variant?: "default" | "icon" | "ghost" | "outline";
  size?: "default" | "sm" | "icon";
  label?: string;
  className?: string;
}

/**
 * Opens WhatsApp (web or app) with a pre-filled message.
 * Disabled with an explanatory tooltip when no valid phone is present.
 */
export function WhatsAppButton({
  phone,
  context = "client",
  vars,
  message,
  variant = "outline",
  size = "sm",
  label = "WhatsApp",
  className,
}: WhatsAppButtonProps) {
  const finalMessage = message ?? buildWaMessage(context, vars || {});
  const href = waLink(phone, finalMessage);
  const disabled = !href;

  const btn = (
    <Button
      type="button"
      variant={variant === "icon" ? "ghost" : variant}
      size={variant === "icon" ? "icon" : size}
      disabled={disabled}
      onClick={() => {
        if (href) window.open(href, "_blank", "noopener,noreferrer");
      }}
      className={cn(
        !disabled && "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border-emerald-500/30",
        className,
      )}
      aria-label={label}
    >
      <MessageCircle className={variant === "icon" ? "w-4 h-4" : "w-3.5 h-3.5"} />
      {variant !== "icon" && <span className="ml-1.5">{label}</span>}
    </Button>
  );

  if (!disabled) return btn;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">{btn}</span>
        </TooltipTrigger>
        <TooltipContent>No phone number on file</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
