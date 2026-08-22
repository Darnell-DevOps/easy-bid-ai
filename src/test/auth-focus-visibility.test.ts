import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const authPages = [
  "src/pages/Login.tsx",
  "src/pages/Signup.tsx",
  "src/pages/ForgotPassword.tsx",
  "src/pages/ResetPassword.tsx",
];

describe("authentication focus visibility", () => {
  it("gives every raw authentication link and button a consistent focus-visible ring", () => {
    for (const path of authPages) {
      const source = readFileSync(resolve(process.cwd(), path), "utf8");
      const controls = [...source.matchAll(/<(?:Link|a|button)\b[^>]*className="([^"]+)"[^>]*>/g)];

      expect(controls.length, path).toBeGreaterThan(0);
      for (const [, className] of controls) {
        expect(className, path).toContain("focus-visible:outline-none");
        expect(className, path).toContain("focus-visible:ring-2");
        expect(className, path).toContain("focus-visible:ring-ring");
        expect(className, path).toContain("focus-visible:ring-offset-2");
      }
    }
  });
});
