"use client";

import { FirebaseError } from "@firebase/app";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "@firebase/auth";
import { useState, type FormEvent } from "react";
import { firebaseAuth, inAppWindow } from "@/lib/firebase";

type Mode = "sign-in" | "create" | "reset";

const MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Wrong email or password.",
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/email-already-in-use": "There's already an account with this email. Sign in instead.",
  "auth/weak-password": "Use a password of at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
  "auth/popup-closed-by-user": "Google sign-in was closed before it finished.",
  "auth/network-request-failed": "Can't reach the sign-in service. Check your connection.",
};

function describe(e: unknown): string {
  return e instanceof FirebaseError ? MESSAGES[e.code] ?? `Sign-in failed (${e.code}).` : "Sign-in failed.";
}

/** Email and password (works everywhere) plus Google (browsers only: Google blocks it in app windows). */
export default function SignInForm() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "err" | "sub"; text: string } | null>(null);

  const run = async (action: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      if (done) setMessage({ kind: "sub", text: done });
    } catch (e) {
      setMessage({ kind: "err", text: describe(e) });
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const auth = firebaseAuth();
    if (mode === "reset") void run(() => sendPasswordResetEmail(auth, email), "Check your email for a link to set a new password.");
    else if (mode === "create") void run(() => createUserWithEmailAndPassword(auth, email, password));
    else void run(() => signInWithEmailAndPassword(auth, email, password));
  };

  return (
    <div className="signin">
      <div className="brand"><i /> MoatMine</div>
      <form className="card grid" style={{ gap: 10, width: "100%", maxWidth: 360 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{mode === "create" ? "Create an account" : mode === "reset" ? "Reset your password" : "Sign in"}</h2>
        <label className="f">Email<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        {mode !== "reset" && (
          <label className="f">
            Password
            <input type="password" autoComplete={mode === "create" ? "new-password" : "current-password"} required minLength={6}
                   value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        )}
        <button className="btn primary" type="submit" disabled={busy}>
          {mode === "create" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in"}
        </button>
        {!inAppWindow() && mode !== "reset" && (
          <button className="btn" type="button" disabled={busy}
                  onClick={() => void run(() => signInWithPopup(firebaseAuth(), new GoogleAuthProvider()))}>
            Continue with Google
          </button>
        )}
        {message && <div className={message.kind} role={message.kind === "err" ? "alert" : "status"}>{message.text}</div>}
        <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
          {mode === "sign-in" ? (
            <>
              <button type="button" className="btn ghost sm" onClick={() => setMode("create")}>Create an account</button>
              <button type="button" className="btn ghost sm" onClick={() => setMode("reset")}>Forgot password?</button>
            </>
          ) : (
            <button type="button" className="btn ghost sm" onClick={() => setMode("sign-in")}>Back to sign in</button>
          )}
        </div>
      </form>
    </div>
  );
}
