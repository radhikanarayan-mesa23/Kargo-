import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (via pdfjs-dist) dynamically loads its own worker script by
  // file path at runtime. Bundling it rewrites/inlines that path and it can
  // no longer find pdf.worker.mjs, failing with "Setting up fake worker
  // failed". Excluding it from the server bundle lets Node resolve it
  // directly from node_modules instead, both locally and on Vercel.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],

  // serverExternalPackages alone isn't enough on Vercel: the file that's
  // missing isn't a bundling problem, it's a deployment problem. Next.js's
  // output file tracer only ships files it can statically detect a route
  // depends on, and pdfjs-dist's worker/cmap/font files are all loaded via
  // dynamically-computed paths it can't see -- confirmed missing from
  // .next/server/app/api/upload/route.js.nft.json (only pdf.mjs itself was
  // traced). This explicitly ships the whole package so Vercel's deployed
  // function actually has the files pdfjs-dist looks for at runtime.
  outputFileTracingIncludes: {
    "/api/upload": ["./node_modules/pdfjs-dist/**"],
  },
};

export default nextConfig;
