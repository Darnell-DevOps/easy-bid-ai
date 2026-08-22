import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  getSession: vi.fn(),
  unsubscribe: vi.fn(),
  signInWithOAuth: vi.fn(),
  toast: vi.fn(),
  track: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
      resetPasswordForEmail: mocks.resetPasswordForEmail,
      updateUser: mocks.updateUser,
      onAuthStateChange: mocks.onAuthStateChange,
      getSession: mocks.getSession,
    },
  },
}));

vi.mock("@/integrations/lovable/index", () => ({
  lovable: { auth: { signInWithOAuth: mocks.signInWithOAuth } },
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/lib/landing-analytics", () => ({ track: mocks.track }));
vi.mock("@/lib/email", () => ({ sendEmail: mocks.sendEmail }));
vi.mock("@/lib/auth-captcha", () => ({ isAuthCaptchaConfigured: () => false }));
vi.mock("@/components/auth/AuthCaptcha", async () => {
  const { forwardRef } = await import("react");
  return { default: forwardRef(function MockAuthCaptcha() { return null; }) };
});
vi.mock("@/components/PageMeta", () => ({ default: () => null }));

import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";

describe("authentication error accessibility", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    window.sessionStorage.clear();
    mocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mocks.unsubscribe } },
    });
    mocks.getSession.mockResolvedValue({ data: { session: null } });
  });

  it("announces and focuses a persistent sign-in failure", async () => {
    mocks.signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    render(<MemoryRouter initialEntries={["/login"]}><Login /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "incorrect-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Sign-in failed. Invalid login credentials");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByRole("button", { name: "Sign in" }).closest("form"))
      .toHaveAttribute("aria-describedby", "login-auth-error");
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("announces session expiry once through the persistent page status", () => {
    render(<MemoryRouter initialEntries={["/login?expired=1"]}><Login /></MemoryRouter>);

    const statuses = screen.getAllByRole("status");
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toHaveTextContent("Your session expired and you were signed out for security");
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("announces successful sign-out once through the persistent page status", () => {
    window.sessionStorage.setItem("show_signed_out_notice", "1");
    render(<MemoryRouter initialEntries={["/login"]}><Login /></MemoryRouter>);

    const statuses = screen.getAllByRole("status");
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toHaveTextContent("You have been signed out successfully");
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("announces and focuses a persistent account-creation failure", async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: null },
      error: { message: "Email rate limit exceeded" },
    });
    render(<MemoryRouter initialEntries={["/signup"]}><Signup /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Alex Morgan" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alex@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secure-pass-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Account creation failed. Email rate limit exceeded");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByRole("button", { name: "Create account" }).closest("form"))
      .toHaveAttribute("aria-describedby", "signup-auth-error");
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("announces and focuses a persistent reset-request failure", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: { message: "Too many reset attempts" } });
    render(<MemoryRouter initialEntries={["/forgot-password"]}><ForgotPassword /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Reset request failed. Too many reset attempts");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByRole("button", { name: "Send reset link" }).closest("form"))
      .toHaveAttribute("aria-describedby", "forgot-password-error");
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("announces and focuses the generic reset-request success state", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
    render(<MemoryRouter initialEntries={["/forgot-password"]}><ForgotPassword /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "person@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent("If an account exists for person@example.com");
    await waitFor(() => expect(status).toHaveFocus());
    expect(screen.queryByRole("button", { name: "Send reset link" })).not.toBeInTheDocument();
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("validates a recovery session before announcing an invalid reset link", async () => {
    render(<MemoryRouter initialEntries={["/reset-password"]}><ResetPassword /></MemoryRouter>);

    expect(screen.getByRole("status")).toHaveTextContent("Checking your password reset link");
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This password reset link is invalid or has expired");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("announces and focuses a persistent password-update failure", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "user-1" } } } });
    mocks.updateUser.mockResolvedValue({ error: { message: "Recovery session expired" } });
    render(<MemoryRouter initialEntries={["/reset-password"]}><ResetPassword /></MemoryRouter>);

    const password = await screen.findByLabelText("New password");
    fireEvent.change(password, { target: { value: "secure-pass-123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "secure-pass-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Password update failed. Recovery session expired");
    await waitFor(() => expect(alert).toHaveFocus());
    expect(screen.getByRole("button", { name: "Update password" }).closest("form"))
      .toHaveAttribute("aria-describedby", "reset-password-error");
    expect(mocks.toast).not.toHaveBeenCalled();
  });
});
