import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getAuthorizationDetails: vi.fn(),
  approveAuthorization: vi.fn(),
  denyAuthorization: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      oauth: {
        getAuthorizationDetails: mocks.getAuthorizationDetails,
        approveAuthorization: mocks.approveAuthorization,
        denyAuthorization: mocks.denyAuthorization,
      },
    },
  },
}));

vi.mock("@/components/PageMeta", () => ({ default: () => null }));

import OAuthConsent from "@/pages/OAuthConsent";

const authorizationDetails = {
  client: { name: "Test CRM" },
  redirect_url: null,
  redirect_to: null,
};

function renderConsent() {
  return render(
    <MemoryRouter initialEntries={["/.lovable/oauth/consent?authorization_id=request-1"]}>
      <OAuthConsent />
    </MemoryRouter>,
  );
}

describe("OAuth consent accessibility", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } });
  });

  it("focuses a loading failure and lets the user retry the request", async () => {
    mocks.getAuthorizationDetails
      .mockResolvedValueOnce({ data: null, error: { message: "Request temporarily unavailable" } })
      .mockResolvedValueOnce({ data: authorizationDetails, error: null });
    renderConsent();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not load this request");
    await waitFor(() => expect(alert).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Retry loading request" }));

    expect(await screen.findByRole("heading", { name: "Connect Test CRM to your account" })).toBeInTheDocument();
    expect(mocks.getAuthorizationDetails).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps both decisions available after focusing an approval failure", async () => {
    mocks.getAuthorizationDetails.mockResolvedValue({ data: authorizationDetails, error: null });
    mocks.approveAuthorization.mockResolvedValue({
      data: null,
      error: { message: "The authorization server did not respond" },
    });
    renderConsent();

    fireEvent.click(await screen.findByRole("button", { name: "Approve access" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Authorization decision failed. The authorization server did not respond",
    );
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByRole("button", { name: "Approve access" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Deny" })).toBeEnabled();
  });
});
