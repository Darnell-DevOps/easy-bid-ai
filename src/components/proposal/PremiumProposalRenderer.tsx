import ReactMarkdown from "react-markdown";
import { CheckCircle2, ArrowRight, Sparkles } from "lucide-react";

interface PremiumProposalRendererProps {
  content: string;
}

function classifySection(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("introduction")) return "intro";
  if (lower.includes("understanding")) return "understanding";
  if (lower.includes("proposed solution")) return "solution";
  if (lower.includes("scope of work")) return "scope";
  if (lower.includes("timeline")) return "timeline";
  if (lower.includes("expected outcome")) return "outcomes";
  if (lower.includes("why choose")) return "why";
  if (lower.includes("next step")) return "cta";
  if (lower.includes("pricing") || lower.includes("investment")) return "pricing";
  return "default";
}

export default function PremiumProposalRenderer({ content }: PremiumProposalRendererProps) {
  // Split content into sections by h2
  const sections = content.split(/(?=^## )/m).filter(Boolean);

  return (
    <div className="space-y-6 lg:space-y-8">
      {sections.map((section, i) => {
        const lines = section.trim().split("\n");
        const titleLine = lines[0]?.replace(/^##\s*/, "") || "";
        const body = lines.slice(1).join("\n").trim();
        const sectionType = classifySection(titleLine);

        if (sectionType === "cta") {
          return (
            <div
              key={i}
              className="relative overflow-hidden rounded-xl border border-purple/30 bg-gradient-to-br from-purple/10 via-accent/5 to-transparent p-6 lg:p-10"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple/5 to-accent/5 opacity-50" />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple/20">
                    <ArrowRight className="h-5 w-5 text-purple" />
                  </div>
                  <h2 className="text-xl lg:text-2xl font-bold text-foreground">{titleLine}</h2>
                </div>
              <div className="prose-content text-muted-foreground leading-relaxed max-w-none lg:max-w-[70ch]">
                  <ReactMarkdown>{body}</ReactMarkdown>
                </div>
                <div className="mt-6 inline-flex items-center gap-2 rounded-lg bg-purple/20 border border-purple/30 px-5 py-3 text-sm font-semibold text-purple">
                  <Sparkles className="h-4 w-4" />
                  Ready to get started? Confirm and we'll begin immediately.
                </div>
              </div>
            </div>
          );
        }

        if (sectionType === "pricing") {
          return (
            <div
              key={i}
              className="relative overflow-hidden rounded-xl border border-purple/30 bg-card p-6 lg:p-10 shadow-lg shadow-purple/5"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple to-accent" />
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple/20">
                  <span className="text-lg font-bold text-purple">£</span>
                </div>
                <h2 className="text-xl lg:text-2xl font-bold text-foreground">{titleLine}</h2>
              </div>
              <div className="pricing-section text-muted-foreground leading-relaxed">
                <ReactMarkdown
                  components={{
                    table: ({ children }) => (
                      <div className="overflow-hidden rounded-lg border border-border my-4">
                        <table className="w-full text-sm">{children}</table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="bg-secondary/80">{children}</thead>
                    ),
                    th: ({ children }) => (
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => {
                      const text = String(children || "");
                      const isTotal = text.toLowerCase().includes("total");
                      const isCurrency = /[£$€]/.test(text) || /\d{1,3}(,\d{3})*(\.\d{2})?$/.test(text.trim());
                      return (
                        <td
                          className={`px-5 py-3 border-t border-border ${
                            isTotal
                              ? "font-bold text-foreground text-base bg-purple/5 border-t-2 border-t-purple/30"
                              : isCurrency
                              ? "font-semibold text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {children}
                        </td>
                      );
                    },
                    tr: ({ children }) => (
                      <tr className="transition-colors hover:bg-secondary/30">{children}</tr>
                    ),
                  }}
                >
                  {body}
                </ReactMarkdown>
              </div>
            </div>
          );
        }

        if (sectionType === "timeline") {
          // Parse timeline items from markdown
          const timelineItems: { title: string; desc: string }[] = [];
          const itemRegex = /\*\*(.+?)\*\*[:\s]*(.+)/g;
          let match;
          while ((match = itemRegex.exec(body)) !== null) {
            timelineItems.push({ title: match[1], desc: match[2] });
          }

          return (
            <div key={i} className="rounded-xl border border-border bg-card p-6 lg:p-10">
              <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-6">{titleLine}</h2>
              {timelineItems.length > 0 ? (
                <div className="relative pl-8 space-y-6">
                  <div className="absolute left-3 top-2 bottom-2 w-px bg-gradient-to-b from-purple via-accent to-purple/20" />
                  {timelineItems.map((item, j) => (
                    <div key={j} className="relative">
                      <div className="absolute -left-5 top-1.5 h-3 w-3 rounded-full border-2 border-purple bg-background" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <p className="text-sm text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="prose-content text-muted-foreground leading-relaxed max-w-[60ch]">
                  <ReactMarkdown>{body}</ReactMarkdown>
                </div>
              )}
            </div>
          );
        }

        if (sectionType === "scope" || sectionType === "why") {
          return (
            <div key={i} className="rounded-xl border border-border bg-card p-6 lg:p-10">
              <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-5">{titleLine}</h2>
              <div className="scope-content text-muted-foreground leading-relaxed max-w-none lg:max-w-[70ch]">
                <ReactMarkdown
                  components={{
                    li: ({ children }) => (
                      <li className="flex items-start gap-3 py-1.5">
                        <CheckCircle2 className="h-4 w-4 text-purple mt-0.5 shrink-0" />
                        <span>{children}</span>
                      </li>
                    ),
                    ul: ({ children }) => (
                      <ul className="space-y-1 list-none pl-0">{children}</ul>
                    ),
                  }}
                >
                  {body}
                </ReactMarkdown>
              </div>
            </div>
          );
        }

        // Default section card
        return (
          <div key={i} className="rounded-xl border border-border bg-card p-6 lg:p-10">
            <h2 className="text-xl lg:text-2xl font-bold text-foreground mb-4">{titleLine}</h2>
            <div className="prose-content text-muted-foreground leading-relaxed max-w-none lg:max-w-[70ch]">
              <ReactMarkdown>{body}</ReactMarkdown>
            </div>
          </div>
        );
      })}
    </div>
  );
}
