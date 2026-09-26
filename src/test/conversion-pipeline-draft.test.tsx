import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ConversionPipeline from "@/components/dashboard/ConversionPipeline";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        is: () => ({ in: async () => ({ data: [] }) }),
      }),
    }),
  },
}));

describe("conversion pipeline with work in progress", () => {
  it("shows a linked draft proposal in the proposal stage instead of a first-lead prompt", () => {
    render(
      <MemoryRouter>
        <ConversionPipeline
          proposals={[{ status: "draft", client_paid: false }]}
          clients={[{ id: "client-1", status: "New", lead_score: null }]}
          proposalClientIds={new Set(["client-1"])}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByText("Start your first client journey")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1 proposal/i })).toBeInTheDocument();
  });
});
