import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // Vercel 部署配置
  output: "standalone",
};

export default nextConfig;
