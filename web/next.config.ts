import type { NextConfig } from "next";

// `npm run build:desktop` sets NEXT_OUTPUT=export: the UI is emitted as static files into ./out,
// which GitHub Pages serves and the Tauri desktop and Android apps load. `npm run build` is the
// server build, for hosts like Vercel.
const isExport = process.env.NEXT_OUTPUT === "export";
// GitHub Pages serves the site under /<repo>/ (pages.yml sets NEXT_BASE_PATH=/MoatMine); the
// desktop app and local builds serve it from the root.
const basePath = process.env.NEXT_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  ...(isExport
    ? {
        output: "export",
        basePath,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
