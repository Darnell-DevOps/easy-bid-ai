import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/components/templates/OnboardingTemplateEditorDialog.tsx"),
  "utf8",
);

describe("onboarding template editor accessibility", () => {
  it("associates every field label with a unique control", () => {
    const labelIds = [...source.matchAll(/<Label\s+htmlFor="([^"]+)"/g)].map(
      (match) => match[1],
    );

    expect(labelIds).toHaveLength(11);
    expect(new Set(labelIds).size).toBe(labelIds.length);
    expect(source).not.toMatch(/<Label(?![^>]*htmlFor)[^>]*>/);

    for (const id of labelIds) {
      expect(source).toContain(`id="${id}"`);
    }
  });

  it("marks the template name as required", () => {
    const templateNameInput = source
      .split(/\r?\n/)
      .find((line) => line.includes('<Input id="ot-name"'));

    expect(templateNameInput).toContain(" required />");
  });

  it("labels each select trigger", () => {
    for (const id of ["ot-icon", "ot-colour"]) {
      expect(source).toContain(`<SelectTrigger id="${id}">`);
    }
  });

  it("associates structured-field instructions with their text areas", () => {
    for (const [fieldId, helpId] of [
      ["ot-questions", "ot-questions-help"],
      ["ot-file-requests", "ot-file-requests-help"],
      ["ot-deadlines", "ot-deadlines-help"],
    ]) {
      expect(source).toContain(`id="${helpId}"`);
      expect(source).toMatch(
        new RegExp(`id="${fieldId}"[\\s\\S]*?aria-describedby="${helpId}"`),
      );
    }
  });

  it("announces saving and hides decorative icons", () => {
    expect(source).toMatch(
      /<Button onClick=\{handleSave\} disabled=\{saving\} aria-busy=\{saving\}>/,
    );
    expect(source).toMatch(/<Loader2[^>]*aria-hidden="true"/);
    expect(source).toMatch(/<ClipboardList[^>]*aria-hidden="true"/);
  });
});
