import { NextRequest, NextResponse } from "next/server";

type LlmSettings = {
  baseUrl: string;
  model: string;
  apiKey: string;
};

function normalizeBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return trimmed || "https://api.openai.com/v1";
}

function buildPrompt(fileName: string) {
  return [
    "你是一个 OCR + 排版助手。请从图片中识别所有可见文字，并输出排版良好的 Markdown。",
    "",
    "要求：",
    "- 只输出 Markdown，不要输出解释。",
    "- 尽量保留原始结构：标题层级、段落、列表、表格、页眉/页脚（可选）。",
    "- 如果是表格，请用 GitHub Flavored Markdown 表格输出。",
    "- 中英文混排要自然；数字、标点尽量保持正确。",
    "- 不要臆造图片里不存在的内容；看不清可用“[无法辨认]”。",
    "",
    `文件名：${fileName}`,
  ].join("\n");
}

async function callOpenAiCompatibleVision({
  settings,
  imageDataUrl,
  fileName,
}: {
  settings: LlmSettings;
  imageDataUrl: string;
  fileName: string;
}): Promise<string> {
  const baseUrl = normalizeBaseUrl(settings.baseUrl);
  const url = `${baseUrl}/chat/completions`;

  // 首先尝试使用vision API格式
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        temperature: 0.2,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: buildPrompt(fileName) },
              { type: "image_url", image_url: { url: imageDataUrl } },
            ],
          },
        ],
      }),
    });

    if (resp.ok) {
      const raw = await resp.text();
      let data: any;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error(`LLM 返回非 JSON：${raw.slice(0, 500) || raw}`);
      }

      const content = data?.choices?.[0]?.message?.content;
      if (typeof content === "string" && content.trim()) {
        return content.trim();
      }
    }
  } catch (error) {
    // 如果vision API失败，继续尝试其他方法
    console.log("Vision API failed, trying alternative method:", error);
  }

  // 如果vision API不支持，尝试使用纯文本格式并提示用户
  const error = new Error(
    "当前LLM API不支持vision功能（图片识别）。请使用支持vision功能的API（如OpenAI的gpt-4o、gpt-4-vision等），或者使用基础的OCR功能。"
  );
  throw error;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const baseUrl = String(formData.get("baseUrl") || "");
    const model = String(formData.get("model") || "");
    const apiKey = String(formData.get("apiKey") || "");

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!apiKey.trim()) {
      return NextResponse.json(
        { error: "Missing API key" },
        { status: 400 }
      );
    }

    // For MVP: only images
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "OCR endpoint currently supports image/* only" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const b64 = Buffer.from(bytes).toString("base64");
    const mime = file.type || "image/png";
    const imageDataUrl = `data:${mime};base64,${b64}`;

    const markdown = await callOpenAiCompatibleVision({
      settings: { baseUrl, model, apiKey },
      imageDataUrl,
      fileName: file.name,
    });

    return NextResponse.json({
      success: true,
      markdown,
      fileName: file.name,
      mode: "llm-ocr",
    });
  } catch (error) {
    console.error("OCR conversion error:", error);
    return NextResponse.json(
      {
        error: "OCR conversion failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

