"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { FileUploadZone } from "@/components/file-upload-zone";
import { ConversionWorkspace } from "@/components/conversion-workspace";
import { LlmOcrSettingsPanel } from "@/components/llm-ocr-settings";
import { FileItem } from "@/types";
import { fileItemsFromDrop } from "@/lib/file-from-drop";
import { Button } from "@/components/ui/button";
import { Archive } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";

export default function Home() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [runtimeWarning, setRuntimeWarning] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.protocol === "file:") {
      setRuntimeWarning(
        "检测到你是用 file:// 打开本页：脚本通常无法运行，选文件后界面不会更新。请在项目目录执行 npm run dev，然后访问 http://localhost:3000 ；或使用 npm run build 后执行 npm run start。"
      );
    }
  }, []);

  const handleFilesAdded = useCallback((newFiles: FileItem[]) => {
    if (newFiles.length === 0) return;
    setFiles((prev) => [...prev, ...newFiles]);
    setActiveFileId(newFiles[0].id);
  }, []);

  const handleFileRemove = useCallback((fileId: string) => {
    setFiles((prev) => {
      const filtered = prev.filter((f) => f.id !== fileId);
      if (activeFileId === fileId) {
        setActiveFileId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
  }, [activeFileId]);

  const handleFileSelect = useCallback((fileId: string) => {
    setActiveFileId(fileId);
  }, []);

  const activeFile = files.find((f) => f.id === activeFileId);

  return (
    <main className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">MarkItDown</h1>
            <p className="text-sm text-slate-500">文档转 Markdown 可视化工作台</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/microsoft/markitdown"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-slate-600 hover:text-blue-600 transition-colors"
          >
            关于
          </a>
        </div>
      </header>

      {runtimeWarning ? (
        <div
          role="alert"
          className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          {runtimeWarning}
        </div>
      ) : null}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - File List */}
        <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-200">
            <FileUploadZone onFilesAdded={handleFilesAdded} />
          </div>
          <div className="p-3 border-b border-slate-200">
            <LlmOcrSettingsPanel />
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {files.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                暂无文件
              </div>
            ) : (
              <div className="space-y-1">
                {files.map((file) => (
                  <FileListItem
                    key={file.id}
                    file={file}
                    isActive={file.id === activeFileId}
                    onSelect={() => handleFileSelect(file.id)}
                    onRemove={() => handleFileRemove(file.id)}
                  />
                ))}
              </div>
            )}
          </div>
          {files.length > 0 && (
            <div className="p-3 border-t border-slate-200 space-y-2">
              <div className="text-xs text-slate-500 text-center">
                共 {files.length} 个文件
              </div>
              <BatchExportButton files={files} />
            </div>
          )}
        </aside>

        {/* Main Workspace — whole panel accepts file / text drop */}
        <WorkspaceDropZone onFilesAdded={handleFilesAdded}>
          {activeFile ? (
            <ConversionWorkspace key={activeFile.id} file={activeFile} />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400">
              <div className="text-center pointer-events-none">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-slate-300"
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
                <p className="text-lg font-medium text-slate-600">
                  拖拽文件或文本到此处开始转换
                </p>
                <p className="text-sm mt-1">
                  支持 PDF、Word、Excel、PPT；也可拖入选中的文字
                </p>
              </div>
            </div>
          )}
        </WorkspaceDropZone>
      </div>
    </main>
  );
}

function WorkspaceDropZone({
  children,
  onFilesAdded,
}: {
  children: React.ReactNode;
  onFilesAdded: (files: FileItem[]) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const depthRef = useRef(0);

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    depthRef.current += 1;
    setIsDragging(true);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    depthRef.current -= 1;
    if (depthRef.current <= 0) {
      depthRef.current = 0;
      setIsDragging(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    depthRef.current = 0;
    setIsDragging(false);
    const next = fileItemsFromDrop(e);
    if (next.length > 0) {
      onFilesAdded(next);
    }
  };

  return (
    <div
      className={`flex-1 overflow-hidden relative min-h-0 ${
        isDragging ? "ring-2 ring-blue-400 ring-inset bg-blue-50/40" : ""
      }`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {children}
    </div>
  );
}

// Batch Export Button Component
function BatchExportButton({ files }: { files: FileItem[] }) {
  const [exporting, setExporting] = useState(false);

  const handleBatchExport = async () => {
    const completedFiles = files.filter(f => f.status === "completed" && f.markdown);
    if (completedFiles.length === 0) {
      alert("没有可导出的已完成文件");
      return;
    }

    setExporting(true);
    try {
      const zip = new JSZip();
      
      completedFiles.forEach(file => {
        const mdContent = file.markdown || "";
        const fileName = file.name.replace(/\.[^/.]+$/, "") + ".md";
        zip.file(fileName, mdContent);
      });

      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `markitdown-export-${new Date().toISOString().slice(0, 10)}.zip`);
    } catch (error) {
      console.error("导出失败:", error);
      alert("导出失败，请重试");
    } finally {
      setExporting(false);
    }
  };

  const completedCount = files.filter(f => f.status === "completed" && f.markdown).length;

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full gap-2"
      onClick={handleBatchExport}
      disabled={exporting || completedCount === 0}
    >
      {exporting ? (
        <>
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          打包中...
        </>
      ) : (
        <>
          <Archive className="w-4 h-4" />
          批量导出 ({completedCount})
        </>
      )}
    </Button>
  );
}

// File List Item Component
function FileListItem({
  file,
  isActive,
  onSelect,
  onRemove,
}: {
  file: FileItem;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const getFileIcon = (type: string) => {
    if (type.includes("pdf")) return "📄";
    if (type.includes("word") || type.includes("doc")) return "📝";
    if (type.includes("excel") || type.includes("sheet")) return "📊";
    if (type.includes("powerpoint") || type.includes("presentation")) return "📽️";
    if (type.includes("image")) return "🖼️";
    if (type.includes("audio")) return "🎵";
    return "📎";
  };

  const getStatusIcon = (status: FileItem["status"]) => {
    switch (status) {
      case "converting":
        return (
          <svg className="w-4 h-4 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        );
      case "completed":
        return <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
      case "error":
        return <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>;
      default:
        return <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
        isActive
          ? "bg-blue-50 border border-blue-200"
          : "hover:bg-slate-100 border border-transparent"
      }`}
    >
      <span className="text-lg shrink-0">{getFileIcon(file.type)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
        <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
      </div>
      <div className="flex items-center gap-1">
        {getStatusIcon(file.status)}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="p-1 opacity-0 group-hover:opacity-100 hover:bg-slate-200 rounded transition-all"
        >
          <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
