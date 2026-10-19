import { defineConfig, devices } from "@playwright/test";

// Smoke tests run against the real stack: the FastAPI backend in dev-auth mode with the mock market
// provider (no keys), and the static export (`npm run build:desktop`) served from ./out.
// Set PLAYWRIGHT_CHROMIUM_EXECUTABLE to use an already-installed Chromium instead of Playwright's own.
const API = "http://localhost:8000";
const WEB = "http://localhost:3000";
const chromium = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
const python = process.env.E2E_PYTHON ?? "python";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: WEB, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], ...(chromium ? { launchOptions: { executablePath: chromium } } : {}) } },
  ],
  webServer: [
    {
      // a fresh SQLite file per run, so every run starts from an empty database
      command: `rm -f e2e.sqlite && ${python} -m alembic upgrade head && ${python} -m uvicorn app.main:app --port 8000`,
      cwd: "../backend",
      env: { AUTH_MODE: "dev", MARKET_PROVIDER: "mock", DATABASE_URL: "sqlite:///./e2e.sqlite" },
      url: `${API}/health/ready`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: `${python} -m http.server 3000 --directory out`,
      url: WEB,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
