import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLocalMode } from "@/lib/localMode";
import AiSettingsCard from "./AiSettingsCard";

vi.mock("modeldispatcher-react-ui", () => ({ ModelPicker: () => null }));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  api: vi.fn().mockResolvedValue({ config: { providers: [], ollamaUrl: "" }, favorite: null, external: null, supported: [], server_vendors: [] }),
}));
vi.mock("@/lib/data/aiSettings", () => ({
  loadDeviceAiSettings: vi.fn().mockResolvedValue({ config: { providers: [], ollamaUrl: "" }, favorite: null }),
  saveDeviceAiSettings: vi.fn(),
}));

const CAVEAT = /stored unencrypted in this browser's own storage/;

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe("AiSettingsCard", () => {
  it("says plainly that keys on the device are unencrypted, with advice, when data is kept on the device", async () => {
    setLocalMode(true);
    render(<AiSettingsCard />);
    expect(await screen.findByText(CAVEAT)).toBeTruthy();
    expect(screen.getByText(/Use keys with a spending limit/)).toBeTruthy();
  });

  it("does not say it when the keys are on the server, where they are encrypted", async () => {
    render(<AiSettingsCard />);
    await waitFor(() => expect(screen.getByText(/Keys are encrypted on the server/)).toBeTruthy());
    expect(screen.queryByText(CAVEAT)).toBeNull();
  });
});
