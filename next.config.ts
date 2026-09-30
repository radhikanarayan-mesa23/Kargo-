import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (via pdfjs-dist) dynamically loads its own worker script by
  // file path at runtime. Bundling it rewrites/inlines that path and it can
  // no longer find pdf.worker.mjs, failing with "Setting up fake worker
  // failed". Excluding it from the server bundle lets Node resolve it
  // directly from node_modules instead, both locally and on Vercel.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
