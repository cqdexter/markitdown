import type { LlmSettings, LlmApiConfig } from "@/types/llm";
import { getDefaultDeepSeekConfig } from "@/types/llm";

const STORAGE_KEY = "markitdown:llmSettings:v2";

export function loadLlmSettings(): LlmSettings {
  if (typeof window === "undefined") {
    return {
      configs: [getDefaultDeepSeekConfig()],
      activeConfigId: "",
    };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // 首次使用，返回默认 DeepSeek 配置
      const defaultConfig = getDefaultDeepSeekConfig();
      return {
        configs: [defaultConfig],
        activeConfigId: defaultConfig.id,
      };
    }
    const parsed = JSON.parse(raw) as Partial<LlmSettings>;
    
    if (!parsed.configs || parsed.configs.length === 0) {
      const defaultConfig = getDefaultDeepSeekConfig();
      return {
        configs: [defaultConfig],
        activeConfigId: defaultConfig.id,
      };
    }

    return {
      configs: parsed.configs,
      activeConfigId: parsed.activeConfigId || parsed.configs[0].id,
    };
  } catch {
    const defaultConfig = getDefaultDeepSeekConfig();
    return {
      configs: [defaultConfig],
      activeConfigId: defaultConfig.id,
    };
  }
}

export function saveLlmSettings(next: LlmSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

// 获取当前激活的配置
export function getActiveConfig(): LlmApiConfig | null {
  const settings = loadLlmSettings();
  const active = settings.configs.find(c => c.id === settings.activeConfigId);
  return active || null;
}

// 简化版本 - 兼容旧代码
export function loadLlmOcrSettings(): { baseUrl: string; model: string; apiKey: string } {
  const active = getActiveConfig();
  if (active) {
    return {
      baseUrl: active.baseUrl,
      model: active.model,
      apiKey: active.apiKey,
    };
  }
  return {
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    apiKey: "",
  };
}
