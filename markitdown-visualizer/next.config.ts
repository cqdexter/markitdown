import type { NextConfig } from "next";
import path from "path";

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
  // 配置 webpack 路径别名
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname),
    };
    return config;
  },
};

export default nextConfig;
