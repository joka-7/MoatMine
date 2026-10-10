"use client";

import { getApps, initializeApp } from "@firebase/app";
import { getAuth, type Auth } from "@firebase/auth";

// Firebase Authentication only: sign-in and the ID token the API verifies (backend AUTH_MODE=firebase).
// MoatMine's data stays in its own database behind the API, not in Firestore. None of these values
// is secret: they identify the Firebase project and end up in the page either way.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

/** Set → sign in with Firebase. Unset → local dev mode (backend AUTH_MODE=dev, user id from Settings). */
export const FIREBASE_CONFIGURED = Boolean(config.apiKey && config.projectId && config.appId);

/** The app's Firebase Auth instance; created on first use so prerendering never touches it. */
export function firebaseAuth(): Auth {
  return getAuth(getApps()[0] ?? initializeApp(config));
}

/**
 * Whether this page runs inside the Tauri desktop or Android app. Google refuses its sign-in
 * popup in embedded app windows, so there the sign-in screen offers email and password only.
 */
export function inAppWindow(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
