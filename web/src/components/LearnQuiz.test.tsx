import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LEARN_MODULES, type LearnModule } from "@/lib/learn";
import LearnQuiz from "./LearnQuiz";

afterEach(cleanup);

const quizModule: LearnModule = LEARN_MODULES.find((m) => m.id === "investing") ?? fail("investing module missing");

function fail(message: string): never {
  throw new Error(message);
}
const options = (i: number) => quizModule.quiz[i]?.options ?? fail("question missing");
const correct = (i: number) => quizModule.quiz[i]?.answer ?? fail("question missing");

/** Picks, for each question, the option at `choose(question index)`. */
function answer(choose: (i: number) => number) {
  quizModule.quiz.forEach((_, i) => fireEvent.click(screen.getByLabelText((options(i)[choose(i)] ?? fail("option missing")).en)));
}

describe("LearnQuiz", () => {
  it("keeps Check answers disabled until every question is answered", () => {
    render(<LearnQuiz module={quizModule} onScore={vi.fn()} />);
    const check = screen.getByRole("button", { name: "Check answers" }) as HTMLButtonElement;
    expect(check.disabled).toBe(true);
    answer(correct);
    expect(check.disabled).toBe(false);
  });

  it("reports a full score and marks the module complete", () => {
    const onScore = vi.fn();
    render(<LearnQuiz module={quizModule} onScore={onScore} />);
    answer(correct);
    fireEvent.click(screen.getByRole("button", { name: "Check answers" }));
    expect(onScore).toHaveBeenCalledWith(3);
    expect(screen.getByText("Module complete.")).toBeTruthy();
  });

  it("reports a failing score without completing, and Try again clears the answers", () => {
    const onScore = vi.fn();
    render(<LearnQuiz module={quizModule} onScore={onScore} />);
    answer((i) => (correct(i) + 1) % options(i).length);
    fireEvent.click(screen.getByRole("button", { name: "Check answers" }));
    expect(onScore).toHaveBeenCalledWith(0);
    expect(screen.queryByText("Module complete.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect((screen.getByRole("button", { name: "Check answers" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
