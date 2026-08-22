import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/settings/DataExportsSettings.tsx"), "utf8");

describe("Data exports settings accessibility", () => {
  it("labels and describes delivery and retention Select controls", () => {
    expect(source).toContain('htmlFor="data-export-delivery"');
    expect(source).toContain('id="data-export-delivery" aria-describedby="data-export-delivery-help"');
    expect(source).toContain('id="data-export-delivery-help"');

    expect(source).toContain('htmlFor="data-retention-period"');
    expect(source).toContain('id="data-retention-period"');
    expect(source).toContain('"data-retention-help data-retention-warning"');
    expect(source).toContain('id="data-retention-warning"');
    expect(source).toContain('aria-busy={retentionSaving}');
  });

  it("associates both deletion-confirmation labels with secure inputs", () => {
    expect(source).toContain('htmlFor="delete-account-password"');
    expect(source).toContain('id="delete-account-password"');
    expect(source).toContain('autoComplete="current-password"');
    expect(source).toContain('htmlFor="delete-account-confirmation"');
    expect(source).toContain('id="delete-account-confirmation"');
    expect(source).toContain('autoComplete="off"');
    expect(source).toContain('spellCheck={false}');
    expect(source).not.toMatch(/<Label(?![^>]*htmlFor)[^>]*>/);
  });

  it("announces deletion progress while preserving its confirmation guard", () => {
    expect(source).toContain('disabled={confirmText !== "DELETE" || !password || deleting}');
    expect(source).toContain('aria-busy={deleting}');
    expect(source).toContain('if (confirmText !== "DELETE") return');
    expect(source).toContain("supabase.auth.signInWithPassword({");
    expect(source).toContain("password,");
  });

  it("preserves schedule and retention persistence plus earlier semantics", () => {
    expect(source).toContain("localStorage.setItem(LS_SCHEDULE, JSON.stringify(schedule))");
    expect(source).toContain('.upsert({ user_id: user.id, trash_retention_days: parseInt(v, 10) }, { onConflict: "user_id" })');
    expect(source).toContain('aria-label="Weekly backup export"');
    expect(source).toContain('aria-label="Monthly backup export"');
    expect(source).toContain('aria-label="Storage usage"');
  });
});
