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

        // Skip legacy "Project Proposal" title section — hero already handles it
        if (sectionType === "skip") return null;

        // "What You'll Get" — hero outcome bullets, placed right after hero
        if (sectionType === "whatyouget") {
          return (
            <section key={i} className="py-8 lg:py-10">
              <div className="rounded-xl border border-purple/20 bg-gradient-to-br from-purple/5 via-accent/5 to-transparent p-6 lg:p-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-purple mb-4">What you'll get</p>
                <div className="text-foreground/90 leading-relaxed">
                  <ReactMarkdown
                    components={{
                      ul: ({ children }) => <ul className="space-y-3 list-none pl-0">{children}</ul>,
                      li: ({ children }) => (
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-purple mt-0.5 shrink-0" />
                          <span className="text-base text-foreground">{children}</span>
                        </li>
                      ),
                      p: ({ children }) => <p className="text-base text-foreground/90">{children}</p>,
                    }}
                  >
                    {body}
                  </ReactMarkdown>
                </div>
              </div>
            </section>
          );
        }

        // "Your Current Challenge" — pain points with alert icons
        if (sectionType === "challenge") {
          return (
            <SectionShell key={i}>
              <div className="text-muted-foreground leading-relaxed max-w-[70ch]">
                <ReactMarkdown
                  components={{
                    ul: ({ children }) => <ul className="space-y-2 list-none pl-0">{children}</ul>,
                    li: ({ children }) => (
                      <li className="flex items-start gap-3 py-1.5">
                        <AlertCircle className="h-4 w-4 text-rose-400/80 mt-1 shrink-0" />
                        <span className="text-foreground/90">{children}</span>
                      </li>
                    ),
                  }}
                >
                  {body}
                </ReactMarkdown>
              </div>
            </SectionShell>
          );
        }

        // "How We'll Solve This" — action bullets with wrench icons
        if (sectionType === "solution") {
          return (
            <SectionShell key={i}>
              <div className="text-muted-foreground leading-relaxed max-w-[70ch]">
                <ReactMarkdown
                  components={{
                    ul: ({ children }) => <ul className="space-y-2 list-none pl-0">{children}</ul>,
                    li: ({ children }) => (
                      <li className="flex items-start gap-3 py-1.5">
                        <Wrench className="h-4 w-4 text-purple mt-1 shrink-0" />
                        <span className="text-foreground/90">{children}</span>
                      </li>
                    ),
                  }}
                >
                  {body}
                </ReactMarkdown>
              </div>
            </SectionShell>
          );
        }

        // Deliverables — clean checklist
        if (sectionType === "deliverables") {
          return (
            <SectionShell key={i}>
              <div className="text-muted-foreground leading-relaxed max-w-[70ch]">
                <ReactMarkdown
                  components={{
                    ul: ({ children }) => <ul className="space-y-2 list-none pl-0">{children}</ul>,
                    li: ({ children }) => (
                      <li className="flex items-start gap-3 py-1.5">
                        <CheckCircle2 className="h-4 w-4 text-purple mt-0.5 shrink-0" />
                        <span className="text-foreground/90">{children}</span>
                      </li>
                    ),
                  }}
                >
                  {body}
                </ReactMarkdown>
              </div>
            </SectionShell>
          );
        }

        // "Investment" — large price block with framing
        if (sectionType === "investment") {
          // Extract the first bolded amount (e.g. **£1,200**) as the headline price
          const priceMatch = body.match(/\*\*\s*([£$€][\s\S]*?)\*\*/);
          const price = priceMatch ? priceMatch[1].trim() : null;
          const remaining = priceMatch ? body.replace(priceMatch[0], "").trim() : body;
          return (
            <section key={i} className="py-8 lg:py-10">
              <div className="rounded-2xl border border-purple/30 bg-gradient-to-br from-purple/10 via-card to-card p-6 lg:p-10 shadow-lg shadow-purple/5">
                <div className="flex items-center gap-3 mb-5">
                  <div className="h-1 w-8 rounded-full bg-gradient-to-r from-purple to-accent" />
                  <h2 className="text-xl lg:text-2xl font-bold text-foreground tracking-tight">Investment</h2>
                </div>
                {price && (
                  <p className="text-5xl lg:text-6xl font-bold text-foreground tracking-tight mb-5">
                    {price}
                  </p>
                )}
                <div className="text-muted-foreground leading-relaxed max-w-[60ch] space-y-3">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="text-base text-foreground/85">{children}</p>,
                      strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
                    }}
                  >
                    {remaining}
                  </ReactMarkdown>
                </div>
              </div>
            </section>
          );
        }

        if (sectionType === "cta") {
          return null;
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
