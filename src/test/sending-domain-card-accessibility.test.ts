import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/components/emails/SendingDomainsCard.tsx"),
  "utf8",
);

describe("sending domain settings accessibility", () => {
  it("labels and describes the add-domain field", () => {
    expect(source).toContain(
      '<Label htmlFor="sending-domain-name" className="sr-only">Sending domain</Label>',
    );
    expect(source).toContain('id="sending-domain-help"');
    expect(source).toMatch(
      /id="sending-domain-name"[\s\S]*?aria-describedby="sending-domain-help"/,
    );
    expect(source).not.toMatch(/<Label(?![^>]*htmlFor)[^>]*>/);
  });

  it("announces adding and loading states", () => {
    expect(source).toMatch(
      /<Button onClick=\{add\} disabled=\{adding\} aria-busy=\{adding\}/,
    );
    expect(source).toMatch(/role="status" aria-live="polite"/);
    expect(source).toContain(
      '<span className="sr-only">Loading sending domains</span>',
    );
  });

  it("names each domain row and exposes its busy and verification states", () => {
    expect(source).toMatch(
      /role="group" aria-labelledby=\{`sending-domain-\$\{d\.id\}`\} aria-busy=\{busy\}/,
    );
    expect(source).toContain('id={`sending-domain-${d.id}`}');
    expect(source).toMatch(/<div role="status" aria-live="polite"/);
  });

  it("labels the sender local-part field and its repeated save action", () => {
    expect(source).toContain('htmlFor={`sending-domain-local-${d.id}`}');
    expect(source).toContain('id={`sending-domain-local-${d.id}`}');
    expect(source).toContain(
      'aria-label={`Save sender address for ${d.domain}`}',
    );
  });

  it("names icon-only remove and DNS copy actions", () => {
    expect(source).toContain('aria-label={`Remove ${d.domain}`}');
    expect(source).toContain('aria-label="Copy DNS record value"');
  });

  it("retains domain-specific, navigable DNS table semantics", () => {
    expect(source).toContain('aria-label={`DNS records for ${d.domain}`}');
    expect(source).toContain("tabIndex={0}");
    expect(source).toContain(
      '<caption className="sr-only">DNS records required to verify {d.domain}.</caption>',
    );
    expect(source.match(/<th scope="col"/g)).toHaveLength(4);
  });

  it("hides every decorative icon", () => {
    const iconTags = [
      ...source.matchAll(
        /<(Loader2|Globe|ShieldCheck|RefreshCw|Trash2|Star|Plus|Copy|AlertCircle)\b[^>]*>/g,
      ),
    ].map((match) => match[0]);

    expect(iconTags).toHaveLength(12);
    for (const iconTag of iconTags) {
      expect(iconTag).toContain('aria-hidden="true"');
    }
  });
});
