import { FirebaseError } from "@firebase/app";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signInWithEmailAndPassword } from "@firebase/auth";
import SignInForm from "./SignInForm";

vi.mock("@/lib/firebase", () => ({ firebaseAuth: () => ({}), inAppWindow: vi.fn(() => false) }));
vi.mock("@firebase/auth", () => ({
  GoogleAuthProvider: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signInWithPopup: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function signIn(email: string, password: string) {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("SignInForm", () => {
  it("signs in with the email and password typed", async () => {
    vi.mocked(signInWithEmailAndPassword).mockResolvedValue({} as never);
    render(<SignInForm />);
    await signIn("a@b.co", "secret1");
    await waitFor(() => expect(signInWithEmailAndPassword).toHaveBeenCalledWith({}, "a@b.co", "secret1"));
  });

  it.each([
    ["auth/invalid-credential", "Wrong email or password."],
    ["auth/too-many-requests", "Too many attempts. Wait a moment and try again."],
    ["auth/admin-restricted-operation", "Sign-ups are closed. Ask the owner to add your account."],
    ["auth/some-new-code", "Sign-in failed (auth/some-new-code)."],
  ])("shows a readable message for %s", async (code, text) => {
    vi.mocked(signInWithEmailAndPassword).mockRejectedValue(new FirebaseError(code, "raw"));
    render(<SignInForm />);
    await signIn("a@b.co", "secret1");
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", text);
  });

  it.each([
    [false, true],
    [true, false], // Google blocks its sign-in inside the desktop and Android app windows
  ])("offers Google sign-in when inAppWindow is %s: %s", async (inApp, offered) => {
    const { inAppWindow } = await import("@/lib/firebase");
    vi.mocked(inAppWindow).mockReturnValue(inApp);
    render(<SignInForm />);
    expect(screen.queryByRole("button", { name: "Continue with Google" }) !== null).toBe(offered);
  });

  it("switches to creating an account and to resetting a password", () => {
    render(<SignInForm />);
    fireEvent.click(screen.getByRole("button", { name: "Create an account" }));
    expect(screen.getByRole("button", { name: "Create account" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to sign in" }));
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.queryByLabelText("Password")).toBeNull();
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeTruthy();
  });
});
