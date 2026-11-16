import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The development badge sits in the bottom left corner, on top of the Home tab.
  devIndicators: false,
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
