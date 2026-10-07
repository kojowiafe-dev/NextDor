import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.nextdor.online",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "nextdor.online",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "www.nextdor.online",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "nextdor.online",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.cloudinary.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.onrender.com",
        pathname: "/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/track-order",
        destination: "/track",
      },
    ];
  },
};

export default nextConfig;
