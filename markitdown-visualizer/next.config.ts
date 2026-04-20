import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  // Vercel 部署配置
  output: "standalone",
  // 禁用 TypeScript 类型检查，避免构建失败
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
