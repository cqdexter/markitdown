import type { DragEvent } from "react";
import type { FileItem } from "@/types";

function makeFileItem(file: File): FileItem {
  return {
    id: Math.random().toString(36).substring(2, 11),
    name: file.name,
    size: file.size,
    type: file.type,
    file,
    status: "pending",
    createdAt: new Date(),
  };
}

/**
 * Build FileItem[] from a drop event: real files first, else plain text as a .txt file.
 */
export function fileItemsFromDrop(e: DragEvent): FileItem[] {
  const dt = e.dataTransfer;
  if (!dt) return [];

  const fromFiles = Array.from(dt.files).filter((f) => f.name || f.size > 0);
  if (fromFiles.length > 0) {
    return fromFiles.map(makeFileItem);
  }

  let text = dt.getData("text/plain").replace(/\r\n/g, "\n");
  if (!text.trim()) {
    text = dt.getData("text/uri-list").split("\n")[0]?.trim() || "";
  }
  if (!text.trim()) {
    text = (dt.getData("URL") || "").trim();
  }
  if (text.trim().length > 0) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const file = new File(
      [blob],
      `拖入文本-${new Date().toISOString().replace(/[:.]/g, "-")}.txt`,
      { type: "text/plain" }
    );
    return [makeFileItem(file)];
  }

  return [];
}
