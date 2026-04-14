import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Temporary: enable browser source maps in production so we can debug React hydration errors.
  // Remove after fix if you want smaller builds.
  productionBrowserSourceMaps: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
