import { render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ChartDataTable } from "@/components/ui/chart-data-table";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("chart and table accessibility", () => {
  it("provides a named keyboard-scrollable table region and scoped headers", () => {
    render(
      <Table scrollLabel="Account results table">
        <TableCaption>Account results</TableCaption>
        <TableHeader>
          <TableRow><TableHead>Name</TableHead><TableHead>Status</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          <TableRow><TableCell>Acme</TableCell><TableCell>Active</TableCell></TableRow>
        </TableBody>
      </Table>,
    );

    const region = screen.getByRole("region", { name: "Account results table" });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("table", { name: "Account results" })).toBeInTheDocument();
    for (const header of screen.getAllByRole("columnheader")) {
      expect(header).toHaveAttribute("scope", "col");
    }
  });

  it("exposes chart values through an equivalent data table", () => {
    render(
      <ChartDataTable
        caption="Monthly revenue"
        labelHeader="Month"
        valueHeader="Revenue"
        rows={[{ label: "July", value: "£2,400" }, { label: "August", value: "£3,100" }]}
      />,
    );

    const table = screen.getByRole("table", { name: "Monthly revenue" });
    expect(within(table).getByRole("cell", { name: "July" })).toBeInTheDocument();
    expect(within(table).getByRole("cell", { name: "£2,400" })).toBeInTheDocument();
    for (const header of within(table).getAllByRole("columnheader")) {
      expect(header).toHaveAttribute("scope", "col");
    }
  });

  it("keeps every shared application table captioned and its scroll region named", () => {
    const files = [
      "src/pages/AdminDashboard.tsx",
      "src/pages/Clients.tsx",
      "src/pages/EmailsDashboard.tsx",
    ];

    for (const file of files) {
      const blocks = source(file).match(/<Table\b[\s\S]*?<\/Table>/g) ?? [];
      expect(blocks.length, file).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(block, file).toMatch(/^<Table\b[^>]*scrollLabel=/);
        expect(block, file).toContain("<TableCaption");
      }
    }
  });

  it("keeps raw data tables captioned with explicitly scoped column headers", () => {
    const files = [
      "src/pages/LeadInbox.tsx",
      "src/components/emails/SendingDomainsCard.tsx",
      "src/components/proposal/PremiumInvoiceRenderer.tsx",
      "src/components/proposal/PremiumPricingRenderer.tsx",
    ];

    for (const file of files) {
      const blocks = source(file).match(/<table\b[\s\S]*?<\/table>/g) ?? [];
      expect(blocks.length, file).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(block, file).toContain("<caption");
        const headers = block.match(/<th\b[^>]*>/g) ?? [];
        expect(headers.length, file).toBeGreaterThan(0);
        for (const header of headers) expect(header, file).toContain('scope="col"');
      }
    }

    const markdownProposal = source("src/components/proposal/PremiumProposalRenderer.tsx");
    expect(markdownProposal).toContain('<caption className="sr-only">Proposal pricing details.</caption>');
    expect(markdownProposal).toContain('<th scope="col"');
    expect(markdownProposal).toContain('aria-label="Proposal pricing table"');

    const generatedProposal = source("src/pages/ProposalView.tsx");
    expect(generatedProposal).toContain('role="region" aria-label="Proposal pricing table" tabindex="0"');
    expect(generatedProposal).toContain('<th scope="col">');
    expect(generatedProposal).toContain("Proposal pricing details.</caption>");
    expect(generatedProposal).toContain("overflow-x: auto;");
    expect(generatedProposal).toContain(".pricing-card:focus");
  });

  it("hides raw chart graphics and retains equivalent textual data", () => {
    const admin = source("src/pages/AdminDashboard.tsx");
    const revenue = source("src/pages/RevenueDashboard.tsx");

    expect(admin.match(/<div aria-hidden="true" className="h-full">/g)).toHaveLength(2);
    expect(admin.match(/<ChartDataTable/g)).toHaveLength(2);
    expect(revenue).toContain('<ChartContainer aria-hidden="true"');
    expect(revenue).toContain('<div aria-hidden="true" className="relative h-44">');
    expect(revenue).toContain("<ChartDataTable");
    expect(revenue).toContain('<ul aria-label="Revenue breakdown"');
  });
});
