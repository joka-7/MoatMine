import { describe, expect, it } from "vitest";
import { completedCount, isComplete, parseProgress, setComplete } from "./progress";
import { text, type LearnModule } from "./types";

const moduleWith = (id: string): LearnModule => ({ id, title: text("t", "כ"), summary: text("s", "ס"), lessons: [] });
const modules = [moduleWith("a"), moduleWith("b"), moduleWith("c")];

describe("isComplete / completedCount", () => {
  it.each([
    [[], false],
    [["b"], false],
    [["a", "b"], true],
  ])("module a with progress %j is complete: %s", (progress, expected) => {
    expect(isComplete(moduleWith("a"), progress)).toBe(expected);
  });

  it.each([
    [[], 0],
    [["a", "c"], 2],
    [["a", "z"], 1],
  ])("counts %j as %i of the modules", (progress, expected) => {
    expect(completedCount(modules, progress)).toBe(expected);
  });
});

describe("parseProgress", () => {
  it.each([
    [null, []],
    ["", []],
    ["not json", []],
    ["3", []],
    ["null", []],
    ['{"risk":3}', []],
    ['["a",1,"",null,"b"]', ["a", "b"]],
    ['["a","a","b"]', ["a", "b"]],
  ])("reads %j as %j", (raw, expected) => {
    expect(parseProgress(raw)).toEqual(expected);
  });
});

describe("setComplete", () => {
  it.each([
    [[], "a", true, ["a"]],
    [["a"], "a", true, ["a"]],
    [["a", "b"], "a", false, ["b"]],
    [["b"], "a", false, ["b"]],
  ])("from %j, module %s done=%s gives %j", (before, id, done, after) => {
    expect(setComplete(before, id, done)).toEqual(after);
  });

  it("leaves the original list untouched", () => {
    const before = ["a"];
    setComplete(before, "b", true);
    expect(before).toEqual(["a"]);
  });
});
