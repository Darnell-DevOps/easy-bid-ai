import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/components/contracts/CountersignDialog.tsx"),
  "utf8",
);

describe("countersign dialog accessibility", () => {
  it("provides a programmatic dialog description", () => {
    expect(source).toContain("<DialogDescription>");
    expect(source).toContain(
      "Your client has signed. Add your signature to mark this contract fully executed.",
    );
  });

  it("associates identity labels and exposes input purpose", () => {
    const labelIds = [...source.matchAll(/<Label\s+htmlFor="([^"]+)"/g)].map(
      (match) => match[1],
    );

    expect(labelIds).toEqual(["countersign-name", "countersign-email"]);
    expect(source).not.toMatch(/<Label(?![^>]*htmlFor)[^>]*>/);

    for (const id of labelIds) {
      expect(source).toContain(`id="${id}"`);
    }

    const nameInput = source
      .split(/\r?\n/)
      .find((line) => line.includes('<Input id="countersign-name"'));
    const emailInput = source
      .split(/\r?\n/)
      .find((line) => line.includes('<Input id="countersign-email"'));

    expect(nameInput).toContain('autoComplete="name" required');
    expect(emailInput).toContain('type="email"');
    expect(emailInput).toContain('autoComplete="email"');
  });

  it("names the signature method tabs", () => {
    expect(source).toMatch(/<TabsList[^>]*aria-label="Signature method"/);
    expect(source).toContain('<TabsTrigger value="typed">Type signature</TabsTrigger>');
    expect(source).toContain('<TabsTrigger value="drawn">Draw signature</TabsTrigger>');
  });

  it("names the drawing canvas and identifies the typed alternative", () => {
    expect(source).toMatch(
      /<canvas[\s\S]*?role="img"[\s\S]*?aria-label="Signature drawing area\. Use the Type signature tab if you cannot draw with a pointer\."/,
    );
    expect(source).toMatch(/<div[^>]*aria-hidden="true">\s*<p/);
  });

  it("announces submission and hides decorative icons", () => {
    expect(source).toMatch(
      /<Button\s+onClick=\{submit\}\s+disabled=\{submitting\}\s+aria-busy=\{submitting\}/,
    );

    for (const icon of ["Eraser", "Loader2", "ShieldCheck"]) {
      expect(source).toMatch(new RegExp(`<${icon}[^>]*aria-hidden="true"`));
    }
  });
});
