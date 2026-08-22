import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/components/templates/TemplateEditorDialog.tsx"),
  "utf8",
);

describe("proposal template editor accessibility", () => {
  it("associates every field label with a unique control", () => {
    const labelIds = [...source.matchAll(/<Label\s+htmlFor="([^"]+)"/g)].map(
      (match) => match[1],
    );

    expect(labelIds).toHaveLength(14);
    expect(new Set(labelIds).size).toBe(labelIds.length);
    expect(source).not.toMatch(/<Label(?![^>]*htmlFor)[^>]*>/);

    for (const id of labelIds) {
      expect(source).toContain(`id="${id}"`);
    }
  });

  it("marks the template name as required", () => {
    const templateNameInput = source
      .split(/\r?\n/)
      .find((line) => line.includes('<Input id="t-name"'));

    expect(templateNameInput).toContain(" required />");
  });

  it("labels each select trigger", () => {
    for (const id of ["t-icon", "t-colour", "t-tone"]) {
      expect(source).toContain(`<SelectTrigger id="${id}">`);
    }
  });

  it("announces the save operation without exposing the spinner icon", () => {
    expect(source).toMatch(
      /<Button onClick=\{handleSave\} disabled=\{saving\} aria-busy=\{saving\}>/,
    );
    expect(source).toMatch(/<Loader2[^>]*aria-hidden="true"/);
  });
});
