import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// MoatMine is risk control and information, not advice: no UI copy may promise safety or returns.
const FORBIDDEN = /\b(guaranteed|risk-free|no[- ]risk|safe (investment|bet|returns?)|can'?t lose)\b/i;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe("UI copy", () => {
  it("never describes an investment or its returns as safe or guaranteed", () => {
    const offending = sourceFiles(join(__dirname))
      .flatMap((file) => readFileSync(file, "utf8").split("\n").map((line, i) => ({ file, line: i + 1, text: line })))
      .filter(({ text }) => FORBIDDEN.test(text));
    expect(offending).toEqual([]);
  });
});
