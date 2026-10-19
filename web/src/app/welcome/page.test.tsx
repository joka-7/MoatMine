import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WelcomePage from "./page";

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe("WelcomePage", () => {
  it("walks through every step and offers where to begin on the last", () => {
    render(<WelcomePage />);
    expect(screen.getByText("Step 1 of 6")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Back" }) as HTMLButtonElement).disabled).toBe(true);
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Step 6 of 6")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(screen.getByRole("link", { name: "Start learning" }).getAttribute("href")).toBe("/learn");
  });

  it("remembers the intro as seen when it is skipped", () => {
    render(<WelcomePage />);
    fireEvent.click(screen.getByRole("link", { name: "Skip intro" }));
    expect(window.localStorage.getItem("moatmine.intro")).toBe("seen");
  });
});
