// Lightweight merge-tag renderer.
// Tags look like {{namespace.key}} — e.g. {{client.name}}, {{intake.business_name}}.
// Unknown tags are left intact so unresolved merges stay visible.

export interface MergeContext {
  client?: {
    name?: string | null;
    email?: string | null;
    company?: string | null;
    phone?: string | null;
  } | null;
  business?: {
    name?: string | null;
    owner_name?: string | null;
  } | null;
  intake?: Record<string, string> | null;
}

const TAG_RE = /\{\{\s*([a-zA-Z0-9_]+)\.([a-zA-Z0-9_-]+)\s*\}\}/g;

export function renderMergeTags(text: string | null | undefined, ctx: MergeContext): string {
  if (!text) return "";
  return text.replace(TAG_RE, (full, ns: string, key: string) => {
    const value = lookup(ctx, ns, key);
    return value == null || value === "" ? full : String(value);
  });
}

function lookup(ctx: MergeContext, ns: string, key: string): string | undefined {
  switch (ns) {
    case "client":
      return (ctx.client as any)?.[key] ?? undefined;
    case "business":
      return (ctx.business as any)?.[key] ?? undefined;
    case "intake":
      return ctx.intake?.[key] ?? undefined;
    default:
      return undefined;
  }
}

export function availableTags(ctx: MergeContext): { tag: string; label: string }[] {
  const out: { tag: string; label: string }[] = [];
  if (ctx.client) {
    for (const k of ["name", "email", "company", "phone"]) {
      out.push({ tag: `{{client.${k}}}`, label: `Client ${k}` });
    }
  }
  if (ctx.business) {
    for (const k of ["name", "owner_name"]) {
      out.push({ tag: `{{business.${k}}}`, label: `Business ${k.replace("_", " ")}` });
    }
  }
  if (ctx.intake) {
    for (const k of Object.keys(ctx.intake)) {
      out.push({ tag: `{{intake.${k}}}`, label: `Intake · ${k}` });
    }
  }
  return out;
}
