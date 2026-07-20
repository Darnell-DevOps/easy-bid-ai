import { describe, expect, it } from "vitest";
import {
  formUploadDownloadName,
  normalizeFormUploadType,
  safeUploadName,
} from "../../supabase/functions/_shared/form-upload-policy.ts";

describe("form upload policy", () => {
  it.each([
    ["photo.png", "image/png"],
    ["photo.JPEG", "image/jpeg"],
    ["brief.pdf", "application/pdf"],
    ["copy.txt", "text/plain"],
    ["leads.csv", "text/csv"],
    ["sheet.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["archive.zip", "application/zip"],
  ])("allows supported file %s with %s", (filename, contentType) => {
    expect(normalizeFormUploadType(filename, contentType)).toBe(contentType);
  });

  it.each([
    ["attack.svg", "image/svg+xml"],
    ["attack.html", "text/html"],
    ["attack.xhtml", "application/xhtml+xml"],
    ["attack.svg", "text/plain"],
    ["attack.html.png", "text/html"],
    ["no-extension", "image/png"],
    ["script.png", "application/javascript"],
  ])("blocks active, mismatched, or unknown upload %s with %s", (filename, contentType) => {
    expect(normalizeFormUploadType(filename, contentType)).toBeNull();
  });

  it("normalizes safe path segments without allowing traversal", () => {
    expect(safeUploadName("../../client brief.pdf")).toBe(".._.._client_brief.pdf");
    expect(safeUploadName("..", "field")).toBe("field");
  });

  it("returns an attachment-safe original filename for signed reads", () => {
    expect(formUploadDownloadName(
      "user/onboarding/form/field/123e4567-e89b-12d3-a456-426614174000-client brief.pdf",
    )).toBe("client_brief.pdf");
    expect(formUploadDownloadName("user/form/..")).toBe("download");
  });
});
