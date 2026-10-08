import type { NextConfig } from "next";

// Vercel: normal build. Desktop (Tauri): `npm run build:desktop` sets NEXT_OUTPUT=export
// so the same UI is emitted as static files into ./out for the Tauri shell.
const isExport = process.env.NEXT_OUTPUT === "export";

const nextConfig: NextConfig = {
  ...(isExport
    ? {
        output: "export",
        images: { unoptimized: true },
        trailingSlash: true,
        // @clerk/nextjs's App Router provider carries a Server Action, which a static export can't
        // ship. The export gets @clerk/react (what @clerk/nextjs wraps) with the same client API.
        turbopack: { resolveAlias: { "@clerk/nextjs": "@clerk/react" } },
      }
    : {}),
};

export default nextConfig;
