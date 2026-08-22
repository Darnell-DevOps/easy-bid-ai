import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/calendar/DeadlinesPanel.tsx"), "utf8");

describe("Deadlines panel form accessibility", () => {
  it("associates every deadline field label with its control", () => {
    const controlIds = [
      "deadline-title",
      "deadline-due-date",
      "deadline-priority",
      "deadline-client",
      "deadline-proposal",
      "deadline-contract",
      "deadline-notes",
    ];

    for (const id of controlIds) {
      expect(source).toContain(`htmlFor="${id}"`);
      expect(source).toContain(`id="${id}"`);
    }

    expect(source).not.toMatch(/<Label(?![^>]*htmlFor)[^>]*>/);
  });

  it("describes the dialog and exposes its required fields", () => {
    expect(source).toContain("<DialogDescription>");
    expect(source).toMatch(/id="deadline-title"[\s\S]*?maxLength=\{200\}[\s\S]*?required/);
    expect(source).toMatch(/id="deadline-due-date"[\s\S]*?type="date"[\s\S]*?required/);
  });

  it("preserves deadline validation and persistence", () => {
    expect(source).toContain('toast({ title: "Title required", variant: "destructive" })');
    expect(source).toContain('toast({ title: "Due date required", variant: "destructive" })');
    expect(source).toContain('client_id: form.client_id === "none" ? null : form.client_id');
    expect(source).toContain('proposal_id: form.proposal_id === "none" ? null : form.proposal_id');
    expect(source).toContain('contract_id: form.contract_id === "none" ? null : form.contract_id');
    expect(source).toContain("client_visible: form.client_visible");
    expect(source).toContain('supabase.from("deadlines").update(payload).eq("id", editing.id)');
    expect(source).toContain('supabase.from("deadlines").insert(payload)');
  });
});
