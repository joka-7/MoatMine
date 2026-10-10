"use client";

import { onAuthStateChanged, signOut, type User } from "@firebase/auth";
import { useEffect, useState, type ReactNode } from "react";
import { FIREBASE_CONFIGURED, firebaseAuth } from "@/lib/firebase";
import SignInForm from "./SignInForm";

type Session = { status: "loading" } | { status: "signed-out" } | { status: "signed-in"; user: User };

/** Follows Firebase's signed-in user; every API call then sends that user's ID token. */
function useSession(): Session {
  const [session, setSession] = useState<Session>({ status: "loading" });
  useEffect(
    () => onAuthStateChanged(firebaseAuth(), (user) => setSession(user ? { status: "signed-in", user } : { status: "signed-out" })),
    [],
  );
  return session;
}

function SignedInGate({ children }: { children: ReactNode }) {
  const session = useSession();
  if (session.status === "loading") return <div className="signin sub">Loading…</div>;
  if (session.status === "signed-out") return <SignInForm />;
  return <>{children}</>;
}

/**
 * Firebase sign-in around the whole app when the NEXT_PUBLIC_FIREBASE_* settings are present;
 * otherwise local dev mode (no sign-in, the backend trusts the dev token). Client-only, so it
 * works the same on GitHub Pages and in the desktop and Android apps.
 */
export default function AuthShell({ children }: { children: ReactNode }) {
  if (!FIREBASE_CONFIGURED) return <>{children}</>;
  return <SignedInGate>{children}</SignedInGate>;
}

/** Sign-out link for the nav; nothing in dev mode. */
export function SignOutLink() {
  if (!FIREBASE_CONFIGURED) return null;
  return (
    <button
      type="button"
      className="navlink"
      style={{ textAlign: "left", background: "none", border: 0, font: "inherit", cursor: "pointer" }}
      onClick={() => void signOut(firebaseAuth())}
    >
      Sign out
    </button>
  );
}
