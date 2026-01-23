import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [new URL('https://avatar.iran.liara.run/**')],
  },
};

export default nextConfig;
