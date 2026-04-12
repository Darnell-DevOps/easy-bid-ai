import { useScrollReveal } from "@/hooks/useScrollReveal";
import { cn } from "@/lib/utils";

interface RevealSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  delay?: number;
  as?: "section" | "div";
}

export default function RevealSection({
  children,
  className,
  delay = 0,
  as: Tag = "div",
  ...props
}: RevealSectionProps) {
  const { ref, isVisible } = useScrollReveal();

  return (
    <Tag
      ref={ref}
      className={cn(
        "reveal",
        isVisible && "visible",
        delay > 0 && `reveal-delay-${delay}`,
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}
