import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    return [
      {
        source: "/api/explanation/:path*",
        headers: [
          { key: "Connection", value: "keep-alive" },
        ],
      },
    ];
  },
};

export default nextConfig;