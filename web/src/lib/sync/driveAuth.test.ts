import type { User } from "@firebase/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({ configured: true, inApp: false }));
const firebaseAuth = vi.hoisted(() => vi.fn());
vi.mock("../firebase", () => ({
  get FIREBASE_CONFIGURED() { return flags.configured; },
  inAppWindow: () => flags.inApp,
  firebaseAuth,
}));
vi.mock("@firebase/auth", () => ({ GoogleAuthProvider: vi.fn(), reauthenticateWithPopup: vi.fn() }));

import { currentDriveUser, driveUnavailable, requestDriveAccessToken } from "./driveAuth";

const userWith = (...providerIds: string[]) => ({ providerData: providerIds.map((providerId) => ({ providerId })) }) as unknown as User;

beforeEach(() => {
  flags.configured = true;
  flags.inApp = false;
  firebaseAuth.mockReset();
  firebaseAuth.mockReturnValue({ currentUser: null });
});

describe("currentDriveUser", () => {
  it("never creates the Firebase auth object when Firebase is not configured (it throws auth/invalid-api-key and crashes Settings)", () => {
    flags.configured = false;
    firebaseAuth.mockImplementation(() => { throw new Error("auth/invalid-api-key"); });
    expect(currentDriveUser()).toBeNull();
    expect(firebaseAuth).not.toHaveBeenCalled();
  });

  it("is the signed-in user when Firebase is configured", () => {
    const user = userWith("google.com");
    firebaseAuth.mockReturnValue({ currentUser: user });
    expect(currentDriveUser()).toBe(user);
  });
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

  it("refuses without touching Firebase when it is not configured", async () => {
    flags.configured = false;
    await expect(requestDriveAccessToken()).rejects.toThrow("Drive sync is not available: devMode");
    expect(firebaseAuth).not.toHaveBeenCalled();
  });
});
