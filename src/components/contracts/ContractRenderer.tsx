import { useMemo } from "react";

export interface InlineSignature {
  signer_name: string;
  signer_email?: string | null;
  method: "typed" | "drawn";
  signature_data: string;
  signed_at: string;
}

/**
 * Lightweight Markdown renderer scoped to contract output.
 * Supports: # / ## / ### headings, paragraphs, bullet lists, **bold**.
 *
 * When a `clientSignature` is provided, the renderer detects underscore
 * placeholder lines (e.g. "____________ Date:") that follow a "Client" label
 * and replaces the underscores with the actual signature visual + date,
 * so the signed contract carries the signature where it belongs.
 */
export default function ContractRenderer({
  content,
  clientSignature,
  providerSignature,
}: {
  content: string;
  clientSignature?: InlineSignature | null;
  providerSignature?: InlineSignature | null;
}) {
  const blocks = useMemo(() => parseBlocks(content || ""), [content]);

  // Track the last non-empty label (e.g. "Client", "Service Provider")
  // so we can attach the signature to the right slot.
  let lastLabel = "";

  return (
    <article className="max-w-none text-foreground leading-relaxed">
      {blocks.map((b, i) => {
        if (b.type === "h1")
          return (
            <h1 key={i} className="text-3xl font-bold text-foreground mt-2 mb-4 tracking-tight">
              {renderInline(b.text)}
            </h1>
          );
        if (b.type === "h2")
          return (
            <h2 key={i} className="text-xl font-semibold text-foreground mt-8 mb-3 border-b border-border/60 pb-2">
              {renderInline(b.text)}
            </h2>
          );
        if (b.type === "h3")
          return (
            <h3 key={i} className="text-base font-semibold text-foreground mt-5 mb-2">
              {renderInline(b.text)}
            </h3>
          );
        if (b.type === "ul")
          return (
            <ul key={i} className="list-disc pl-6 space-y-1.5 my-3 text-foreground/90">
              {b.items.map((it, j) => (
                <li key={j} className="text-sm">
                  {renderInline(it)}
                </li>
              ))}
            </ul>
          );

        // Detect signature placeholder line (e.g. "____________ Date:")
        const isPlaceholder = /_{3,}/.test(b.text);
        if (isPlaceholder && clientSignature && /client/i.test(lastLabel)) {
          const label = lastLabel;
          lastLabel = ""; // consume
          return (
            <div key={i} className="my-3 flex flex-wrap items-end gap-x-8 gap-y-2">
              <div className="flex flex-col">
                <div className="min-h-12 flex items-end">
                  {clientSignature.method === "drawn" &&
                  clientSignature.signature_data?.startsWith("data:image") ? (
                    <img
                      src={clientSignature.signature_data}
                      alt={`Signature of ${clientSignature.signer_name}`}
                      className="max-h-14 object-contain"
                      style={{ filter: "invert(1) brightness(2) contrast(1.1)" }}
                    />
                  ) : (
                    <span
                      className="text-2xl text-foreground"
                      style={{ fontFamily: "'Caveat', 'Brush Script MT', cursive" }}
                    >
                      {clientSignature.signature_data || clientSignature.signer_name}
                    </span>
                  )}
                </div>
                <div className="border-t border-border/70 mt-1 pt-1 min-w-[14rem]">
                  <p className="text-xs text-muted-foreground">
                    {clientSignature.signer_name}
                    {label ? ` · ${label}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex flex-col">
                <p className="text-sm text-foreground/90 min-h-12 flex items-end">
                  {new Date(clientSignature.signed_at).toLocaleDateString()}
                </p>
                <div className="border-t border-border/70 mt-1 pt-1 min-w-[8rem]">
                  <p className="text-xs text-muted-foreground">Date</p>
                </div>
              </div>
            </div>
          );
        }

        // Update lastLabel tracker with short label-like paragraphs
        const trimmed = b.text.trim();
        if (trimmed && !isPlaceholder && trimmed.length < 40) {
          lastLabel = trimmed.replace(/\*\*/g, "");
        } else if (!isPlaceholder) {
          lastLabel = "";
        }

        return (
          <p key={i} className="text-sm text-foreground/90 my-3 whitespace-pre-wrap">
            {renderInline(b.text)}
          </p>
        );
      })}
    </article>
  );
}

type Block =
  | { type: "h1" | "h2" | "h3" | "p"; text: string }
  | { type: "ul"; items: string[] };

function parseBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] | null = null;

  const flushPara = () => {
    if (para.length) {
      blocks.push({ type: "p", text: para.join(" ").trim() });
      para = [];
    }
  };
  const flushList = () => {
    if (list && list.length) {
      blocks.push({ type: "ul", items: list });
    }
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    if (line.startsWith("### ")) {
      flushPara();
      flushList();
      blocks.push({ type: "h3", text: line.slice(4) });
      continue;
    }
    if (line.startsWith("## ")) {
      flushPara();
      flushList();
      blocks.push({ type: "h2", text: line.slice(3) });
      continue;
    }
    if (line.startsWith("# ")) {
      flushPara();
      flushList();
      blocks.push({ type: "h1", text: line.slice(2) });
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushPara();
      list = list || [];
      list.push(line.replace(/^[-*]\s+/, ""));
      continue;
    }
    // Treat short label-style lines (e.g. "Client", "Service Provider") and
    // underscore signature placeholder lines as their own blocks so the
    // renderer can pair them up. Otherwise merge into the running paragraph.
    const isLabel = /^(\*\*)?(client|service provider)(\*\*)?:?$/i.test(line);
    const isPlaceholder = /_{3,}/.test(line);
    if (isLabel || isPlaceholder) {
      flushPara();
      blocks.push({ type: "p", text: line });
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}

function renderInline(text: string) {
  // **bold**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={i} className="font-semibold text-foreground">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}
