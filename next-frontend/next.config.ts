import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.nextdor.online",
        pathname: "/wp-content/uploads/**",
      },
      {
        protocol: "https",
        hostname: "nextdor.online",
        pathname: "/wp-content/uploads/**",
      },
    ],
  },
};

export default nextConfig;
