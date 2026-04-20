"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { FileItem } from "@/types";
import { apiUrl } from "@/lib/resolve-api-url";
import { getActiveConfig } from "@/lib/llm-settings";
import { loadPaddleOcrSettings } from "@/lib/paddle-settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { renderAsync, parseAsync } from "docx-preview";
import * as XLSX from "xlsx";
import {
  Copy,
  Download,
  RefreshCw,
  FileText,
  Code,
  Eye,
  CheckCircle,
  AlertCircle,
  Loader2,
  Brain,
} from "lucide-react";

interface ConversionWorkspaceProps {
  file: FileItem;
}

export function ConversionWorkspace({ file }: ConversionWorkspaceProps) {
  const [markdown, setMarkdown] = useState<string>(file.markdown || "");
  const [status, setStatus] = useState<FileItem["status"]>(file.status);
  const [error, setError] = useState<string | undefined>(file.error);
  const [copied, setCopied] = useState(false);
  const [llmValidationStatus, setLlmValidationStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [llmValidationMessage, setLlmValidationMessage] = useState<string>("");
  const [progress, setProgress] = useState(0);
  // PaddleOCR 开关状态 - 初始 false（SSR 安全），挂载后同步
  const [paddleEnabled, setPaddleEnabled] = useState(false);
  useEffect(() => {
    setPaddleEnabled(loadPaddleOcrSettings().enabled);
  }, []);

  const lowerName = file.name.toLowerCase();
  const looksLike = {
    pdf: file.type.includes("pdf") || lowerName.endsWith(".pdf"),
    image: file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lowerName),
    audio: file.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|flac|ogg)$/.test(lowerName),
    video: file.type.startsWith("video/") || /\.(mp4|webm|mov|mkv|avi)$/.test(lowerName),
    text:
      file.type.startsWith("text/") ||
      ["application/json", "application/xml", "application/javascript"].some((t) =>
        file.type.includes(t)
      ) ||
      /\.(txt|md|csv|json|xml|html?)$/.test(lowerName),
  };

  const convertFile = useCallback(async () => {
    setStatus("converting");
    setError(undefined);
    setProgress(0);

    try {
        // 使用稳定的 paddleEnabled 状态（避免 stale closure 问题）
        const shouldUsePaddle = paddleEnabled && (looksLike.image || looksLike.pdf);

        if (shouldUsePaddle) {
          // PaddleOCR 路径
          setProgress(30);
          const formData = new FormData();
          formData.append("file", file.file);

          const response = await fetch(apiUrl("/api/convert-paddle"), {
            method: "POST",
            body: formData,
          });

          setProgress(80);
          const raw = await response.text();
          let data: { markdown?: string; error?: string; details?: string };
          try {
            data = JSON.parse(raw) as typeof data;
          } catch {
            throw new Error(raw.slice(0, 240) || `服务器返回非 JSON（HTTP ${response.status}）`);
          }
          if (!response.ok) {
            throw new Error(data.details || data.error || "PaddleOCR 转换失败");
          }

          setMarkdown(data.markdown ?? "");
          setProgress(100);
          setStatus("completed");
          return;
        }

      const formData = new FormData();
      formData.append("file", file.file);

      const endpoint = "/api/convert";

      // 模拟进度条
      setProgress(20);
      await new Promise(resolve => setTimeout(resolve, 500));
      setProgress(50);

      const response = await fetch(apiUrl(endpoint), {
        method: "POST",
        body: formData,
      });

      setProgress(80);
      const raw = await response.text();
      let data: { markdown?: string; error?: string; details?: string };
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        throw new Error(
          raw.slice(0, 240) || `服务器返回非 JSON（HTTP ${response.status}）`
        );
      }

      if (!response.ok) {
        // 针对vision API不支持的情况提供更清晰的错误信息
        if (data.details?.includes("vision") || data.details?.includes("image_url")) {
          throw new Error("当前LLM API不支持vision功能（图片识别）。请使用支持vision功能的模型（如 gpt-4o、gpt-4-vision 等），或者使用基础OCR功能。");
        }
        throw new Error(data.details || data.error || "转换失败");
      }

      setMarkdown(data.markdown ?? "");
      setProgress(100);
      setStatus("completed");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "未知错误");
      setProgress(0);
    }
  }, [file.file, looksLike.image]);

  useEffect(() => {
    void convertFile();
  }, [file.id, convertFile, paddleEnabled]);

  // 监听 PaddleOCR 设置变化，切换后重新转换
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "markitdown:paddleOcrSettings:v1") {
        const next = loadPaddleOcrSettings();
        setPaddleEnabled(next.enabled);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const content = markdown ?? "";
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name.replace(/\.[^/.]+$/, "") + ".md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRefresh = () => {
    convertFile();
  };

  const handleLlmValidation = async () => {
    const activeConfig = getActiveConfig();
    if (!activeConfig || !activeConfig.apiKey || !activeConfig.baseUrl) {
      setLlmValidationStatus("error");
      setLlmValidationMessage("请先在左侧设置 LLM API 并测试连接成功");
      return;
    }

    if (!activeConfig.model) {
      setLlmValidationStatus("error");
      setLlmValidationMessage("请先在左侧设置有效的模型名称");
      return;
    }

    if (!markdown) {
      setLlmValidationStatus("error");
      setLlmValidationMessage("没有可校验的 Markdown 内容");
      return;
    }

    // 用局部变量持有当前激活配置，避免异步过程中状态变化
    const llmSettings = activeConfig;

    setLlmValidationStatus("processing");
    setLlmValidationMessage("准备分段处理...");
    setProgress(0);

    try {
      // ── 分段参数 ──────────────────────────────────────────────
      // 每段输入不超过 2000 字符（给 prompt 模板留余量），输出上限放宽到 8192
      const CHUNK_SIZE = 2000;

      // 按段落边界切割，避免截断在句子中间
      const splitIntoChunks = (text: string, maxLen: number): string[] => {
        if (text.length <= maxLen) return [text];
        const chunks: string[] = [];
        let remaining = text;
        while (remaining.length > 0) {
          if (remaining.length <= maxLen) {
            chunks.push(remaining);
            break;
          }
          // 尝试在 maxLen 以内找最近的段落分隔符 \n\n
          let cutAt = remaining.lastIndexOf("\n\n", maxLen);
          if (cutAt < maxLen * 0.5) {
            // 退而求其次找换行符
            cutAt = remaining.lastIndexOf("\n", maxLen);
          }
          if (cutAt <= 0) cutAt = maxLen;
          chunks.push(remaining.slice(0, cutAt));
          remaining = remaining.slice(cutAt).trimStart();
        }
        return chunks;
      };

      const chunks = splitIntoChunks(markdown, CHUNK_SIZE);
      const total = chunks.length;
      const results: string[] = [];

      // ── 逐段调用 LLM ─────────────────────────────────────────
      const callLlm = async (content: string): Promise<string> => {
        const prompt = `请对以下 Markdown 文本进行格式整理，要求：
1. 修复标题层级、列表格式、表格对齐等格式问题
2. 保持原文内容不变，只做格式调整
3. 去掉无用的符号（如多余的装饰符号、乱码等）
4. 去掉页码（页脚中的页码数字）
5. 直接输出整理后的 Markdown，不要任何额外说明

Markdown 内容：
${content}`;

        const resp = await fetch(`${llmSettings.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${llmSettings.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: llmSettings.model,
            messages: [
              {
                role: "system",
                content: "你是一个文档格式化助手，负责整理 Markdown 文档的排版格式。"
              },
              { role: "user", content: prompt }
            ],
            temperature: 0.1,
            max_tokens: 8192,
          }),
        });

        if (!resp.ok) {
          const errorData = await resp.json().catch(() => ({})) as { error?: { message?: string } };
          const msg = errorData.error?.message || `HTTP ${resp.status}`;
          if (msg.includes("Model Not Exist")) throw new Error(`模型不存在: ${llmSettings.model}，请检查模型名称。`);
          if (msg.includes("Unauthorized")) throw new Error("API Key 无效或已过期，请检查设置。");
          if (msg.includes("rate limit")) throw new Error("API 速率限制，请稍后重试。");
          if (msg.includes("Content Exists Risk")) throw new Error("内容安全检查失败，建议跳过大模型排版，直接使用 MarkItDown 转换结果。");
          throw new Error(msg);
        }

        const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
        return data.choices?.[0]?.message?.content ?? "";
      };

      for (let i = 0; i < total; i++) {
        setLlmValidationMessage(
          total === 1
            ? "大模型正在排版..."
            : `正在处理第 ${i + 1} / ${total} 段...`
        );
        setProgress(Math.round(((i) / total) * 90) + 5);

        const result = await callLlm(chunks[i]);
        if (!result) throw new Error(`第 ${i + 1} 段未收到有效内容`);
        results.push(result);
      }

      const optimizedMarkdown = results.join("\n\n");
      setMarkdown(optimizedMarkdown);
      setProgress(100);
      setLlmValidationStatus("success");
      setLlmValidationMessage(
        total === 1
          ? "排版完成！Markdown 已优化"
          : `排版完成！共处理 ${total} 段`
      );
    } catch (err) {
      setLlmValidationStatus("error");
      setLlmValidationMessage(`校验失败: ${err instanceof Error ? err.message : "未知错误"}`);
      setProgress(0);
    }
  };

  const getFileIcon = () => {
    if (looksLike.pdf) return "📄";
    if (file.type.includes("word") || file.type.includes("doc") || /\.(docx?)$/.test(lowerName)) return "📝";
    if (file.type.includes("excel") || file.type.includes("sheet") || /\.(xlsx?|csv)$/.test(lowerName)) return "📊";
    if (file.type.includes("powerpoint") || file.type.includes("presentation") || /\.(pptx?)$/.test(lowerName)) return "📽️";
    if (looksLike.image) return "🖼️";
    if (looksLike.audio) return "🎵";
    if (looksLike.video) return "🎬";
    return "📎";
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getFileIcon()}</span>
          <div>
            <h2 className="font-semibold text-slate-900">{file.name}</h2>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{(file.size / 1024).toFixed(1)} KB</span>
              <span>•</span>
              <StatusBadge status={status} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={status !== "completed"}
            className="gap-1.5"
          >
            {copied ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-600" />
                已复制
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                复制
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={status !== "completed"}
            className="gap-1.5"
          >
            <Download className="w-4 h-4" />
            下载
          </Button>
          <Separator orientation="vertical" className="h-6 mx-1" />
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={status === "converting"}
            className="gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${status === "converting" ? "animate-spin" : ""}`} />
            重新转换
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleLlmValidation}
            disabled={status !== "completed" || llmValidationStatus === "processing"}
            className="gap-1.5"
          >
            {llmValidationStatus === "processing" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                排版中...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4" />
                大模型排版
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden p-4">
        {llmValidationMessage && (
          <div className={`mb-4 p-3 rounded-lg ${llmValidationStatus === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            <div className="flex items-start gap-2">
              {llmValidationStatus === "success" ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              ) : llmValidationStatus === "processing" ? (
                <Loader2 className="w-5 h-5 flex-shrink-0 mt-0.5 animate-spin" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className="text-sm">{llmValidationMessage}</p>
                
                {/* LLM排版进度条 */}
                {llmValidationStatus === "processing" && progress > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span>处理进度</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {status === "pending" || status === "converting" ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md w-full px-8">
              <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-lg font-medium text-slate-700">
                {status === "pending" ? "准备转换…" : "正在转换…"}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                使用 MarkItDown 处理中
              </p>
              
              {/* 进度条 */}
              {progress > 0 && (
                <div className="mt-6">
                  <div className="flex justify-between text-xs text-slate-500 mb-2">
                    <span>处理进度</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-blue-600 h-full rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : status === "error" ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-lg font-medium text-slate-700">转换失败</p>
              <p className="text-sm text-slate-500 mt-2">{error || "未知错误"}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                className="mt-4"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                重试
              </Button>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="preview" className="h-full flex flex-col">
            <TabsList className="grid w-full max-w-md grid-cols-3 mb-4">
              <TabsTrigger value="original" className="gap-2">
                <FileText className="w-4 h-4" />
                原文件
              </TabsTrigger>
              <TabsTrigger value="markdown" className="gap-2">
                <Code className="w-4 h-4" />
                Markdown
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-2">
                <Eye className="w-4 h-4" />
                预览
              </TabsTrigger>
            </TabsList>

            <TabsContent value="original" className="flex-1 overflow-hidden mt-0">
              <div className="h-full bg-white rounded-xl border border-slate-200 overflow-auto">
                <OriginalFilePreview file={file} />
              </div>
            </TabsContent>

            <TabsContent value="markdown" className="flex-1 overflow-hidden mt-0">
              <div className="h-full bg-white rounded-xl border border-slate-200 overflow-hidden">
                <Textarea
                  value={markdown}
                  onChange={(e) => setMarkdown(e.target.value)}
                  className="h-full w-full resize-none border-0 rounded-none font-mono text-sm p-6 focus-visible:ring-0"
                  placeholder="Markdown 内容..."
                />
              </div>
            </TabsContent>

            <TabsContent value="preview" className="flex-1 overflow-hidden mt-0">
              <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="h-full bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col min-h-0">
                  <div className="px-4 py-3 border-b border-slate-200 text-sm font-medium text-slate-700">
                    原文件
                  </div>
                  <div className="flex-1 min-h-0 overflow-auto">
                    <div className="h-full min-h-[360px]">
                      <OriginalFilePreview file={file} />
                    </div>
                  </div>
                </div>

                <div className="h-full bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col min-h-0">
                  <div className="px-4 py-3 border-b border-slate-200 text-sm font-medium text-slate-700">
                    预览（Markdown 渲染）
                  </div>
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="p-6 max-w-4xl mx-auto">
                      <article className="prose prose-slate max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {markdown}
                        </ReactMarkdown>
                      </article>
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: FileItem["status"] }) {
  const styles = {
    pending: "bg-slate-100 text-slate-600",
    converting: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    error: "bg-red-100 text-red-700",
  };

  const labels = {
    pending: "待转换",
    converting: "转换中",
    completed: "已完成",
    error: "失败",
  };

  return (
    <Badge variant="secondary" className={styles[status]}>
      {labels[status]}
    </Badge>
  );
}

// Original File Preview Component
function OriginalFilePreview({ file }: { file: FileItem }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const lowerName = file.name.toLowerCase();
  const looksLikePdf = file.type.includes("pdf") || lowerName.endsWith(".pdf");
  const looksLikeImage = file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lowerName);
  const looksLikeAudio = file.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|flac|ogg)$/.test(lowerName);
  const looksLikeVideo = file.type.startsWith("video/") || /\.(mp4|webm|mov|mkv|avi)$/.test(lowerName);
  const looksLikeText =
    file.type.startsWith("text/") ||
    ["application/json", "application/xml", "application/javascript"].some((t) =>
      file.type.includes(t)
    ) ||
    /\.(txt|md|csv|json|xml|html?)$/.test(lowerName);
  const looksLikeWord =
    /\.(docx?)$/.test(lowerName) ||
    [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ].includes(file.type);

  const looksLikeExcel =
    /\.(xlsx?|csv)$/.test(lowerName) ||
    [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ].includes(file.type);

  const looksLikePpt =
    /\.(pptx?)$/.test(lowerName) ||
    [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-powerpoint",
    ].includes(file.type);

  useEffect(() => {
    const url = URL.createObjectURL(file.file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file.file]);

  if (!objectUrl) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  // PDF Preview
  if (looksLikePdf) {
    return (
      <iframe
        src={objectUrl}
        className="w-full h-full"
        title={file.name}
      />
    );
  }

  // Image Preview
  if (looksLikeImage) {
    return (
      <div className="flex items-center justify-center min-h-full p-8 bg-slate-100">
        <img
          src={objectUrl}
          alt={file.name}
          className="max-w-full max-h-full object-contain shadow-lg rounded-lg"
        />
      </div>
    );
  }

  // Audio Preview
  if (looksLikeAudio) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <span className="text-6xl block mb-4">🎵</span>
          <p className="text-lg font-medium text-slate-600 mb-4">{file.name}</p>
          <audio controls src={objectUrl} className="w-96" />
        </div>
      </div>
    );
  }

  // Video Preview
  if (looksLikeVideo) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-900">
        <video
          src={objectUrl}
          controls
          className="max-w-full max-h-full"
        />
      </div>
    );
  }

  // Text-based files (HTML, XML, JSON, CSV, etc.)
  if (looksLikeText) {
    return <TextFilePreview file={file} />;
  }

  // Word Document Preview
  if (looksLikeWord) {
    return <WordPreview file={file} />;
  }

  // Excel Preview
  if (looksLikeExcel) {
    return <ExcelPreview file={file} />;
  }

  // PowerPoint Preview
  if (looksLikePpt) {
    return <PptPreview file={file} objectUrl={objectUrl} />;
  }

  // Unsupported file type
  return (
    <div className="flex items-center justify-center h-full text-slate-400">
      <div className="text-center">
        <span className="text-6xl block mb-4">📄</span>
        <p className="text-lg font-medium text-slate-600">{file.name}</p>
        <p className="text-sm mt-2 text-slate-500">暂不支持预览此文件类型</p>
        <p className="text-xs text-slate-400 mt-1">
          文件类型: {file.type || "未知"}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => {
            const a = document.createElement("a");
            a.href = objectUrl;
            a.download = file.name;
            a.click();
          }}
        >
          <Download className="w-4 h-4 mr-2" />
          下载文件
        </Button>
      </div>
    </div>
  );
}

// ── Word Document Preview ──────────────────────────────────────────
function WordPreview({ file }: { file: FileItem }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    // 用 FileReader 读取为 ArrayBuffer（最稳定的路径）
    const reader = new FileReader();
    reader.onload = async (e) => {
      if (cancelled || !containerRef.current) return;
      try {
        setLoading(true);
        setError(null);
        const arrayBuffer = e.target?.result as ArrayBuffer;
        if (!arrayBuffer) throw new Error("文件读取结果为空");

        await renderAsync(arrayBuffer as any, containerRef.current!, undefined, {
          className: "docx-wrapper docx-wrapper-office",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: false,
          useBase64URL: true,
        });

        if (!cancelled) setLoading(false);
      } catch (err) {
        if (!cancelled) {
          console.error("[WordPreview] render error:", err);
          setError(`预览失败: ${err instanceof Error ? err.message : "未知错误"}`);
          setLoading(false);
        }
      }
    };
    reader.onerror = () => {
      if (!cancelled) {
        setError("读取文件失败");
        setLoading(false);
      }
    };

    reader.readAsArrayBuffer(file.file);

    const timer = setTimeout(() => {
      if (!cancelled) {
        setError("预览超时，请尝试重新上传");
        setLoading(false);
      }
    }, 20000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [file.file]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500 text-sm p-4 text-center">
        {error}
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto p-4">
      <div ref={containerRef} className="docx-container [&_.docx-wrapper]:!bg-white [&_.docx-wrapper]:p-4 [&_.docx-wrapper]:min-h-full [&_.docx-preview]:!bg-white [&_.docx-preview]:min-h-full" />
    </div>
  );
}

// ── Excel Preview ─────────────────────────────────────────────────
function ExcelPreview({ file }: { file: FileItem }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState<string>("");
  const workbookRef = useRef<XLSX.WorkBook | null>(null);

  // 读取文件并解析
  useEffect(() => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result as ArrayBuffer;
        workbookRef.current = XLSX.read(data, { type: "array" });
        const names = workbookRef.current.SheetNames;
        setSheetNames(names);
        if (names.length > 0) {
          setActiveSheet(names[0]);
          renderSheet(names[0], data);
        }
        setLoading(false);
      } catch (err) {
        setError(`解析失败: ${err instanceof Error ? err.message : "未知错误"}`);
        setLoading(false);
      }
    };
    reader.onerror = () => setError("读取文件失败");
    reader.readAsArrayBuffer(file.file);
  }, [file.file]);

  const renderSheet = (sheetName: string, data?: ArrayBuffer) => {
    if (!containerRef.current) return;
    let workbook = workbookRef.current;
    if (!workbook && data) {
      workbook = XLSX.read(data, { type: "array" });
      workbookRef.current = workbook;
    }
    if (!workbook) return;

    const container = containerRef.current;
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return;

    container.innerHTML = "";
    const html = XLSX.utils.sheet_to_html(sheet, { editable: false });
    container.innerHTML = html;
  };

  const handleSheetChange = (sheetName: string) => {
    setActiveSheet(sheetName);
    renderSheet(sheetName);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500 text-sm p-4 text-center">
        {error}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Sheet 切换器 */}
      {sheetNames.length > 1 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 bg-white overflow-x-auto shrink-0">
          {sheetNames.map((name) => (
            <button
              key={name}
              onClick={() => handleSheetChange(name)}
              className={`px-3 py-1 text-xs rounded whitespace-nowrap transition-colors ${
                activeSheet === name
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {/* 表格内容 */}
      <div className="flex-1 overflow-auto bg-white">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <div
            ref={containerRef}
            className="p-4 [&_table]:border-collapse [&_table]:w-full [&_table]:text-sm [&_table]:border-slate-200 [&_td]:border [&_td]:border-slate-200 [&_td]:px-2 [&_td]:py-1 [&_td]:min-w-[60px] [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:px-2 [&_th]:py-1 [&_th]:font-semibold"
          />
        )}
      </div>
    </div>
  );
}

// ── PowerPoint Preview ─────────────────────────────────────────────
function PptPreview({ file, objectUrl }: { file: FileItem; objectUrl: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slideImages, setSlideImages] = useState<string[]>([]);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    const loadPptx = async () => {
      try {
        setLoading(true);
        setError(null);

        const JSZipLib = (await import("jszip")).default;
        const arrayBuffer = await file.file.arrayBuffer();
        const zip = await JSZipLib.loadAsync(arrayBuffer);

        // 提取幻灯片中的图片
        const mediaKeys = Object.keys(zip.files).filter(
          (k) => k.startsWith("ppt/media/") && /\.(png|jpeg|jpg)$/i.test(k)
        );

        if (mediaKeys.length > 0) {
          const images: string[] = [];
          for (const key of mediaKeys.slice(0, 50)) {
            const imgBlob = await zip.files[key].async("blob");
            images.push(URL.createObjectURL(imgBlob));
          }
          setSlideImages(images);
        }

        setLoading(false);
      } catch (err) {
        setError(`预览失败: ${err instanceof Error ? err.message : "未知错误"}`);
        setLoading(false);
      }
    };

    loadPptx();
  }, [file.file]);

  // PPT 提取图片预览：有图片就展示图片，否则显示提示
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500 text-sm p-4 text-center">
        {error}
      </div>
    );
  }

  if (slideImages.length > 0) {
    return (
      <div className="h-full flex flex-col bg-slate-50">
        {/* 幻灯片导航 */}
        <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 shrink-0">
          <button
            onClick={() => setSlideIndex(Math.max(0, slideIndex - 1))}
            disabled={slideIndex === 0}
            className="px-3 py-1 text-sm bg-slate-100 rounded disabled:opacity-40 hover:bg-slate-200 transition-colors"
          >
            ← 上一页
          </button>
          <span className="text-sm text-slate-600">
            第 {slideIndex + 1} / {slideImages.length} 张
          </span>
          <button
            onClick={() => setSlideIndex(Math.min(slideImages.length - 1, slideIndex + 1))}
            disabled={slideIndex === slideImages.length - 1}
            className="px-3 py-1 text-sm bg-slate-100 rounded disabled:opacity-40 hover:bg-slate-200 transition-colors"
          >
            下一页 →
          </button>
        </div>
        {/* 图片展示 */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-slate-100">
          <img
            src={slideImages[slideIndex]}
            alt={`幻灯片 ${slideIndex + 1}`}
            className="max-w-full max-h-full object-contain rounded shadow"
          />
        </div>
      </div>
    );
  }

  // 没有提取到图片，显示提示
  return (
    <div className="flex flex-col items-center justify-center h-full bg-slate-50 p-8">
      <div className="text-center max-w-md">
        <span className="text-6xl block mb-4">📽️</span>
        <p className="text-lg font-medium text-slate-600 mb-2">{file.name}</p>
        <p className="text-sm text-slate-500 mb-4">
          PowerPoint 文档原文件预览有限，建议使用右侧的 <strong>Markdown 预览</strong>查看转换结果。
        </p>
        <p className="text-xs text-slate-400 mb-6">
          如需原文件对照，请将 PPT 另存为 PDF 后上传。
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const a = document.createElement("a");
            a.href = objectUrl;
            a.download = file.name;
            a.click();
          }}
        >
          <Download className="w-4 h-4 mr-2" />
          下载原文件
        </Button>
      </div>
    </div>
  );
}

// Text File Preview Component
function TextFilePreview({ file }: { file: FileItem }) {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setContent(e.target?.result as string);
      setLoading(false);
    };
    reader.readAsText(file.file);
  }, [file.file]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <pre className="p-6 font-mono text-sm text-slate-700 whitespace-pre-wrap break-all">
      {content}
    </pre>
  );
}
