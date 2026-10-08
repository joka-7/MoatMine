import type { MetadataRoute } from "next";

// What Chrome, Edge and phones need to offer "Install app": a name, icons and a standalone window.
// Paths carry the GitHub Pages base path (empty for Vercel and the desktop app).
const base = process.env.NEXT_BASE_PATH ?? "";

export const dynamic = "force-static"; // the static export prerenders it to manifest.webmanifest

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MoatMine",
    short_name: "MoatMine",
    description: "Risk-aware investing: your own risk rules, safety scores and stress tests.",
    start_url: `${base}/`,
    scope: `${base}/`,
    display: "standalone",
    background_color: "#0c0e11",
    theme_color: "#0c0e11",
    icons: [
      { src: `${base}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${base}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
  };
}
