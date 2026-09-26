import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AuthGuard from "@/components/AuthGuard";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getUser: vi.fn(),
  getLevel: vi.fn(),
  listFactors: vi.fn(),
  challengeAndVerify: vi.fn(),
  onAuthStateChange: vi.fn(),
  handleLostSession: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      getUser: mocks.getUser,
      onAuthStateChange: mocks.onAuthStateChange,
      mfa: {
        getAuthenticatorAssuranceLevel: mocks.getLevel,
        listFactors: mocks.listFactors,
        challengeAndVerify: mocks.challengeAndVerify,
      },
    },
  },
}));
vi.mock("@/lib/session-expiry", () => ({
  handleLostSession: mocks.handleLostSession,
  markSignedIn: vi.fn(),
}));
vi.mock("@/lib/logout", () => ({ performSignOut: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ data: { session: { access_token: "test" } }, error: null });
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  mocks.getLevel.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
  mocks.listFactors.mockResolvedValue({ data: { totp: [{ id: "factor-1", status: "verified" }] }, error: null });
  mocks.challengeAndVerify.mockResolvedValue({ data: {}, error: null });
  mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
});

function renderGuard() {
  render(<MemoryRouter><AuthGuard><p>Private workspace</p></AuthGuard></MemoryRouter>);
}

describe("authenticated MFA gate", () => {
  it("keeps the workspace hidden until the enrolled authenticator is verified", async () => {
    mocks.getLevel
      .mockResolvedValueOnce({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null })
      .mockResolvedValueOnce({ data: { currentLevel: "aal2", nextLevel: "aal2" }, error: null });
    renderGuard();
    expect(await screen.findByRole("heading", { name: "Verify your sign-in" })).toBeInTheDocument();
    expect(screen.queryByText("Private workspace")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Authenticator code"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify and continue" }));
    await waitFor(() => expect(screen.getByText("Private workspace")).toBeInTheDocument());
    expect(mocks.challengeAndVerify).toHaveBeenCalledWith({ factorId: "factor-1", code: "123456" });
  });

  it("fails closed when the assurance level cannot be checked", async () => {
    mocks.getLevel.mockResolvedValue({ data: null, error: new Error("offline") });
    renderGuard();
    expect(await screen.findByRole("alert")).toHaveTextContent("couldn't check your sign-in security");
    expect(screen.queryByText("Private workspace")).not.toBeInTheDocument();
  });

  it("requires the factor when an older token has no current assurance level", async () => {
    mocks.getLevel.mockResolvedValue({ data: { currentLevel: null, nextLevel: "aal2" }, error: null });
    renderGuard();
    expect(await screen.findByRole("heading", { name: "Verify your sign-in" })).toBeInTheDocument();
    expect(screen.queryByText("Private workspace")).not.toBeInTheDocument();
  });

  it("does not redirect during an initial auth event while the session check is pending", async () => {
    let finishSession: (value: unknown) => void = () => {};
    mocks.getSession.mockReturnValue(new Promise((resolve) => { finishSession = resolve; }));
    mocks.onAuthStateChange.mockImplementation((callback) => {
      callback("INITIAL_SESSION", null);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    renderGuard();
    expect(mocks.handleLostSession).not.toHaveBeenCalled();
    finishSession({ data: { session: { access_token: "test" } }, error: null });
    expect(await screen.findByRole("heading", { name: "Verify your sign-in" })).toBeInTheDocument();
    expect(mocks.handleLostSession).not.toHaveBeenCalled();
  });
});
