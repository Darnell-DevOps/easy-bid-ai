import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Rgb = [number, number, number];

const styles = readFileSync(resolve(process.cwd(), "src/index.css"), "utf8");

function themeBlock(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`));
  expect(match, `Missing ${selector} theme block`).not.toBeNull();
  return match?.[1] ?? "";
}

function hslVariable(block: string, name: string): Rgb {
  const match = block.match(new RegExp(`--${name}:\\s*(\\d+(?:\\.\\d+)?)\\s+(\\d+(?:\\.\\d+)?)%\\s+(\\d+(?:\\.\\d+)?)%`));
  expect(match, `Missing --${name} colour token`).not.toBeNull();

  const hue = Number(match?.[1] ?? 0);
  const saturation = Number(match?.[2] ?? 0) / 100;
  const lightness = Number(match?.[3] ?? 0) / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const offset = lightness - chroma / 2;
  const sector = Math.floor(hue / 60) % 6;
  const channels: Rgb[] = [
    [chroma, x, 0], [x, chroma, 0], [0, chroma, x],
    [0, x, chroma], [x, 0, chroma], [chroma, 0, x],
  ];
  return channels[sector].map((value) => (value + offset) * 255) as Rgb;
}

function contrast(first: Rgb, second: Rgb) {
  const luminance = (rgb: Rgb) => {
    const values = rgb.map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
  };
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05)
    / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

describe("theme colour contrast", () => {
  for (const selector of [":root", ".dark", ".light", ".landing-shell"]) {
    it(`${selector} keeps accent controls at WCAG AA contrast`, () => {
      const block = themeBlock(selector);
      expect(contrast(hslVariable(block, "accent"), hslVariable(block, "accent-foreground")))
        .toBeGreaterThanOrEqual(4.5);
    });
  }

  for (const selector of [":root", ".dark"]) {
    it(`${selector} keeps accent-coloured small text readable`, () => {
      const block = themeBlock(selector);
      const accent = hslVariable(block, "accent");
      expect(contrast(accent, hslVariable(block, "background"))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(accent, hslVariable(block, "card"))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(
        hslVariable(block, "sidebar-primary"),
        hslVariable(block, "sidebar-primary-foreground"),
      )).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("provides forced-colours focus and gradient-text fallbacks", () => {
    expect(styles).toContain("@media (forced-colors: active)");
    expect(styles).toContain("outline: 2px solid Highlight !important");
    expect(styles).toContain("box-shadow: none !important");
    expect(styles).toContain("-webkit-text-fill-color: CanvasText !important");
  });
});
