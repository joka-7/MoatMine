// Screenshot every page and stock tab at desktop and phone width; report console errors,
// failed API calls and horizontal overflow. Usage: node shoot.js <outDir> [only-substring]
const { chromium } = require("playwright");
const OUT = process.argv[2];
const ONLY = process.argv[3] || "";
const BASE = "http://localhost:3000";
const PAGES = [
  ["dashboard", "/"], ["portfolio", "/portfolio"], ["watchlist", "/watchlist"], ["risk", "/risk"],
  ["plans", "/plans"], ["targets", "/targets"], ["agent", "/agent"], ["risk-profile", "/risk-profile"], ["settings", "/settings"],
  ...["overview", "safety", "valuation", "badtimes", "financials", "analysts", "news", "notes", "ai"].map((t) => [`stock-${t}`, `/stock?s=AAPL&tab=${t}`]),
];
const EXTRA = [["dashboard-paper", "/", "paper"], ["risk-paper", "/risk", "paper"]];

(async () => {
  const browser = await chromium.launch();
  const report = [];
  for (const width of [1400, 390]) {
    for (const [name, path, book] of [...PAGES, ...EXTRA]) {
      if (ONLY && !name.includes(ONLY)) continue;
      const ctx = await browser.newContext({ viewport: { width, height: width > 500 ? 900 : 844 }, deviceScaleFactor: 1 });
      await ctx.addInitScript((b) => { try { localStorage.setItem("moatmine.book", b); } catch {} }, book || "real");
      const page = await ctx.newPage();
      const errors = [];
      page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 200)); });
      page.on("pageerror", (e) => errors.push("pageerror: " + e.message.slice(0, 200)));
      page.on("response", (r) => { if (r.url().includes(":8000") && r.status() >= 400) errors.push(`api ${r.status()} ${r.url().replace("http://localhost:8000", "")}`); });
      const pending = new Set();
      page.on("request", (r) => pending.add(r.url()));
      page.on("requestfinished", (r) => pending.delete(r.url()));
      page.on("requestfailed", (r) => { pending.delete(r.url()); if (!r.url().includes("_rsc=")) errors.push(`failed ${r.failure()?.errorText} ${r.url().slice(0, 120)}`); });
      await page.goto(BASE + path, { waitUntil: "load" });
      await page.waitForTimeout(3500);
      for (const u of pending) errors.push("still pending " + u.slice(0, 120));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      const file = `${name}-${width}.png`;
      await page.screenshot({ path: `${OUT}/${file}`, fullPage: true });
      report.push({ file, overflow, errors });
      await ctx.close();
    }
  }
  await browser.close();
  for (const r of report) {
    const flags = [r.overflow > 0 ? `OVERFLOW ${r.overflow}px` : "", ...new Set(r.errors)].filter(Boolean);
    console.log(`${r.file}: ${flags.length ? flags.join(" | ") : "ok"}`);
  }
})();
