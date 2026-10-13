import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@iassistent/db", "@iassistent/staff-engine"],
  experimental: {
    serverActions: {
      // Team logo upload (max 2 MB) goes through a server action.
      bodySizeLimit: "3mb",
    },
  },
};

export default nextConfig;
