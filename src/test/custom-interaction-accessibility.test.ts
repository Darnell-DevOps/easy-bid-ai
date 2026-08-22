import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import type { KeyboardEvent } from "react";
import * as ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { activateOnEnterOrSpace } from "@/lib/keyboard";

const CUSTOM_CLICK_TARGETS = new Set([
  "Card",
  "article",
  "div",
  "li",
  "section",
  "span",
  "tr",
]);

function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    return entry.isDirectory() ? tsxFiles(path) : entry.name.endsWith(".tsx") ? [path] : [];
  });
}

function keyboardEvent(key: string, target: object, currentTarget = target) {
  return {
    key,
    target,
    currentTarget,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent<HTMLElement>;
}

type JsxOpening = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

function attributeNames(node: JsxOpening, sourceFile: ts.SourceFile) {
  return new Set(
    node.attributes.properties
      .filter(ts.isJsxAttribute)
      .map((attribute) => attribute.name.getText(sourceFile)),
  );
}

function hasValidKeyboardProxy(root: ts.Node, sourceFile: ts.SourceFile) {
  let valid = false;

  function visit(node: ts.Node) {
    if (valid) return;

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      const attributes = attributeNames(node, sourceFile);
      const opening = node.getText(sourceFile);

      if (
        (tagName === "button" || tagName === "Button") &&
        attributes.has("data-keyboard-proxy") &&
        attributes.has("aria-label") &&
        attributes.has("onClick") &&
        (tagName === "Button" || opening.includes("focus-visible:"))
      ) {
        valid = true;
        return;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(root);
  return valid;
}

describe("custom interactive surface accessibility", () => {
  it.each(["Enter", " "])("activates a focused surface with %j", (key) => {
    const target = {};
    const event = keyboardEvent(key, target);
    const action = vi.fn();

    activateOnEnterOrSpace(event, action);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(action).toHaveBeenCalledOnce();
  });

  it("ignores unrelated keys and keyboard events from nested controls", () => {
    const action = vi.fn();
    const unrelatedKey = keyboardEvent("Escape", {});
    const nestedControl = keyboardEvent("Enter", {}, {});

    activateOnEnterOrSpace(unrelatedKey, action);
    activateOnEnterOrSpace(nestedControl, action);

    expect(unrelatedKey.preventDefault).not.toHaveBeenCalled();
    expect(nestedControl.preventDefault).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
  });

  it("keeps custom click targets named, focusable, keyboard operable, and visibly focused", () => {
    const srcRoot = resolve(process.cwd(), "src");
    const violations: string[] = [];

    for (const file of tsxFiles(srcRoot)) {
      const contents = readFileSync(file, "utf8");
      const sourceFile = ts.createSourceFile(file, contents, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

      function visit(node: ts.Node) {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          const tagName = node.tagName.getText(sourceFile);
          const opening = node.getText(sourceFile);
          const attributes = attributeNames(node, sourceFile);

          if (
            CUSTOM_CLICK_TARGETS.has(tagName) &&
            attributes.has("onClick") &&
            opening.includes("cursor-pointer")
          ) {
            const usesProxy = attributes.has("data-keyboard-proxy");
            const missing = usesProxy
              ? hasValidKeyboardProxy(node.parent, sourceFile)
                ? []
                : ["valid keyboard proxy"]
              : ["aria-label", "role", "tabIndex", "onKeyDown"].filter(
                  (attribute) => !attributes.has(attribute),
                );

            if (!usesProxy && !opening.includes("focus-visible:")) {
              missing.push("focus-visible style");
            }

            if (missing.length > 0) {
              const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
              violations.push(`${relative(process.cwd(), file)}:${line} missing ${missing.join(", ")}`);
            }
          }
        }

        ts.forEachChild(node, visit);
      }

      visit(sourceFile);
    }

    expect(violations).toEqual([]);
  }, 15_000);
});
