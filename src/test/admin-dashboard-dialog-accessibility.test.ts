import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/pages/AdminDashboard.tsx"), "utf8");

describe("Admin dashboard dialog accessibility", () => {
  it("associates each admin dialog label with its input", () => {
    const controlIds = [
      "admin-edit-email",
      "admin-edit-full-name",
      "admin-edit-business-name",
      "admin-delete-confirm-email",
    ];

    for (const id of controlIds) {
      expect(source).toContain(`htmlFor="${id}"`);
      expect(source).toContain(`id="${id}"`);
    }
  });

  it("provides appropriate field names and autocomplete hints", () => {
    expect(source).toContain('type="search"\n                  aria-label="Search users by email"');
    expect(source).toContain('id="admin-edit-email"\n                type="email"\n                autoComplete="email"');
    expect(source).toContain('id="admin-edit-full-name"\n                autoComplete="name"');
    expect(source).toContain('id="admin-edit-business-name"\n                autoComplete="organization"');
    expect(source).toContain('id="admin-delete-confirm-email"\n              type="email"');
  });

  it("announces loading for search, save, and permanent deletion", () => {
    expect(source).toContain('disabled={loadingUsers} aria-busy={loadingUsers}');
    expect(source).toContain('disabled={editBusy} aria-busy={editBusy}');
    expect(source).toContain('aria-busy={deleteBusy}');
  });

  it("preserves the existing admin update and deletion workflows", () => {
    expect(source).toContain('supabase.functions.invoke("admin-manage-user", { body: payload })');
    expect(source).toContain('action: "update_profile"');
    expect(source).toContain('email: editEmail !== editUser.email ? editEmail : undefined');
    expect(source).toContain('full_name: editFullName');
    expect(source).toContain('business_name: editBusinessName || undefined');
    expect(source).toContain('action: "delete"');
    expect(source).toContain('deleteConfirm.trim() !== (deleteUser?.email ?? "").trim()');
  });
});
