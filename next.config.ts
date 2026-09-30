import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdf-parse (via pdfjs-dist) dynamically loads its own worker script by
  // file path at runtime. Bundling it rewrites/inlines that path and it can
  // no longer find pdf.worker.mjs, failing with "Setting up fake worker
  // failed". Excluding it from the server bundle lets Node resolve it
  // directly from node_modules instead, both locally and on Vercel.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist", "@napi-rs/canvas"],

  // serverExternalPackages alone isn't enough on Vercel: the file that's
  // missing isn't a bundling problem, it's a deployment problem. Next.js's
  // output file tracer only ships files it can statically detect a route
  // depends on, and pdfjs-dist's worker/cmap/font files are all loaded via
  // dynamically-computed paths it can't see -- confirmed missing from
  // .next/server/app/api/upload/route.js.nft.json (only pdf.mjs itself was
  // traced). This explicitly ships the whole package so Vercel's deployed
  // function actually has the files pdfjs-dist looks for at runtime.
  // @napi-rs/canvas is what supplies the DOMMatrix/ImageData/Path2D
  // polyfills pdfjs-dist needs to run under Node at all. pdfjs loads it
  // through a try/catch require, so the tracer never sees it -- it was
  // absent from the deployed function, the polyfill silently warned, and
  // then the module threw "ReferenceError: DOMMatrix is not defined" on
  // every PDF upload (confirmed in Vercel's runtime logs). Its native
  // binary lives in a separate per-platform package
  // (@napi-rs/canvas-linux-x64-gnu on Vercel), hence the @napi-rs/** glob
  // rather than naming the one package.
  outputFileTracingIncludes: {
    "/api/upload": ["./node_modules/pdfjs-dist/**", "./node_modules/@napi-rs/**"],
  },
};

export default nextConfig;
