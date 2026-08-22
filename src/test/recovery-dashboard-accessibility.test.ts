import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/pages/RecoveryDashboard.tsx"), "utf8");

describe("Recovery dashboard accessibility", () => {
  it("associates every follow-up field label with its control", () => {
    const controlIds = ["rec-template", "rec-subject", "rec-body"];

    for (const id of controlIds) {
      expect(source).toContain(`htmlFor="${id}"`);
      expect(source).toContain(`id="${id}"`);
    }

    expect(source).not.toMatch(/<Label(?![^>]*htmlFor)[^>]*>/);
  });

  it("connects the message guidance to the editable message", () => {
    expect(source).toContain('aria-describedby="rec-body-help"');
    expect(source).toContain('id="rec-body-help"');
  });

  it("preserves template generation, clipboard, and email workflows", () => {
    expect(source).toContain("const t = buildRecoveryTemplate(msgKind, {");
    expect(source).toContain("setMsgSubject(t.subject)");
    expect(source).toContain("setMsgBody(t.body)");
    expect(source).toContain("setMsgKind(ctx.defaultKind)");
    expect(source).toContain('navigator.clipboard.writeText(`Subject: ${msgSubject}\\n\\n${msgBody}`)');
    expect(source).toContain('window.location.href = `mailto:${to}?subject=${s}&body=${b}`');
  });
});
