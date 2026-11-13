import type { User } from "@firebase/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({ configured: true, inApp: false }));
vi.mock("../firebase", () => ({
  get FIREBASE_CONFIGURED() { return flags.configured; },
  inAppWindow: () => flags.inApp,
  firebaseAuth: () => ({ currentUser: null }),
}));
vi.mock("@firebase/auth", () => ({ GoogleAuthProvider: vi.fn(), reauthenticateWithPopup: vi.fn() }));

import { driveUnavailable, requestDriveAccessToken } from "./driveAuth";

const userWith = (...providerIds: string[]) => ({ providerData: providerIds.map((providerId) => ({ providerId })) }) as unknown as User;

beforeEach(() => {
  flags.configured = true;
  flags.inApp = false;
});

describe("driveUnavailable", () => {
  it("is available to a Google-signed-in user in the browser", () => {
    expect(driveUnavailable(userWith("google.com"))).toBeNull();
    expect(driveUnavailable(userWith("password", "google.com"))).toBeNull();
  });

  it.each([
    ["without Firebase", () => { flags.configured = false; }, userWith("google.com"), "devMode"],
    ["inside the desktop or Android app", () => { flags.inApp = true; }, userWith("google.com"), "inApp"],
    ["when signed out", () => undefined, null, "signedOut"],
    ["for an email-and-password account", () => undefined, userWith("password"), "notGoogle"],
  ])("says why it is not available %s", (_name, setup, user, reason) => {
    setup();
    expect(driveUnavailable(user)).toBe(reason);
  });
});

describe("requestDriveAccessToken", () => {
  it("refuses, naming the reason, when nobody is signed in", async () => {
    await expect(requestDriveAccessToken()).rejects.toThrow("Drive sync is not available: signedOut");
  });
});
