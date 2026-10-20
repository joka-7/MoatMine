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
    window.localStorage.setItem("moatmine.learn", '["investing","risk"]');
    render(<LearnPage />);
    expect(screen.getByText("2 of 7 modules complete")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: "Review" })).toHaveLength(2);
  });

  it("opens the module named in the query string, with its lessons and a link to the next module", () => {
    query = "m=investing";
    render(<LearnPage />);
    expect(screen.getByRole("heading", { name: "What investing is" })).toBeTruthy();
    expect(screen.getAllByText(/^Lesson \d$/)).toHaveLength(4);
    expect(screen.getByRole("link", { name: "Next module" }).getAttribute("href")).toBe("/learn?m=assets");
  });

  it("gives every lesson a collapsed 'More details' and 'Examples' section with the extra content inside", () => {
    query = "m=investing";
    const { container } = render(<LearnPage />);
    const sections = [...container.querySelectorAll("details")];
    expect(sections).toHaveLength(12);
    expect(sections.every((d) => !d.open)).toBe(true);
    expect(screen.getAllByText("More details")).toHaveLength(4);
    expect(screen.getAllByText("Examples (3)")).toHaveLength(4);
    expect(screen.getAllByText(/^Watch or listen \(\d+\)$/)).toHaveLength(4);
    expect(screen.getByText(/Emergency fund: you keep three to six months/)).toBeTruthy();
  });

  it("lists outside videos and podcasts per lesson as new-tab links, with their channel, length and language", () => {
    query = "m=investing";
    render(<LearnPage />);
    const link = screen.getByRole("link", { name: "5 Questions To Ask Before Investing" });
    expect(link.getAttribute("href")).toBe("https://www.youtube.com/watch?v=y72iyLPOv8E");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noreferrer");
    expect(screen.getByText("Two Cents (PBS) · Video · 6 min · English")).toBeTruthy();
  });

  it("marks the module complete, saves it, and can undo it", () => {
    query = "m=investing";
    render(<LearnPage />);
    fireEvent.click(screen.getByRole("button", { name: "Mark module as complete" }));
    expect(JSON.parse(window.localStorage.getItem("moatmine.learn") ?? "[]")).toEqual(["investing"]);
    fireEvent.click(screen.getByRole("button", { name: "Mark as not complete" }));
    expect(JSON.parse(window.localStorage.getItem("moatmine.learn") ?? "[]")).toEqual([]);
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
