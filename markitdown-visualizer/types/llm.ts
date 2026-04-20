export type LlmProvider = "openai-compatible";

// 单个 API 配置
export interface LlmApiConfig {
  id: string;          // 唯一标识
  name: string;        // 显示名称，如 "DeepSeek"
  baseUrl: string;     // API 地址
  model: string;       // 模型名称
  apiKey: string;       // API Key
  enabled: boolean;     // 是否启用
}

// 大模型设置 - 支持多个 API
export interface LlmSettings {
  configs: LlmApiConfig[];  // API 配置列表
  activeConfigId: string;   // 当前激活的配置 ID
}

// 固定的默认 DeepSeek 配置 ID，避免 SSR/客户端 hydration 不一致
export const DEFAULT_DEEPSEEK_ID = "default_deepseek";

// 获取默认的 DeepSeek 配置
export function getDefaultDeepSeekConfig(): LlmApiConfig {
  return {
    id: DEFAULT_DEEPSEEK_ID,
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    apiKey: "",
    enabled: true,
  };
}

// 生成唯一 id（仅在客户端动态添加时使用）
export function genConfigId(): string {
  return `config_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}
