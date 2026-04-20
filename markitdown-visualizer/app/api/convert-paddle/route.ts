import { NextRequest, NextResponse } from "next/server";

const API_URL = "https://hdd4tem3i022wfj7.aistudio-app.com/layout-parsing";
const TOKEN = "e4240a04d3ad98ec1caa3b9b8e295fa53be04014";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const b64 = Buffer.from(bytes).toString("base64");

    // 判断文件类型：PDF = 0，图片 = 1
    const isImage = file.type.startsWith("image/");
    const fileType = isImage ? 1 : 0;

    const paddleResponse = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `token ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        file: b64,
        fileType,
        useDocOrientationClassify: false,
        useDocUnwarping: false,
        useChartRecognition: false,
      }),
    });

    if (!paddleResponse.ok) {
      const errText = await paddleResponse.text();
      throw new Error(`PaddleOCR API 错误 (${paddleResponse.status}): ${errText}`);
    }

    const result = await paddleResponse.json();
    const layoutResults = result.result?.layoutParsingResults ?? [];

    // 将所有分块的 Markdown 拼接起来
    const markdownParts = layoutResults.map(
      (res: { markdown?: { text?: string } }) => res.markdown?.text ?? ""
    );
    const markdown = markdownParts.join("\n\n");

    return NextResponse.json({
      success: true,
      markdown,
      fileName: file.name,
      mode: "paddleocr",
      blocks: layoutResults.length,
    });
  } catch (error) {
    console.error("[PaddleOCR]", error);
    return NextResponse.json(
      {
        error: "PaddleOCR 转换失败",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
