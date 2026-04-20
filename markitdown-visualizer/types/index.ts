export interface FileItem {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
  status: "pending" | "converting" | "completed" | "error";
  markdown?: string;
  error?: string;
  createdAt: Date;
}

export interface ConversionResult {
  textContent: string;
  title?: string;
}
