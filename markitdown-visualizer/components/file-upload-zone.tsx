"use client";

import { useId, useRef, useState } from "react";
import type { FileItem } from "@/types";
import { fileItemsFromDrop } from "@/lib/file-from-drop";

interface FileUploadZoneProps {
  onFilesAdded: (files: FileItem[]) => void;
}

export function FileUploadZone({ onFilesAdded }: FileUploadZoneProps) {
  const inputId = useId();
  const [isDragging, setIsDragging] = useState(false);
  const dragDepthRef = useRef(0);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const list = input.files;
    if (!list || list.length === 0) return;

    void (async () => {
      try {
        const files = await Promise.all(
          Array.from(list).map(async (f) => {
            const buf = await f.arrayBuffer();
            return new File([buf], f.name, {
              type: f.type,
              lastModified: f.lastModified,
            });
          })
        );

        const newFiles: FileItem[] = files.map((file) => ({
          id: Math.random().toString(36).substring(2, 11),
          name: file.name,
          size: file.size,
          type: file.type,
          file,
          status: "pending" as const,
          createdAt: new Date(),
        }));

        onFilesAdded(newFiles);
      } catch (err) {
        console.error(err);
        window.alert(
          "读取所选文件失败。若你是直接双击打开的 HTML，请改用：在项目目录运行 npm run dev，并用浏览器访问 http://localhost:3000"
        );
      } finally {
        input.value = "";
      }
    })();
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      dragDepthRef.current = 0;
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragging(false);

    const newFiles = fileItemsFromDrop(e);
    if (newFiles.length > 0) {
      onFilesAdded(newFiles);
    }
  };

  return (
    <label
      htmlFor={inputId}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`block border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all select-none ${
        isDragging
          ? "border-blue-500 bg-blue-50"
          : "border-slate-300 hover:border-blue-400 hover:bg-slate-50"
      }`}
    >
      <input
        id={inputId}
        type="file"
        multiple
        onChange={handleFileSelect}
        className="sr-only"
      />
      <div className="flex flex-col items-center gap-2 pointer-events-none">
        <svg
          className="w-8 h-8 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <div className="text-sm">
          <span className="text-blue-600 font-medium">点击或拖拽</span>
          <span className="text-slate-600">上传文件或文本</span>
        </div>
        <p className="text-xs text-slate-400">
          支持 PDF、Word、Excel、PPT；也可拖入选中的文字
        </p>
      </div>
    </label>
  );
}
