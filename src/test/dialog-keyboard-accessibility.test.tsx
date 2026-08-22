import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { useRef, useState } from "react";
import { Link, MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import RouteAccessibility from "@/components/RouteAccessibility";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.isFile() && entry.name.endsWith(".tsx") ? [path] : [];
  });
}

function NavigationSheetHarness() {
  const [open, setOpen] = useState(false);
  const routeClose = useRef(false);
  const location = useLocation();

  const closeForRoute = (href: string) => {
    routeClose.current = href !== location.pathname;
    setOpen(false);
  };

  return (
    <>
      <RouteAccessibility />
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild><Button>Open mobile navigation</Button></SheetTrigger>
        <SheetContent
          onCloseAutoFocus={(event) => {
            if (!routeClose.current) return;
            event.preventDefault();
            routeClose.current = false;
          }}
        >
          <SheetTitle>Mobile navigation</SheetTitle>
          <SheetDescription>Choose a destination.</SheetDescription>
          <Link to="/start" onClick={() => closeForRoute("/start")}>Stay on start</Link>
          <Link to="/destination" onClick={() => closeForRoute("/destination")}>Go to destination</Link>
        </SheetContent>
      </Sheet>
      <Routes>
        <Route path="/start" element={<main><h1>Start</h1></main>} />
        <Route path="/destination" element={<main><h1>Destination</h1></main>} />
      </Routes>
    </>
  );
}

describe("dialog and menu keyboard accessibility", () => {
  it("opens a labelled modal sheet, closes it with Escape, and returns trigger focus", async () => {
    render(
      <Sheet>
        <SheetTrigger asChild>
          <Button>Open navigation</Button>
        </SheetTrigger>
        <SheetContent>
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>Choose a destination.</SheetDescription>
          <Button>First destination</Button>
        </SheetContent>
      </Sheet>,
    );

    const trigger = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(trigger);
    expect(await screen.findByRole("dialog", { name: "Navigation" })).toBeVisible();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Navigation" })).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it("uses the focus-managed sheet for dashboard mobile navigation", () => {
    const layout = source("src/components/DashboardLayout.tsx");

    expect(layout).toContain("mobileNavigationRouteClose.current = href !== location.pathname");
    expect(layout).toContain("onCloseAutoFocus={(event) => {");
    expect(layout).toContain("<SheetTrigger asChild>");
    expect(layout).toContain('aria-label="Open dashboard navigation"');
    expect(layout).toContain('id="dashboard-mobile-navigation"');
    expect(layout).toContain('<SheetTitle className="sr-only">Dashboard navigation</SheetTitle>');
    expect(layout).not.toContain("{mobileOpen && (");
  });

  it("lets route focus win when a mobile navigation link closes the sheet", async () => {
    render(
      <MemoryRouter initialEntries={["/start"]}>
        <NavigationSheetHarness />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open mobile navigation" }));
    fireEvent.click(await screen.findByRole("link", { name: "Go to destination" }));

    const heading = await screen.findByRole("heading", { level: 1, name: "Destination" });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it("returns focus to the trigger when the mobile link keeps the current route", async () => {
    render(
      <MemoryRouter initialEntries={["/start"]}>
        <NavigationSheetHarness />
      </MemoryRouter>,
    );

    const trigger = screen.getByRole("button", { name: "Open mobile navigation" });
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("link", { name: "Stay on start" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Mobile navigation" })).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  it("keeps reusable command and sidebar sheets programmatically named", () => {
    const command = source("src/components/ui/command.tsx");
    const sidebar = source("src/components/ui/sidebar.tsx");
    const dialog = source("src/components/ui/dialog.tsx");
    const sheet = source("src/components/ui/sheet.tsx");

    expect(command).toContain('<DialogTitle className="sr-only">Command menu</DialogTitle>');
    expect(command).toContain('<DialogDescription className="sr-only">');
    expect(sidebar).toContain('<SheetTitle className="sr-only">Application navigation</SheetTitle>');
    expect(sidebar).toContain('<SheetDescription className="sr-only">');
    expect(dialog).toContain('<X aria-hidden="true"');
    expect(sheet).toContain('<X aria-hidden="true"');
  });

  it("keeps every shared dialog and sheet programmatically titled", () => {
    const missing: string[] = [];
    const pairs = [
      ["DialogContent", "DialogTitle"],
      ["AlertDialogContent", "AlertDialogTitle"],
      ["SheetContent", "SheetTitle"],
    ] as const;

    for (const path of [...tsxFiles(resolve(process.cwd(), "src/pages")), ...tsxFiles(resolve(process.cwd(), "src/components"))]) {
      const content = readFileSync(path, "utf8");
      for (const [contentName, titleName] of pairs) {
        const blocks = content.match(new RegExp(`<${contentName}\\b[\\s\\S]*?</${contentName}>`, "g")) ?? [];
        for (const block of blocks) {
          if (!new RegExp(`<${titleName}\\b`).test(block)) missing.push(`${path}: ${contentName}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});
