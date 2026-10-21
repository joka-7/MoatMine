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
import { useI18n, type I18n, type MessageKey } from "@/lib/i18n";
import LanguageSwitch from "./LanguageSwitch";
import ThemeSwitch from "./ThemeSwitch";

type Mode = "sign-in" | "create" | "reset";

const MESSAGES: Readonly<Record<string, MessageKey>> = {
  "auth/invalid-credential": "signin.err.invalidCredential",
  "auth/invalid-email": "signin.err.invalidEmail",
  "auth/email-already-in-use": "signin.err.emailInUse",
  "auth/weak-password": "signin.err.weakPassword",
  "auth/too-many-requests": "signin.err.tooManyRequests",
  "auth/popup-closed-by-user": "signin.err.popupClosed",
  "auth/network-request-failed": "signin.err.network",
  "auth/admin-restricted-operation": "signin.err.signupsClosed",
};

function describe(e: unknown, t: I18n["t"]): string {
  if (!(e instanceof FirebaseError)) return t("signin.failed");
  const known = MESSAGES[e.code];
  return known ? t(known) : t("signin.failedCode", { code: e.code });
}

/** Email and password (works everywhere) plus Google (browsers only: Google blocks it in app windows). */
export default function SignInForm() {
  const { t } = useI18n();
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
      setMessage({ kind: "err", text: describe(e, t) });
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const auth = firebaseAuth();
    if (mode === "reset") void run(() => sendPasswordResetEmail(auth, email), t("signin.resetSent"));
    else if (mode === "create") void run(() => createUserWithEmailAndPassword(auth, email, password));
    else void run(() => signInWithEmailAndPassword(auth, email, password));
  };

  return (
    <div className="signin">
      <div className="brand"><i /> MoatMine</div>
      <form className="card grid" style={{ gap: 10, width: "100%", maxWidth: 360 }} onSubmit={submit}>
        <h2 style={{ margin: 0 }}>{t(mode === "create" ? "signin.createTitle" : mode === "reset" ? "signin.resetTitle" : "signin.title")}</h2>
        <label className="f">{t("signin.email")}<input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        {mode !== "reset" && (
          <label className="f">
            {t("signin.password")}
            <input type="password" autoComplete={mode === "create" ? "new-password" : "current-password"} required minLength={6}
                   value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
        )}
        <button className="btn primary" type="submit" disabled={busy}>
          {t(mode === "create" ? "signin.createSubmit" : mode === "reset" ? "signin.resetSubmit" : "signin.submit")}
        </button>
        {!inAppWindow() && mode !== "reset" && (
          <button className="btn" type="button" disabled={busy}
                  onClick={() => void run(() => signInWithPopup(firebaseAuth(), new GoogleAuthProvider()))}>
            {t("signin.google")}
          </button>
        )}
        {message && <div className={message.kind} role={message.kind === "err" ? "alert" : "status"}>{message.text}</div>}
        <div className="row" style={{ justifyContent: "space-between", fontSize: 12 }}>
          {mode === "sign-in" ? (
            <>
              <button type="button" className="btn ghost sm" onClick={() => setMode("create")}>{t("signin.toCreate")}</button>
              <button type="button" className="btn ghost sm" onClick={() => setMode("reset")}>{t("signin.toReset")}</button>
            </>
          ) : (
            <button type="button" className="btn ghost sm" onClick={() => setMode("sign-in")}>{t("signin.back")}</button>
          )}
        </div>
      </form>
      <LanguageSwitch />
      <ThemeSwitch />
    </div>
  );
}
