import type { NextConfig } from "next";

// Static export — works on GitHub Pages (sub-path) and Cloudflare Pages (root).
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
};

export default nextConfig;
