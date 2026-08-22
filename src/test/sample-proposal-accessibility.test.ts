import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sample = readFileSync(resolve(process.cwd(), "src/pages/SampleProposal.tsx"), "utf8");

describe("sample proposal accessibility", () => {
  it("uses landmarks, native lists, and one interactive element per call to action", () => {
    expect(sample).toContain('<nav aria-label="Sample proposal navigation"');
    expect(sample).toContain('<main className="container max-w-3xl');
    expect(sample).toContain('<Button asChild size="sm"');
    expect(sample).toContain('<Button asChild size="lg"');
    expect(sample).not.toMatch(/<Link to="\/signup">\s*<Button/);
    expect(sample).toContain('<ul className="grid sm:grid-cols-2 gap-3">');
    expect(sample).toContain("<ol>");
    expect(sample).toContain("<dl>");
  });
});
