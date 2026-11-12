import { afterEach, describe, expect, it } from "vitest";
import { currentLang, localizedError, serverText } from "./current";

afterEach(() => window.localStorage.clear());

describe("currentLang", () => {
  it("is the saved choice", () => {
    window.localStorage.setItem("moatmine.lang", "he");
    expect(currentLang()).toBe("he");
  });

  it("falls back to the browser's language, English in the test browser", () => {
    expect(currentLang()).toBe("en");
  });

  it("ignores a saved value that is not a language", () => {
    window.localStorage.setItem("moatmine.lang", "fr");
    expect(currentLang()).toBe("en");
  });
});

describe("serverText and localizedError", () => {
  it("leave English as it is", () => {
    expect(serverText("plan not found")).toBe("plan not found");
    expect(localizedError("plan not found").message).toBe("plan not found");
  });

  it("translate for a Hebrew user, and pass an untranslated sentence through", () => {
    window.localStorage.setItem("moatmine.lang", "he");
    expect(serverText("plan not found")).toBe("התוכנית לא נמצאה");
    expect(localizedError("AAPL already on watchlist").message).toBe("AAPL כבר ברשימת המעקב");
    expect(localizedError("something unexpected").message).toBe("something unexpected");
  });
});
