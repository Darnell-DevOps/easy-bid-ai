import { describe, expect, it } from "vitest";
import { readSource } from "./read-source";

describe("CloseSync design-system integration", () => {
  const main = readSource("src/main.tsx");
  const tokens = readSource("src/styles/closesync-design-system.css");
  const tailwind = readSource("tailwind.config.ts");
  const document = readSource("index.html");

  it("loads the token layer before the existing Tailwind global stylesheet", () => {
    const designSystemImport = 'import "./styles/closesync-design-system.css";';
    const globalStylesImport = 'import "./index.css";';

    expect(main).toContain(designSystemImport);
    expect(main.indexOf(designSystemImport)).toBeLessThan(main.indexOf(globalStylesImport));
  });

  it("uses Geist with the documented fallback stack", () => {
    expect(document).toContain("family=Geist:wght@400..700");
    expect(tokens).toContain(
      '--cs-font-sans: "Geist", "Inter", system-ui, "Segoe UI", Helvetica, Arial, sans-serif;',
    );
    expect(tailwind).toContain('sans: ["var(--cs-font-sans)"]');
  });

  it("keeps CloseSync tokens isolated from shadcn semantic variables", () => {
    expect(tokens).toContain("--cs-primary: #7a3cff;");
    expect(tokens).toContain("--cs-radius-lg: 14px;");
    expect(tokens).not.toMatch(/^\s*--(?:primary|success|warning|error|background|card):/m);
    expect(tokens).not.toMatch(/^\.(?:btn|card|input|textarea|select|badge|page|sidebar)\b/m);
  });

  it("connects core shared primitives to the token layer", () => {
    const primitives = [
      "src/components/ui/button.tsx",
      "src/components/ui/input.tsx",
      "src/components/ui/textarea.tsx",
      "src/components/ui/select.tsx",
      "src/components/ui/card.tsx",
      "src/components/ui/badge.tsx",
      "src/components/ui/label.tsx",
    ].map(readSource).join("\n");

    for (const token of [
      "--cs-control-height",
      "--cs-radius-sm",
      "--cs-radius-lg",
      "--cs-text-sm",
      "--cs-line-small",
    ]) {
      expect(primitives).toContain(token);
    }
  });
});
