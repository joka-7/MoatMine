"use client";

import { ClerkFailed, ClerkLoading, ClerkProvider, Show, SignIn, SignOutButton } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { CLERK_PUBLISHABLE_KEY } from "@/lib/api";

/**
 * Clerk sign-in around the whole app when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set; otherwise
 * local dev mode (no sign-in, the backend trusts the dev token). Client-only, so it works the
 * same on Vercel and in the Tauri static export.
 */
export default function AuthShell({ children }: { children: ReactNode }) {
  if (!CLERK_PUBLISHABLE_KEY) return <>{children}</>;
  return (
    // Tauri serves the static export from tauri://localhost (macOS/Linux); allow redirects back into it.
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} allowedRedirectProtocols={["tauri:"]}>
      <ClerkLoading><div className="signin sub">Loading sign-in…</div></ClerkLoading>
      <ClerkFailed>
        <div className="signin"><div className="err">Couldn&apos;t load sign-in. Check your connection and reload.</div></div>
      </ClerkFailed>
      <Show when="signed-out">
        <div className="signin">
          <div className="brand"><i /> MoatMine</div>
          {/* hash routing: the static export has no server routes for /sign-in/[[...rest]] */}
          <SignIn routing="hash" />
        </div>
      </Show>
      <Show when="signed-in">{children}</Show>
    </ClerkProvider>
  );
}

/** Sign-out link for the nav; nothing in dev mode. */
export function SignOutLink() {
  if (!CLERK_PUBLISHABLE_KEY) return null;
  return (
    <SignOutButton>
      <button type="button" className="navlink" style={{ textAlign: "left", background: "none", border: 0, font: "inherit", cursor: "pointer" }}>
        Sign out
      </button>
    </SignOutButton>
  );
}
