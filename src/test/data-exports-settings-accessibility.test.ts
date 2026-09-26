import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/components/settings/DataExportsSettings.tsx"), "utf8");

describe("data export settings", () => {
  it("paginates workspace exports beyond the default API page and labels their scope", () => {
    expect(source).toContain('.range(offset, offset + pageSize - 1)');
    expect(source).toContain('if (page.length < pageSize) break');
    expect(source).toContain('Files, authentication records and other account data are not included.');
    expect(source).not.toContain('.limit(5000)');
    expect(source).not.toContain('Download full export');
  });

  it("retains the working Trash control with a labelled and announced save state", () => {
    expect(source).toContain('htmlFor="data-retention-period"');
    expect(source).toContain('id="data-retention-period"');
    expect(source).toContain('aria-busy={retentionSaving}');
    expect(source).toContain('trash_retention_days: Number(next)');
  });

  it("removes fabricated backup, activity and account-deletion confirmations", () => {
    expect(source).not.toContain("Scheduled backups");
    expect(source).not.toContain("downloadActivityLog");
    expect(source).not.toContain("Deletion requested");
    expect(source).toContain('Email a deletion request');
  });
});
