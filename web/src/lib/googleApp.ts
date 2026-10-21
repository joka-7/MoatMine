"use client";

import { FirebaseError } from "@firebase/app";
import { GoogleAuthProvider, signInWithCredential, type UserCredential } from "@firebase/auth";
import { firebaseAuth } from "./firebase";

// Google sign-in inside the desktop and Android apps. Google refuses its popup in an embedded app
// window, so the Tauri shell (desktop/src-tauri/src/oauth.rs) opens the system browser and returns
// the authorization code; this file does the rest: PKCE, the token exchange, and Firebase sign-in.

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/** The OAuth client for this platform, from the build's NEXT_PUBLIC_GOOGLE_* settings. */
export interface AppGoogleConfig {
  readonly clientId: string;
  /** Google's "Desktop app" clients need one in the token exchange; it is not treated as a secret. */
  readonly clientSecret: string | null;
  /** Android only: the app's own scheme, which is Google's reversed client id. */
  readonly redirectUri: string | null;
}

export type GoogleSignInFailure = "not-configured" | "no-shell" | "shell" | "exchange" | "rejected";

/** Google sign-in did not finish; `reason` says where, `cause` carries the original error. */
export class GoogleSignInError extends Error {
  constructor(readonly reason: GoogleSignInFailure, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "GoogleSignInError";
  }
}

interface TauriInternals {
  readonly invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
}

const tauriInternals = (): TauriInternals | null =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
    ? ((window as unknown as { __TAURI_INTERNALS__: TauriInternals }).__TAURI_INTERNALS__)
    : null;

export const isAndroidApp = (): boolean => typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

/** `1234-abc.apps.googleusercontent.com` → `com.googleusercontent.apps.1234-abc` (Google's scheme for installed apps). */
export function reversedClientId(clientId: string): string {
  const suffix = ".apps.googleusercontent.com";
  if (!clientId.endsWith(suffix) || clientId.length === suffix.length) {
    throw new GoogleSignInError("not-configured", `Not a Google OAuth client id: ${clientId}`);
  }
  return `com.googleusercontent.apps.${clientId.slice(0, -suffix.length)}`;
}

/** The client to use on this platform, or null when this build was made without one. */
export function appGoogleConfig(android: boolean, env: Readonly<Record<string, string | undefined>>): AppGoogleConfig | null {
  if (android) {
    const clientId = env.NEXT_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
    return clientId ? { clientId, clientSecret: null, redirectUri: `${reversedClientId(clientId)}:/oauth2redirect` } : null;
  }
  const clientId = env.NEXT_PUBLIC_GOOGLE_DESKTOP_CLIENT_ID;
  const clientSecret = env.NEXT_PUBLIC_GOOGLE_DESKTOP_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret, redirectUri: null } : null;
}

// Next inlines NEXT_PUBLIC_* only where they are written out in full.
const BUILD_ENV = {
  NEXT_PUBLIC_GOOGLE_DESKTOP_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_DESKTOP_CLIENT_ID,
  NEXT_PUBLIC_GOOGLE_DESKTOP_CLIENT_SECRET: process.env.NEXT_PUBLIC_GOOGLE_DESKTOP_CLIENT_SECRET,
  NEXT_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
};

/** Whether this build of the app can offer "Continue with Google". */
export const appGoogleConfigured = (): boolean => appGoogleConfig(isAndroidApp(), BUILD_ENV) !== null;

const base64Url = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** The PKCE challenge for a verifier: base64url(SHA-256(verifier)), RFC 7636 section 4.2. */
export async function codeChallenge(verifier: string): Promise<string> {
  return base64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
}

const randomToken = (bytes: number): string => base64Url(crypto.getRandomValues(new Uint8Array(bytes)));

interface ShellReply {
  readonly code: string;
  readonly redirectUri: string;
}

const isShellReply = (v: unknown): v is ShellReply =>
  typeof v === "object" && v !== null && typeof (v as ShellReply).code === "string" && typeof (v as ShellReply).redirectUri === "string";

async function exchangeCode(config: AppGoogleConfig, reply: ShellReply, verifier: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: reply.code,
    client_id: config.clientId,
    redirect_uri: reply.redirectUri,
    code_verifier: verifier,
  });
  if (config.clientSecret) body.set("client_secret", config.clientSecret);
  let res: Response;
  try {
    res = await fetch(TOKEN_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  } catch (e) {
    throw new GoogleSignInError("exchange", "Could not reach Google to finish signing in.", { cause: e });
  }
  const data: unknown = await res.json().catch(() => null);
  const idToken = typeof data === "object" && data !== null ? (data as { id_token?: unknown }).id_token : undefined;
  if (!res.ok || typeof idToken !== "string" || !idToken) {
    throw new GoogleSignInError("exchange", `Google refused the sign-in (${res.status}).`);
  }
  return idToken;
}

/**
 * Signs in with Google through the system browser, then to Firebase with the Google ID token.
 *
 * Throws GoogleSignInError when the browser step or the token exchange fails. A Firebase error
 * other than a bad credential (for example `auth/admin-restricted-operation` when sign-ups are
 * closed) is passed on as it is, so the sign-in screen can explain it.
 */
export async function signInWithGoogleApp(
  config: AppGoogleConfig | null = appGoogleConfig(isAndroidApp(), BUILD_ENV),
): Promise<UserCredential> {
  if (!config) throw new GoogleSignInError("not-configured", "This build has no Google sign-in client.");
  const shell = tauriInternals();
  if (!shell) throw new GoogleSignInError("no-shell", "Google sign-in needs the MoatMine app.");

  const verifier = randomToken(48);
  let reply: unknown;
  try {
    reply = await shell.invoke("google_oauth", {
      request: {
        clientId: config.clientId,
        codeChallenge: await codeChallenge(verifier),
        state: randomToken(24),
        redirectUri: config.redirectUri,
      },
    });
  } catch (e) {
    throw new GoogleSignInError("shell", typeof e === "string" ? e : "Google sign-in did not finish.", { cause: e });
  }
  if (!isShellReply(reply)) throw new GoogleSignInError("shell", "The app returned an unexpected sign-in reply.");

  const idToken = await exchangeCode(config, reply, verifier);
  try {
    return await signInWithCredential(firebaseAuth(), GoogleAuthProvider.credential(idToken));
  } catch (e) {
    if (e instanceof FirebaseError && e.code === "auth/invalid-credential") {
      throw new GoogleSignInError("rejected", "Firebase did not accept the Google sign-in.", { cause: e });
    }
    throw e;
  }
}
