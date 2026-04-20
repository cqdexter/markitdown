import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MarkItDown 可视化工作台",
  description: "文档转 Markdown 可视化工具",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50">
        <noscript>
          <div className="bg-amber-100 px-4 py-3 text-center text-sm text-amber-950">
            请启用 JavaScript。本工具需要脚本才能处理上传与转换。
          </div>
        </noscript>
        {children}
      </body>
    </html>
  );
}
