import { describe, expect, it } from "vitest";
import { completedCount, isComplete, parseProgress, passMark, recordScore } from "./progress";
import { text, type LearnModule } from "./types";

const q = { prompt: text("q", "ש"), options: [text("a", "א")], answer: 0, explanation: text("e", "ה") };
const moduleWith = (id: string, questions: number): LearnModule => ({
  id, title: text("t", "כ"), summary: text("s", "ס"), lessons: [], quiz: Array.from({ length: questions }, () => q),
});

describe("passMark", () => {
  it.each([[3, 2], [4, 3], [1, 1], [6, 4]])("needs two thirds of %i questions, rounded up (%i)", (questions, need) => {
    expect(passMark(moduleWith("m", questions))).toBe(need);
  });
});

describe("isComplete / completedCount", () => {
  const modules = [moduleWith("a", 3), moduleWith("b", 3), moduleWith("c", 3)];

  it.each([
    [{}, false],
    [{ a: 1 }, false],
    [{ a: 2 }, true],
    [{ a: 3 }, true],
  ])("module a with progress %j is complete: %s", (progress, expected) => {
    expect(isComplete(moduleWith("a", 3), progress)).toBe(expected);
  });

  it("counts only the modules at or above their pass mark", () => {
    expect(completedCount(modules, { a: 3, b: 1, c: 2 })).toBe(2);
  });
});

describe("parseProgress", () => {
  it.each([
    [null, {}],
    ["", {}],
    ["not json", {}],
    ["[1,2]", {}],
    ["3", {}],
    ["null", {}],
    ['{"a":2,"b":"x","c":-1,"d":1.5}', { a: 2 }],
    ['{"a":0,"b":3}', { a: 0, b: 3 }],
  ])("reads %j as %j", (raw, expected) => {
    expect(parseProgress(raw)).toEqual(expected);
  });
});

describe("recordScore", () => {
  it.each([
    [{}, 2, { m: 2 }],
    [{ m: 1 }, 3, { m: 3 }],
    [{ m: 3 }, 1, { m: 3 }],
  ])("from %j recording %i gives %j", (before, score, after) => {
    expect(recordScore(before, "m", score)).toEqual(after);
  });

  it("leaves other modules and the original object untouched", () => {
    const before = { other: 2 };
    expect(recordScore(before, "m", 1)).toEqual({ other: 2, m: 1 });
    expect(before).toEqual({ other: 2 });
  });
});
