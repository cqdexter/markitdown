"use client";

import { useState, useEffect, useRef } from "react";
import type { LlmApiConfig } from "@/types/llm";
import { getDefaultDeepSeekConfig, genConfigId } from "@/types/llm";
import { loadLlmSettings, saveLlmSettings } from "@/lib/llm-settings";
import { loadPaddleOcrSettings, savePaddleOcrSettings } from "@/lib/paddle-settings";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle, AlertCircle, ChevronDown, ChevronRight, Plus, Trash2, Settings, Cpu } from "lucide-react";

// SSR 安全的初始默认值（固定 id，不用 Date.now()）
function getDefaultDeepSeekConfig_settings() {
  const def = getDefaultDeepSeekConfig();
  return { configs: [def], activeConfigId: def.id };
}

export function LlmOcrSettingsPanel() {
  const [isCollapsed, setIsCollapsed] = useState(true);
  // 初始值用 SSR 安全的默认值，挂载后再从 localStorage 同步
  const [settings, setSettings] = useState(getDefaultDeepSeekConfig_settings);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState<string>("");
  const [editingConfig, setEditingConfig] = useState<LlmApiConfig | null>(null);

  // PaddleOCR 状态
  const [paddleCollapsed, setPaddleCollapsed] = useState(true);
  const [paddleSettings, setPaddleSettings] = useState<{ enabled: boolean; token: string }>({ enabled: false, token: "" });
  const [paddleTestStatus, setPaddleTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [paddleTestMessage, setPaddleTestMessage] = useState<string>("");

  // 标记是否已挂载（客户端）
  const mounted = useRef(false);

  // 挂载后从 localStorage 同步真实数据
  useEffect(() => {
    mounted.current = true;
    setSettings(loadLlmSettings());
    setPaddleSettings(loadPaddleOcrSettings());
  }, []);

  // 保存大模型设置（仅客户端）
  useEffect(() => {
    if (!mounted.current) return;
    saveLlmSettings(settings);
  }, [settings]);

  // 保存 PaddleOCR 设置（仅客户端）
  useEffect(() => {
    if (!mounted.current) return;
    savePaddleOcrSettings(paddleSettings);
  }, [paddleSettings]);

  // 添加新配置
  const addConfig = () => {
    const newConfig: LlmApiConfig = {
      id: genConfigId(),
      name: `API ${settings.configs.length + 1}`,
      baseUrl: "",
      model: "",
      apiKey: "",
      enabled: true,
    };
    setSettings(s => ({
      ...s,
      configs: [...s.configs, newConfig],
      activeConfigId: newConfig.id,
    }));
    setEditingConfig(newConfig);
    setTestStatus("idle");
    setTestMessage("");
  };

  // 删除配置
  const deleteConfig = (id: string) => {
    if (settings.configs.length <= 1) {
      setTestMessage("至少需要保留一个 API 配置");
      return;
    }
    const newConfigs = settings.configs.filter(c => c.id !== id);
    const newActiveId = settings.activeConfigId === id ? newConfigs[0].id : settings.activeConfigId;
    setSettings(s => ({
      ...s,
      configs: newConfigs,
      activeConfigId: newActiveId,
    }));
    if (editingConfig?.id === id) {
      setEditingConfig(null);
    }
  };

  // 更新配置
  const updateConfig = (updated: LlmApiConfig) => {
    setSettings(s => ({
      ...s,
      configs: s.configs.map(c => c.id === updated.id ? updated : c),
    }));
    setEditingConfig(updated);
  };

  // 测试连接
  const testConnection = async (config: LlmApiConfig) => {
    if (!config.apiKey || !config.baseUrl) {
      setTestStatus("error");
      setTestMessage("请填写 API Key 和 Base URL");
      return;
    }

    setTestStatus("testing");
    setTestMessage("测试连接中...");

    try {
      const response = await fetch(`${config.baseUrl}/models`, {
        headers: {
          "Authorization": `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        setTestStatus("success");
        setTestMessage("连接成功！");
      } else {
        const errorData = await response.json().catch(() => ({}));
        setTestStatus("error");
        setTestMessage(`连接失败: ${errorData.error?.message || `HTTP ${response.status}`}`);
      }
    } catch (error) {
      setTestStatus("error");
      setTestMessage(`连接失败: ${(error as Error).message}`);
    }
  };

  // 切换激活配置
  const switchConfig = (id: string) => {
    setSettings(s => ({ ...s, activeConfigId: id }));
    setEditingConfig(settings.configs.find(c => c.id === id) || null);
    setTestStatus("idle");
    setTestMessage("");
  };

  const activeConfig = settings.configs.find(c => c.id === settings.activeConfigId);
  const currentEditing = editingConfig || activeConfig;

  return (
  <div className="space-y-3">
    <Card className="overflow-hidden">
      {/* 折叠头部 */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-semibold text-slate-900">大模型 API 设置</span>
          {activeConfig && (
            <span className="text-xs text-slate-500">
              ({activeConfig.name})
            </span>
          )}
        </div>
        {isCollapsed ? (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* 折叠内容 */}
      {!isCollapsed && (
        <div className="p-4 space-y-4">
          {/* API 列表 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-700">已保存的 API</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={addConfig}
                className="h-7 text-xs gap-1"
              >
                <Plus className="w-3 h-3" />
                添加
              </Button>
            </div>
            
            {/* API 选择器 */}
            <div className="flex flex-wrap gap-2">
              {settings.configs.map(config => (
                <button
                  key={config.id}
                  onClick={() => switchConfig(config.id)}
                  className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                    config.id === settings.activeConfigId
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {config.name}
                </button>
              ))}
            </div>
          </div>

          {/* 配置表单 */}
          {currentEditing && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <div className="text-xs font-medium text-slate-700">名称</div>
                  <input
                    value={currentEditing.name}
                    onChange={(e) => updateConfig({ ...currentEditing, name: e.target.value })}
                    placeholder="如：DeepSeek"
                    className="w-full h-8 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  />
                </label>

                <label className="space-y-1">
                  <div className="text-xs font-medium text-slate-700">Model</div>
                  <input
                    value={currentEditing.model}
                    onChange={(e) => updateConfig({ ...currentEditing, model: e.target.value })}
                    placeholder="deepseek-chat"
                    className="w-full h-8 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  />
                </label>
              </div>

              <label className="space-y-1">
                <div className="text-xs font-medium text-slate-700">Base URL</div>
                <input
                  value={currentEditing.baseUrl}
                  onChange={(e) => {
                    updateConfig({ ...currentEditing, baseUrl: e.target.value.trim() });
                    setTestStatus("idle");
                    setTestMessage("");
                  }}
                  placeholder="https://api.deepseek.com/v1"
                  className="w-full h-8 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </label>

              <label className="space-y-1">
                <div className="text-xs font-medium text-slate-700">API Key</div>
                <input
                  value={currentEditing.apiKey}
                  onChange={(e) => {
                    updateConfig({ ...currentEditing, apiKey: e.target.value });
                    setTestStatus("idle");
                    setTestMessage("");
                  }}
                  placeholder="sk-..."
                  type="password"
                  className="w-full h-8 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                />
              </label>

              {testMessage && (
                <div className={`text-xs p-2 rounded ${
                  testStatus === "success" ? "bg-green-50 text-green-700" :
                  testStatus === "error" ? "bg-red-50 text-red-700" :
                  "bg-slate-50 text-slate-600"
                }`}>
                  {testStatus === "success" && <CheckCircle className="w-3.5 h-3.5 inline mr-1" />}
                  {testStatus === "error" && <AlertCircle className="w-3.5 h-3.5 inline mr-1" />}
                  {testStatus === "testing" && <Loader2 className="w-3.5 h-3.5 inline mr-1 animate-spin" />}
                  {testMessage}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => testConnection(currentEditing)}
                  disabled={testStatus === "testing"}
                >
                  {testStatus === "testing" ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      测试中...
                    </>
                  ) : (
                    "测试连接"
                  )}
                </Button>

                {settings.configs.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteConfig(currentEditing.id)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          )}

          <p className="text-xs text-slate-400 text-center">
            API Key 仅保存在本机浏览器 LocalStorage
          </p>
        </div>
      )}
    </Card>

    {/* PaddleOCR 设置卡片 */}
    <Card className="overflow-hidden">
      <button
        onClick={() => setPaddleCollapsed(!paddleCollapsed)}
        className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-slate-600" />
          <span className="text-sm font-semibold text-slate-900">PaddleOCR 设置</span>
          {paddleSettings.enabled && (
            <span className="text-xs text-blue-600 font-medium">已启用</span>
          )}
        </div>
        {paddleCollapsed ? (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {!paddleCollapsed && (
        <div className="p-4 space-y-3">
          {/* 开关 */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-slate-700">启用 PaddleOCR</div>
              <div className="text-xs text-slate-400 mt-0.5">
                图片 / PDF 优先使用 PaddleOCR 解析
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={paddleSettings.enabled}
                onChange={(e) => {
                  setPaddleSettings(s => ({ ...s, enabled: e.target.checked }));
                  setPaddleTestStatus("idle");
                  setPaddleTestMessage("");
                }}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-blue-500/20 rounded-full
                peer peer-checked:after:translate-x-4 after:content-[''] after:absolute after:top-0.5
                after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all
                peer-checked:bg-blue-600 relative">
              </div>
            </label>
          </div>

          <p className="text-xs text-slate-500">
            支持 PDF / 图片的布局解析、表格识别、公式识别，直接输出 Markdown。
          </p>

          {paddleSettings.enabled && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={async () => {
                  setPaddleTestStatus("testing");
                  setPaddleTestMessage("正在测试连接...");
                  try {
                    const resp = await fetch("/api/convert-paddle", {
                      method: "POST",
                      body: new FormData(),
                    });
                    if (resp.status === 400) {
                      setPaddleTestStatus("success");
                      setPaddleTestMessage("API 连接正常");
                    } else {
                      throw new Error(`HTTP ${resp.status}`);
                    }
                  } catch (err) {
                    setPaddleTestStatus("error");
                    setPaddleTestMessage(`连接失败: ${err instanceof Error ? err.message : "未知错误"}`);
                  }
                }}
                disabled={paddleTestStatus === "testing"}
              >
                {paddleTestStatus === "testing" ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />测试中...</>
                ) : (
                  "测试 API 连接"
                )}
              </Button>

              {paddleTestMessage && (
                <div className={`text-xs p-2 rounded ${
                  paddleTestStatus === "success" ? "bg-green-50 text-green-700" :
                  paddleTestStatus === "error" ? "bg-red-50 text-red-700" :
                  "bg-slate-50 text-slate-600"
                }`}>
                  {paddleTestStatus === "success" && <CheckCircle className="w-3.5 h-3.5 inline mr-1" />}
                  {paddleTestStatus === "error" && <AlertCircle className="w-3.5 h-3.5 inline mr-1" />}
                  {paddleTestStatus === "testing" && <Loader2 className="w-3.5 h-3.5 inline mr-1 animate-spin" />}
                  {paddleTestMessage}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </Card>
  </div>
);
}
