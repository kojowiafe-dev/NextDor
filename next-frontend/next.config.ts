import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "10.254.121.158",
    "10.254.121.243",
    "10.254.121.*",
    "10.*.*.*",
    "192.168.*.*",
    "172.*.*.*",
  ],
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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
        ],
      },
    ];
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
