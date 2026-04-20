import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { writeFile, mkdtemp, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

// 标记为 Node.js runtime，因为使用了 child_process 和 fs
export const runtime = "nodejs";

// Turbopack 忽略注释，避免 NFT 追踪问题
const tempDirBase = /*turbopackIgnore: true*/ tmpdir();

const execFileAsync = promisify(execFile);

const MAX_BUFFER = 50 * 1024 * 1024;

function getMarkitdownCommand(
  inputPath: string
): { file: string; args: string[] } {
  const python = process.env.MARKITDOWN_PYTHON;
  if (python) {
    return { file: python, args: ["-m", "markitdown", inputPath] };
  }
  if (process.platform === "win32") {
    return { file: "py", args: ["-3", "-m", "markitdown", inputPath] };
  }
  // Vercel 环境中使用 python 而不是 python3
  return { file: "python", args: ["-m", "markitdown", inputPath] };
}

export async function POST(request: NextRequest) {
  let tempDir: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    tempDir = await mkdtemp(join(tempDirBase, "markitdown-"));
    const inputPath = join(tempDir, file.name);

    const bytes = await file.arrayBuffer();
    await writeFile(inputPath, Buffer.from(bytes));

    const { file: cmd, args } = getMarkitdownCommand(inputPath);
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      maxBuffer: MAX_BUFFER,
      windowsHide: true,
      encoding: "utf8",
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
      },
    });

    if (stderr && !stdout) {
      throw new Error(String(stderr));
    }

    return NextResponse.json({
      success: true,
      markdown: stdout,
      fileName: file.name,
    });
  } catch (error) {
    console.error("Conversion error:", error);
    return NextResponse.json(
      {
        error: "Conversion failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
