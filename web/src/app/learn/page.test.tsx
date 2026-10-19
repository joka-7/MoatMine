import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LearnPage from "./page";

let query = "";
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(query) }));

beforeEach(() => {
  query = "";
  window.localStorage.clear();
});
afterEach(cleanup);

describe("LearnPage", () => {
  it("lists the seven modules with none complete on a first visit", () => {
    render(<LearnPage />);
    expect(screen.getByText("0 of 7 modules complete")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Start" })).toHaveLength(7);
  });

  it("shows saved progress on the list", () => {
    window.localStorage.setItem("moatmine.learn", '{"investing":3,"risk":1}');
    render(<LearnPage />);
    expect(screen.getByText("1 of 7 modules complete")).toBeTruthy();
    expect(screen.getByText(/Best score 1\/3/)).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Review" })).toHaveLength(2);
  });

  it("opens the module named in the query string, with its lessons and a link to the next module", () => {
    query = "m=investing";
    render(<LearnPage />);
    expect(screen.getByRole("heading", { name: "What investing is" })).toBeTruthy();
    expect(screen.getAllByText(/^Lesson \d$/)).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Next module" }).getAttribute("href")).toBe("/learn?m=assets");
  });

  it("saves the quiz score so the list counts the module", () => {
    query = "m=investing";
    render(<LearnPage />);
    for (const answer of ["An investment's value can rise or fall", "It shrinks each year", "There is more time to recover from falls"]) {
      fireEvent.click(screen.getByLabelText(answer));
    }
    fireEvent.click(screen.getByRole("button", { name: "Check answers" }));
    expect(JSON.parse(window.localStorage.getItem("moatmine.learn") ?? "{}")).toEqual({ investing: 3 });
  });

  it("says so for a module that doesn't exist", () => {
    query = "m=nope";
    render(<LearnPage />);
    expect(screen.getByText("That module doesn't exist.")).toBeTruthy();
  });

  it("hides the Next module link on the last module", () => {
    query = "m=moatmine";
    render(<LearnPage />);
    expect(screen.queryByRole("link", { name: "Next module" })).toBeNull();
  });
});
