import ReactMarkdown from "react-markdown";
import { CheckCircle2, ArrowRight, Sparkles, AlertCircle, Wrench } from "lucide-react";

interface PremiumProposalRendererProps {
  content: string;
}

function classifySection(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("project proposal")) return "skip";
  if (lower.includes("what you'll get") || lower.includes("what you will get")) return "whatyouget";
  if (lower.includes("introduction")) return "intro";
  if (lower.includes("your current challenge") || lower.includes("understanding")) return "challenge";
  if (lower.includes("how we'll solve") || lower.includes("how we will solve") || lower.includes("proposed solution")) return "solution";
  if (lower.includes("scope of work")) return "scope";
  if (lower.includes("deliverable")) return "deliverables";
  if (lower.includes("timeline")) return "timeline";
  if (lower.includes("expected outcome")) return "outcomes";
  if (lower.includes("investment")) return "investment";
  if (lower.includes("why choose")) return "why";
  if (lower.includes("next step")) return "cta";
  if (lower.includes("pricing")) return "pricing";
  return "default";
}

export default function PremiumProposalRenderer({ content }: PremiumProposalRendererProps) {
  // Split content into sections by h2
  const sections = content.split(/(?=^## )/m).filter(Boolean);

  return (
    <div className="divide-y divide-border/60">
      {sections.map((section, i) => {
        const lines = section.trim().split("\n");
        const titleLine = lines[0]?.replace(/^##\s*/, "") || "";
        const body = lines.slice(1).join("\n").trim();
        const sectionType = classifySection(titleLine);

        const SectionShell = ({ children }: { children: React.ReactNode }) => (
          <section className="py-8 lg:py-10">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-1 w-8 rounded-full bg-gradient-to-r from-purple to-accent" />
              <h2 className="text-xl lg:text-2xl font-bold text-foreground tracking-tight">{titleLine}</h2>
            </div>
            {children}
          </section>
        );

        if (sectionType === "cta") {
          return (
            <section key={i} className="py-10 lg:py-12">
              <div className="rounded-xl border border-purple/30 bg-gradient-to-br from-purple/10 via-accent/5 to-transparent p-6 lg:p-10 text-center">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-purple/20 mb-4">
                  <ArrowRight className="h-5 w-5 text-purple" />
                </div>
                <h2 className="text-2xl lg:text-3xl font-bold text-foreground mb-3 tracking-tight">
                  Ready to get started?
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto mb-6 leading-relaxed">
                  Three simple steps to begin — no friction, no delays.
                </p>
                <ol className="max-w-sm mx-auto space-y-3 text-left mb-8">
                  {[
                    "Accept this proposal",
                    "Make payment securely online",
                    "Work begins immediately",
                  ].map((step, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-purple/20 text-xs font-bold text-purple">
                        {idx + 1}
                      </span>
                      <span className="text-sm text-foreground leading-relaxed pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple to-accent px-7 py-3 text-sm font-semibold text-accent-foreground shadow-lg shadow-purple/20 hover:brightness-110 hover:shadow-purple/30 transition-all"
                >
                  <Sparkles className="h-4 w-4" />
                  Accept &amp; Get Started
                </button>
                {body && (
                  <div className="prose-content text-muted-foreground leading-relaxed max-w-xl mx-auto mt-6 text-sm">
                    <ReactMarkdown>{body}</ReactMarkdown>
                  </div>
                )}
              </div>
            </section>
          );
        }

        if (sectionType === "pricing") {
          return (
            <SectionShell key={i}>
              <div className="pricing-section text-muted-foreground leading-relaxed">
                <ReactMarkdown
                  components={{
                    table: ({ children }) => (
                      <div className="overflow-hidden rounded-lg border border-border my-2">
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
            </SectionShell>
          );
        }

        if (sectionType === "timeline") {
          const timelineItems: { title: string; desc: string }[] = [];
          const itemRegex = /\*\*(.+?)\*\*[:\s]*(.+)/g;
          let match;
          while ((match = itemRegex.exec(body)) !== null) {
            timelineItems.push({ title: match[1], desc: match[2] });
          }

          return (
            <SectionShell key={i}>
              {timelineItems.length > 0 ? (
                <div className="relative pl-8 space-y-5">
                  <div className="absolute left-3 top-2 bottom-2 w-px bg-gradient-to-b from-purple via-accent to-purple/20" />
                  {timelineItems.map((item, j) => (
                    <div key={j} className="relative">
                      <div className="absolute -left-5 top-1.5 h-3 w-3 rounded-full border-2 border-purple bg-background" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="prose-content text-muted-foreground leading-relaxed max-w-[70ch]">
                  <ReactMarkdown>{body}</ReactMarkdown>
                </div>
              )}
            </SectionShell>
          );
        }

        if (sectionType === "scope" || sectionType === "why") {
          let processedBody = body;
          if (sectionType === "why" && !/^\s*[-*]\s+/m.test(body)) {
            const sentences = body
              .replace(/\n+/g, " ")
              .split(/(?<=[.!?])\s+(?=[A-Z])/)
              .map((s) => s.trim())
              .filter((s) => s.length > 8);
            if (sentences.length >= 2) {
              processedBody = sentences.map((s) => `- ${s}`).join("\n");
            }
          }

          return (
            <SectionShell key={i}>
              <div className="scope-content text-muted-foreground leading-relaxed max-w-[70ch]">
                <ReactMarkdown
                  components={{
                    li: ({ children }) => (
                      <li className="flex items-start gap-3 py-1.5">
                        <CheckCircle2 className="h-4 w-4 text-purple mt-0.5 shrink-0" />
                        <span className="text-foreground/90">{children}</span>
                      </li>
                    ),
                    ul: ({ children }) => (
                      <ul className="space-y-1 list-none pl-0">{children}</ul>
                    ),
                  }}
                >
                  {processedBody}
                </ReactMarkdown>
              </div>
            </SectionShell>
          );
        }

        // Default section — no card, continuous flow
        return (
          <SectionShell key={i}>
            <div className="prose-content text-muted-foreground leading-relaxed max-w-[70ch] space-y-3">
              <ReactMarkdown>{body}</ReactMarkdown>
            </div>
          </SectionShell>
        );
      })}
    </div>
  );
}
