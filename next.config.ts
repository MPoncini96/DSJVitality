import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Data CSVs are read from disk at request/build time; make sure Vercel bundles them.
  outputFileTracingIncludes: { "/**": ["./data/**/*.csv"] },
};

export default nextConfig;
