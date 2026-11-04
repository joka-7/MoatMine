import { FirebaseError } from "@firebase/app";
import { signInWithCredential } from "@firebase/auth";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appGoogleConfig, codeChallenge, GoogleSignInError, reversedClientId, signInWithGoogleApp, type AppGoogleConfig } from "./googleApp";

vi.mock("./firebase", () => ({ firebaseAuth: () => ({ auth: true }) }));
vi.mock("@firebase/auth", () => ({
  GoogleAuthProvider: { credential: vi.fn((idToken: string) => ({ idToken })) },
  signInWithCredential: vi.fn(),
}));

const DESKTOP: AppGoogleConfig = { clientId: "d1.apps.googleusercontent.com", clientSecret: "shh", redirectUri: null };
const ANDROID: AppGoogleConfig = { clientId: "a1-x.apps.googleusercontent.com", clientSecret: null, redirectUri: "com.googleusercontent.apps.a1-x:/oauth2redirect" };

const invoke = vi.fn();
const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("__TAURI_INTERNALS__", { invoke });
  Object.defineProperty(window, "__TAURI_INTERNALS__", { value: { invoke }, configurable: true });
  vi.stubGlobal("fetch", fetchMock);
  invoke.mockResolvedValue({ code: "auth-code", redirectUri: "http://127.0.0.1:5555" });
  fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ id_token: "google-id-token" }) });
  vi.mocked(signInWithCredential).mockResolvedValue({ user: { uid: "u1" } } as never);
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, "__TAURI_INTERNALS__");
});

describe("reversedClientId", () => {
  it.each([["123-abc.apps.googleusercontent.com", "com.googleusercontent.apps.123-abc"]])("turns %s into %s", (id, scheme) => {
    expect(reversedClientId(id)).toBe(scheme);
  });

  it.each([[""], ["plain-id"], [".apps.googleusercontent.com"]])("refuses %j, which is not a Google client id", (id) => {
    expect(() => reversedClientId(id)).toThrow(GoogleSignInError);
  });
});

describe("appGoogleConfig", () => {
  const env = {
    NEXT_PUBLIC_GOOGLE_DESKTOP_CLIENT_ID: "d1.apps.googleusercontent.com",
    NEXT_PUBLIC_GOOGLE_DESKTOP_CLIENT_SECRET: "shh",
    NEXT_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: "a1-x.apps.googleusercontent.com",
  };

  it.each([
    ["desktop with both settings", false, env, DESKTOP],
    ["android with its client", true, env, ANDROID],
    ["desktop without the secret", false, { ...env, NEXT_PUBLIC_GOOGLE_DESKTOP_CLIENT_SECRET: undefined }, null],
    ["desktop without a client", false, {}, null],
    ["android without a client", true, { ...env, NEXT_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: "" }, null],
  ])("%s", (_, android, settings, expected) => {
    expect(appGoogleConfig(android, settings)).toEqual(expected);
  });
});

describe("codeChallenge", () => {
  it("matches the example in RFC 7636 appendix B", async () => {
    expect(await codeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
});

describe("signInWithGoogleApp", () => {
  it("asks the shell for a code, trades it for an ID token, and signs in to Firebase with it", async () => {
    const result = await signInWithGoogleApp(DESKTOP);

    const request = invoke.mock.calls[0]?.[1] as { request: Record<string, string | null> };
    expect(invoke.mock.calls[0]?.[0]).toBe("google_oauth");
    expect(request.request).toMatchObject({ clientId: DESKTOP.clientId, redirectUri: null });
    expect(request.request.codeChallenge).toMatch(/^[\w-]{43}$/);
    expect(request.request.state).toMatch(/^[\w-]{20,}$/);

    const [url, init] = fetchMock.mock.calls[0] as [string, { method: string; body: URLSearchParams }];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(init.method).toBe("POST");
    expect(Object.fromEntries(init.body)).toMatchObject({
      grant_type: "authorization_code",
      code: "auth-code",
      client_id: DESKTOP.clientId,
      client_secret: "shh",
      redirect_uri: "http://127.0.0.1:5555",
    });
    expect(init.body.get("code_verifier")).toMatch(/^[\w-]{64}$/);

    expect(signInWithCredential).toHaveBeenCalledWith({ auth: true }, { idToken: "google-id-token" });
    expect(result).toEqual({ user: { uid: "u1" } });
  });

  it("sends the app's own redirect on Android and no client secret", async () => {
    await signInWithGoogleApp(ANDROID);
    const request = invoke.mock.calls[0]?.[1] as { request: { redirectUri: string } };
    expect(request.request.redirectUri).toBe(ANDROID.redirectUri);
    const [, init] = fetchMock.mock.calls[0] as [string, { body: URLSearchParams }];
    expect(init.body.has("client_secret")).toBe(false);
  });

  it.each([
    ["the build has no Google client", () => signInWithGoogleApp(null), "not-configured"],
    ["the page is not inside the app", () => { Reflect.deleteProperty(window, "__TAURI_INTERNALS__"); return signInWithGoogleApp(DESKTOP); }, "no-shell"],
    ["the browser step fails", () => { invoke.mockRejectedValue("Google sign-in timed out"); return signInWithGoogleApp(DESKTOP); }, "shell"],
    ["the shell replies with something else", () => { invoke.mockResolvedValue({ nope: 1 }); return signInWithGoogleApp(DESKTOP); }, "shell"],
    ["Google refuses the code", () => { fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: "invalid_grant" }) }); return signInWithGoogleApp(DESKTOP); }, "exchange"],
    ["Google's reply has no ID token", () => { fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }); return signInWithGoogleApp(DESKTOP); }, "exchange"],
    ["Google can't be reached", () => { fetchMock.mockRejectedValue(new TypeError("offline")); return signInWithGoogleApp(DESKTOP); }, "exchange"],
    ["Firebase rejects the credential", () => { vi.mocked(signInWithCredential).mockRejectedValue(new FirebaseError("auth/invalid-credential", "x")); return signInWithGoogleApp(DESKTOP); }, "rejected"],
  ])("throws a %s GoogleSignInError reason when %s", async (_, act, reason) => {
    await expect(act()).rejects.toMatchObject({ name: "GoogleSignInError", reason });
  });

  it("passes other Firebase errors through, so closed sign-ups can be explained", async () => {
    vi.mocked(signInWithCredential).mockRejectedValue(new FirebaseError("auth/admin-restricted-operation", "x"));
    await expect(signInWithGoogleApp(DESKTOP)).rejects.toMatchObject({ code: "auth/admin-restricted-operation" });
  });
});
