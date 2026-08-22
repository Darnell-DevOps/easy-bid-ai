import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  Toast,
  ToastClose,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

describe("toast accessibility", () => {
  it("gives the notification dismiss control an accessible name", () => {
    render(
      <ToastProvider>
        <Toast open>
          <ToastTitle>Login failed</ToastTitle>
          <ToastClose />
        </Toast>
        <ToastViewport />
      </ToastProvider>,
    );

    expect(screen.getByRole("button", { name: "Close notification" })).toBeInTheDocument();
  });

  it("mounts one notification system and keeps policy and recovery pages on it", () => {
    const app = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
    const migratedPages = [
      "src/pages/Policies.tsx",
      "src/pages/NewPolicy.tsx",
      "src/pages/PolicyView.tsx",
      "src/pages/RecoveryDashboard.tsx",
    ];

    expect(app).toContain("<Toaster />");
    expect(app).not.toContain("<Sonner />");
    expect(app).not.toContain("components/ui/sonner");
    for (const path of migratedPages) {
      const source = readFileSync(resolve(process.cwd(), path), "utf8");
      expect(source, path).toContain('from "@/hooks/use-toast"');
      expect(source, path).not.toContain('from "sonner"');
    }
  });
});
