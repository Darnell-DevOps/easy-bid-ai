import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? tsxFiles(path) : entry.name.endsWith(".tsx") ? [path] : [];
  });
}

describe("icon control accessibility", () => {
  it("gives every icon-sized Button an accessible name", () => {
    const srcRoot = resolve(process.cwd(), "src");
    const violations: string[] = [];

    for (const file of tsxFiles(srcRoot)) {
      const contents = readFileSync(file, "utf8");
      const buttons = contents.matchAll(/<Button\b[\s\S]*?<\/Button>/g);

      for (const match of buttons) {
        const button = match[0];
        if (!/size\s*=\s*["']icon["']/.test(button)) continue;

        const hasAccessibleName =
          /aria-label\s*=/.test(button) ||
          /aria-labelledby\s*=/.test(button) ||
          /className\s*=\s*["'][^"']*sr-only/.test(button);

        if (!hasAccessibleName) {
          const line = contents.slice(0, match.index).split("\n").length;
          violations.push(`${relative(process.cwd(), file)}:${line}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps hover-only proposal actions visible to keyboard users", () => {
    const proposals = readFileSync(resolve(process.cwd(), "src/components/dashboard/ProposalsList.tsx"), "utf8");

    expect(proposals).toContain("group-hover:opacity-100 focus:opacity-100");
    expect(proposals).toContain("aria-label={`More actions for ${p.client_name}`}");
  });

  it("keeps the deadline completion control named and at least 24px square", () => {
    const deadlines = readFileSync(resolve(process.cwd(), "src/components/calendar/DeadlinesPanel.tsx"), "utf8");

    expect(deadlines).toContain("w-6 h-6 rounded-full");
    expect(deadlines).toContain('aria-label={`${d.status === "completed" ? "Mark as not done" : "Mark complete"}: ${d.title}`}');
  });
});
