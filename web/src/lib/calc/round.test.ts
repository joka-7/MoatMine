import { describe, expect, it } from "vitest";
import { pyRound } from "./round";

describe("pyRound", () => {
  it.each([
    [0.125, 2, 0.12], // exact tie: to the even neighbour, where toFixed says 0.13
    [0.375, 2, 0.38],
    [2.5, 0, 2],
    [3.5, 0, 4],
    [1.005, 2, 1], // not a tie: the double is just below 1.005
    [-0.125, 2, -0.12],
    [12.345, 2, 12.35],
    [1234.5678, 1, 1234.6],
    [-0.001, 2, 0], // never -0
    [0, 2, 0],
  ])("rounds %f to %i places as %f", (x, digits, expected) => {
    expect(pyRound(x, digits)).toBe(expected);
  });

  it("leaves a non-finite number alone", () => {
    expect(pyRound(Infinity)).toBe(Infinity);
    expect(pyRound(NaN)).toBeNaN();
  });
});
