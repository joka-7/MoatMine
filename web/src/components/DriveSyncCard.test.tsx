import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DriveAuthError } from "@/lib/sync/drive";
import { requestDriveAccessToken, driveUnavailable } from "@/lib/sync/driveAuth";
import { syncWithDrive } from "@/lib/sync/sync";
import { setLocalMode } from "@/lib/localMode";
import DriveSyncCard from "./DriveSyncCard";

vi.mock("@/lib/firebase", () => ({ firebaseAuth: () => ({ currentUser: {} }) }));
vi.mock("@/lib/store/shared", () => ({ portfolioStore: () => Promise.resolve({}) }));
vi.mock("@/lib/sync/driveAuth", () => ({ driveUnavailable: vi.fn(), requestDriveAccessToken: vi.fn() }));
vi.mock("@/lib/sync/sync", () => ({ syncWithDrive: vi.fn() }));

const click = () => fireEvent.click(screen.getByRole("button", { name: "Sync with Google Drive now" }));

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(driveUnavailable).mockReturnValue(null);
  vi.mocked(requestDriveAccessToken).mockResolvedValue("token");
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DriveSyncCard", () => {
  it("says why sync is unavailable instead of offering the button", async () => {
    vi.mocked(driveUnavailable).mockReturnValue("inApp");
    render(<DriveSyncCard />);
    expect(await screen.findByText(/not available in the desktop and Android apps/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Sync with Google Drive now" })).toBeNull();
  });

  it("keeps the button off until the data is kept on the device", async () => {
    render(<DriveSyncCard />);
    const button = (await screen.findByRole("button", { name: "Sync with Google Drive now" })) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByText(/Turn on "Store my data on this device" first/)).toBeTruthy();
  });

  it("syncs, reports what came from Drive and remembers when", async () => {
    setLocalMode(true);
    vi.mocked(syncWithDrive).mockResolvedValue({ merged: { added: 2, updated: 1, kept: 0 }, created: false });
    render(<DriveSyncCard />);
    await waitFor(() => expect((screen.getByRole("button", { name: "Sync with Google Drive now" }) as HTMLButtonElement).disabled).toBe(false));
    click();
    expect(await screen.findByText("Synced. From Drive: 2 added and 1 updated on this device.")).toBeTruthy();
    expect(window.localStorage.getItem("moatmine.driveSynced")).not.toBeNull();
  });

  it("says the file was created on a first sync", async () => {
    setLocalMode(true);
    vi.mocked(syncWithDrive).mockResolvedValue({ merged: null, created: true });
    render(<DriveSyncCard />);
    await waitFor(() => expect((screen.getByRole("button", { name: "Sync with Google Drive now" }) as HTMLButtonElement).disabled).toBe(false));
    click();
    expect(await screen.findByText("Synced. The backup file was created in your Drive.")).toBeTruthy();
  });

  it("asks for a new token once when Drive refuses the first, then succeeds", async () => {
    setLocalMode(true);
    vi.mocked(syncWithDrive)
      .mockRejectedValueOnce(new DriveAuthError(401, "expired"))
      .mockResolvedValueOnce({ merged: { added: 0, updated: 0, kept: 0 }, created: false });
    render(<DriveSyncCard />);
    await waitFor(() => expect((screen.getByRole("button", { name: "Sync with Google Drive now" }) as HTMLButtonElement).disabled).toBe(false));
    click();
    await screen.findByText(/^Synced\./);
    expect(requestDriveAccessToken).toHaveBeenCalledTimes(2);
  });

  it("shows a failure and says nothing was lost", async () => {
    setLocalMode(true);
    vi.mocked(syncWithDrive).mockRejectedValue(new Error("Google Drive answered 500"));
    render(<DriveSyncCard />);
    await waitFor(() => expect((screen.getByRole("button", { name: "Sync with Google Drive now" }) as HTMLButtonElement).disabled).toBe(false));
    click();
    expect(await screen.findByText("Sync failed, and nothing was lost: Google Drive answered 500")).toBeTruthy();
    expect(window.localStorage.getItem("moatmine.driveSynced")).toBeNull();
  });
});
