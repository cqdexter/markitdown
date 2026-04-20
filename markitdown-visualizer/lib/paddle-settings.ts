export interface PaddleOcrSettings {
  enabled: boolean;
  token: string;
}

const STORAGE_KEY = "markitdown:paddleOcrSettings:v1";

export function loadPaddleOcrSettings(): PaddleOcrSettings {
  if (typeof window === "undefined") {
    return { enabled: false, token: "" };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { enabled: false, token: "" };
    return JSON.parse(raw) as PaddleOcrSettings;
  } catch {
    return { enabled: false, token: "" };
  }
}

export function savePaddleOcrSettings(next: PaddleOcrSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
