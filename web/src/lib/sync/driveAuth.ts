import { GoogleAuthProvider, reauthenticateWithPopup, type User } from "@firebase/auth";
import { FIREBASE_CONFIGURED, firebaseAuth, inAppWindow } from "../firebase";
import { DRIVE_SCOPE } from "./drive";

/** Why Drive sync cannot be offered here, as a message key's reason; null when it can. */
export type DriveUnavailable = "devMode" | "inApp" | "notGoogle" | "signedOut";

/** The signed-in user, or null. Without Firebase configured there is no auth object to ask: creating one throws. */
export function currentDriveUser(): User | null {
  return FIREBASE_CONFIGURED ? firebaseAuth().currentUser : null;
}

/**
 * Drive sync needs a Google access token, which only a Google sign-in in the browser can give.
 * The desktop and Android apps sign in through the system browser and do not ask for the Drive
 * scope yet; email-and-password accounts have no Google token at all.
 */
export function driveUnavailable(user: User | null): DriveUnavailable | null {
  if (!FIREBASE_CONFIGURED) return "devMode";
  if (inAppWindow()) return "inApp";
  if (!user) return "signedOut";
  return user.providerData.some((p) => p.providerId === "google.com") ? null : "notGoogle";
}

/**
 * Ask Google, through a popup, for an access token limited to the app's own hidden Drive folder.
 * The token lasts about an hour and is not stored: the next sync asks again.
 *
 * @throws Error when Drive sync is not available here, or the user closes the popup or declines.
 */
export async function requestDriveAccessToken(): Promise<string> {
  const user = currentDriveUser();
  const reason = driveUnavailable(user);
  if (reason !== null || user === null) throw new Error(`Drive sync is not available: ${reason ?? "signedOut"}`);
  const provider = new GoogleAuthProvider();
  provider.addScope(DRIVE_SCOPE);
  const result = await reauthenticateWithPopup(user, provider);
  const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
  if (!token) throw new Error("Google did not return a Drive access token.");
  return token;
}
