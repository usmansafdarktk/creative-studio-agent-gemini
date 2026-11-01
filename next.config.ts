import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server for the Cloud Run container image.
  output: "standalone",
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
