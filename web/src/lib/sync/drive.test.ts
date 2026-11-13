import { describe, expect, it, vi } from "vitest";
import { DriveAuthError, DriveError, googleDriveFiles, SYNC_FILE_NAME } from "./drive";

const reply = (body: unknown, status = 200) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status });

describe("googleDriveFiles", () => {
  it("looks for the sync file in the app data folder with the user's token", async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply({ files: [{ id: "abc" }] }));
    expect(await googleDriveFiles("tok", fetchFn).find()).toBe("abc");
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("spaces=appDataFolder");
    expect(decodeURIComponent(url)).toContain(`name='${SYNC_FILE_NAME}'`);
    expect(init.headers).toEqual({ Authorization: "Bearer tok" });
  });

  it("finds nothing when the file does not exist", async () => {
    expect(await googleDriveFiles("tok", vi.fn().mockResolvedValue(reply({ files: [] }))).find()).toBeNull();
  });

  it("downloads a file's content", async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply("the content"));
    expect(await googleDriveFiles("tok", fetchFn).download("abc")).toBe("the content");
    expect(String(fetchFn.mock.calls[0]?.[0])).toBe("https://www.googleapis.com/drive/v3/files/abc?alt=media");
  });

  it("creates the file in the app data folder with a multipart upload and returns its id", async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply({ id: "new-id" }));
    expect(await googleDriveFiles("tok", fetchFn).create('{"a":1}')).toBe("new-id");
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("uploadType=multipart");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toMatch(/^multipart\/related; boundary=/);
    expect(String(init.body)).toContain('"parents":["appDataFolder"]');
    expect(String(init.body)).toContain(`"name":"${SYNC_FILE_NAME}"`);
    expect(String(init.body)).toContain('{"a":1}');
  });

  it("updates an existing file's content", async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply({}));
    await googleDriveFiles("tok", fetchFn).update("abc", '{"b":2}');
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://www.googleapis.com/upload/drive/v3/files/abc?uploadType=media");
    expect(init).toMatchObject({ method: "PATCH", body: '{"b":2}' });
  });

  it.each([401, 403])("reports %i as a sign-in problem", async (status) => {
    const drive = googleDriveFiles("tok", vi.fn().mockResolvedValue(reply("denied", status)));
    await expect(drive.find()).rejects.toBeInstanceOf(DriveAuthError);
  });

  it("reports any other failure as a Drive error carrying the status", async () => {
    const drive = googleDriveFiles("tok", vi.fn().mockResolvedValue(reply("boom", 500)));
    const error = await drive.find().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DriveError);
    expect(error).not.toBeInstanceOf(DriveAuthError);
    expect((error as DriveError).status).toBe(500);
  });
});
