import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function readSource(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8").replace(/\r\n?/g, "\n");
}
