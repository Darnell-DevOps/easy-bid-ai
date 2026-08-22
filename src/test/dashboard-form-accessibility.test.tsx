import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import FieldListEditor from "@/components/forms/FieldListEditor";
import type { SmartField } from "@/lib/form-fields";

function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? tsxFiles(path) : entry.name.endsWith(".tsx") ? [path] : [];
  });
}

describe("dashboard form accessibility", () => {
  it("gives every Switch an explicit accessible name", () => {
    const violations: string[] = [];

    const applicationFiles = ["src/components", "src/pages"].flatMap((directory) =>
      tsxFiles(resolve(process.cwd(), directory)),
    );

    for (const file of applicationFiles) {
      const contents = readFileSync(file, "utf8");
      for (const match of contents.matchAll(/<Switch\b[\s\S]*?\/>/g)) {
        if (/aria-label\s*=/.test(match[0]) || /aria-labelledby\s*=/.test(match[0])) continue;
        const line = contents.slice(0, match.index).split("\n").length;
        violations.push(`${file}:${line}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("exposes names and relationships for shared field-editor controls", () => {
    const fields: SmartField[] = [
      { id: "source", label: "Source", type: "short_text", group: "Details" },
      {
        id: "documents",
        label: "Documents",
        type: "file",
        group: "Details",
        condition: { fieldId: "source", operator: "equals", value: "Referral" },
      },
    ];

    render(<FieldListEditor fields={fields} onChange={vi.fn()} context="lead" />);

    expect(screen.getByRole("textbox", { name: "Field 1 label" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Field type for Documents" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Required field: Documents" })).toBeInTheDocument();

    const options = screen.getByRole("button", { name: "Show options for Documents" });
    expect(options).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(options);

    expect(screen.getByRole("button", { name: "Hide options for Documents" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("textbox", { name: "Group / section" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Placeholder" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Help text" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Max size (MB)" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Accepted types" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Allow multiple files for Documents" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Condition field for Documents" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Condition operator for Documents" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Condition value for Documents" })).toBeInTheDocument();
  });

  it("associates every lead-form setting label with its control", () => {
    const editor = readFileSync(resolve(process.cwd(), "src/pages/LeadFormEditor.tsx"), "utf8");
    const controlIds = [
      "lead-form-name",
      "lead-form-slug",
      "lead-form-title",
      "lead-form-description",
      "lead-form-submit-label",
      "lead-form-redirect",
      "lead-form-success",
      "lead-form-live",
    ];

    for (const id of controlIds) {
      expect(editor).toContain(`htmlFor="${id}"`);
      expect(editor).toContain(`id="${id}"`);
    }
  });

  it("associates the AI form description with its textarea", () => {
    const dialog = readFileSync(resolve(process.cwd(), "src/components/forms/AiGenerateFieldsDialog.tsx"), "utf8");

    expect(dialog).toContain("<Label htmlFor={promptId}");
    expect(dialog).toContain("<Textarea\n              id={promptId}");
  });
});
