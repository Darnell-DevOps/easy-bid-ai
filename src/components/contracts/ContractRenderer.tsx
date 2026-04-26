import { useMemo } from "react";

/**
 * Lightweight Markdown renderer scoped to contract output.
 * Supports: # / ## / ### headings, paragraphs, bullet lists, **bold**.
 */
export default function ContractRenderer({ content }: { content: string }) {
  const blocks = useMemo(() => parseBlocks(content || ""), [content]);

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
