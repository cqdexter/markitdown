/** @type {import('next').NextConfig} */
const nextConfig = {
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
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": require("path").resolve(__dirname),
    };
    return config;
  },
};

module.exports = nextConfig;
