import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [new URL('https://avatar.iran.liara.run/**')],
  },
};

export default nextConfig;
