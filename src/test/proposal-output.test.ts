import { describe, expect, it } from "vitest";
import { parseProposalJson, PROPOSAL_HEADINGS, validateProposalOutput, validateProposalSection } from "../../supabase/functions/_shared/proposal-output";

const totals = { subtotalCents: 10000, taxAmountCents: 2000, totalCents: 12000 };
const table = "| Item | Description | Cost |\n| --- | --- | --- |\n| Design | Agreed scope | £100.00 |\n| Subtotal | | £100.00 |\n| Tax (20%) | | £20.00 |\n| Total | | £120.00 |";
const nextSteps = ["Accept this proposal", "Complete onboarding"];
const proposal = PROPOSAL_HEADINGS.map(heading => `## ${heading}\n${heading === "Investment" ? "Total investment: £120.00" : heading === "Next Steps" ? nextSteps.map(step => `- ${step}`).join("\n") : "Agreed project details and deliverables."}`).join("\n\n");
const valid = { proposal, pricing: table, invoice: `Draft invoice\n${table}` };

describe("AI document output validation", () => {
  it("accepts a complete proposal with reconciled commercial figures", () => {
    expect(validateProposalOutput(valid,"GBP",totals,nextSteps)).toEqual(valid);
  });
  it("accepts ordinary Markdown blank lines and Windows newlines without weakening journey checks", () => {
    const section = `## Next Steps\r\n\r\n${nextSteps.map(step => `- ${step}`).join("\r\n\r\n")}`;
    expect(validateProposalSection({ section },"Next Steps",nextSteps).section).toContain("- Complete onboarding");
  });
  it("accepts a JSON code fence but rejects raw prose and non-object JSON", () => {
    expect(parseProposalJson('```json\n{"section":"## Scope of Work\\nAgreed deliverables."}\n```')).toHaveProperty("section");
    for (const content of ["AI wrote a proposal", "[]", "null", "{broken"]) expect(() => parseProposalJson(content)).toThrow();
  });
  it.each(["proposal","pricing","invoice"])("rejects missing %s without a success fallback", key => {
    expect(() => validateProposalOutput({ ...valid, [key]: "" },"GBP",totals,nextSteps)).toThrow();
  });
  it.each([
    table.replace("£120.00","£121.00"),
    table.replace("£20.00","£2.00"),
    table.replace("Agreed scope | £100.00","Agreed scope | £99.00"),
    table.replaceAll("£","$"),
    table.replace("| Subtotal | | £100.00 |\n",""),
    table + "\n| Total | | £120.00 |",
  ])("rejects contradictory, incomplete or mixed-currency figures", pricing => {
    expect(() => validateProposalOutput({ ...valid, pricing },"GBP",totals,nextSteps)).toThrow();
  });
  it("checks invoice figures independently", () => {
    expect(() => validateProposalOutput({ ...valid, invoice: table.replace("£120.00","£110.00") },"GBP",totals,nextSteps)).toThrow();
  });
  it("rejects missing sections, unconfigured investment and shortened journeys", () => {
    for (const value of [proposal.replace("## Timeline","## Unknown"), proposal.replace("£120.00","£999.00"), proposal.replace("- Complete onboarding","- Work begins")]) {
      expect(() => validateProposalOutput({ ...valid, proposal: value },"GBP",totals,nextSteps)).toThrow();
    }
  });
  it("does not accept empty sections or additional regenerated sections", () => {
    expect(() => validateProposalSection({ section: "## Timeline" },"Timeline")).toThrow();
    expect(() => validateProposalSection({ section: "## Timeline\nDetails\n## Investment\n£99" },"Timeline")).toThrow();
  });
});
