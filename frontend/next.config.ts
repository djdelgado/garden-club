import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "s3.localhost.localstack.cloud",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "4566",
      },
    ],
  },
};

export default nextConfig;
