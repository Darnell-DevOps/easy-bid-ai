import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TimelineInput } from "@/components/TimelineInput";

const clientDetail = readFileSync(resolve(process.cwd(), "src/pages/ClientDetail.tsx"), "utf8");
const newClient = readFileSync(resolve(process.cwd(), "src/pages/NewClient.tsx"), "utf8");
const timelineSource = readFileSync(resolve(process.cwd(), "src/components/TimelineInput.tsx"), "utf8");

describe("client detail form accessibility", () => {
  it("associates each edit label with its control", () => {
    const controlIds = [
      "client-edit-name",
      "client-edit-email",
      "client-edit-phone",
      "client-edit-company",
      "client-edit-service",
      "client-edit-budget",
      "client-edit-timeline",
      "client-edit-project-description",
      "client-edit-goals",
    ];

    for (const id of controlIds) {
      expect(clientDetail).toContain(`htmlFor="${id}"`);
      expect(clientDetail).toContain(`id="${id}"`);
    }
  });

  it("uses contact input types and autocomplete hints", () => {
    expect(clientDetail).toContain('id="client-edit-name"');
    expect(clientDetail).toContain('autoComplete="name"');
    expect(clientDetail).toContain('type="email"');
    expect(clientDetail).toContain('autoComplete="email"');
    expect(clientDetail).toContain('type="tel"');
    expect(clientDetail).toContain('autoComplete="tel"');
    expect(clientDetail).toContain('autoComplete="organization"');
  });

  it("gives both timeline controls stable accessible names", () => {
    expect(timelineSource).toContain("const inputId = id ??");
    expect(timelineSource).toContain("id={inputId}");
    expect(timelineSource).toContain("id={unitId}");
    expect(timelineSource).toContain('aria-label="Timeline unit"');
    expect(timelineSource).toContain("aria-describedby={unparseableExisting ? noteId : undefined}");
    expect(clientDetail).toContain('id="client-edit-timeline"');
    expect(newClient).toContain('id="timeline"');
  });

  it("exposes the timeline amount and unit by name at runtime", () => {
    render(
      createElement(
        "div",
        null,
        createElement("label", { htmlFor: "test-timeline" }, "Timeline"),
        createElement(TimelineInput, { id: "test-timeline", value: "", onChange: () => undefined }),
      ),
    );

    expect(screen.getByRole("spinbutton", { name: "Timeline" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Timeline unit" })).toBeInTheDocument();
  });

  it("announces save activity and hides edit-action icons", () => {
    expect(clientDetail).toContain("aria-busy={savingEdit}");
    expect(clientDetail).toContain('<Pencil aria-hidden="true"');
    expect(clientDetail).toContain('<X aria-hidden="true"');
    expect(clientDetail).toContain('<Save aria-hidden="true"');
  });

  it("preserves the client update payload and query", () => {
    expect(clientDetail).toContain('const { error } = await supabase.from("clients").update(payload).eq("id", client.id)');
    expect(clientDetail).toContain("setClient({ ...client, ...payload } as ClientInfo)");
  });
});
