import { isSafeImageContentType } from "@/lib/data/safeImageTypes";

type AttachmentDescriptor = {
  contentType?: string | null;
  name?: string | null;
};

const IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?$/i;

export function classifyAttachment(input: AttachmentDescriptor): "image" | "file" {
  const contentType = (input.contentType ?? "").trim().toLowerCase();
  if (contentType && isSafeImageContentType(contentType)) {
    return "image";
  }
  const name = (input.name ?? "").trim();
  if (name && IMAGE_EXTENSION_PATTERN.test(name)) {
    return "image";
  }
  return "file";
}

export function formatFileChipLabel(name: string): { base: string; ext: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { base: "첨부파일", ext: "FILE" };
  }
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === trimmed.length - 1) {
    return { base: trimmed, ext: "FILE" };
  }
  const base = trimmed.slice(0, lastDot);
  const ext = trimmed.slice(lastDot + 1).toUpperCase();
  return { base, ext };
}

export function resolveFileChipIcon(contentType?: string | null, name?: string | null): string {
  const normalizedType = (contentType ?? "").toLowerCase();
  const ext = formatFileChipLabel(name ?? "").ext.toLowerCase();
  if (normalizedType.includes("pdf") || ext === "pdf") return "📕";
  if (ext === "ppt" || ext === "pptx") return "📙";
  if (ext === "doc" || ext === "docx") return "📘";
  if (ext === "xls" || ext === "xlsx") return "📗";
  if (ext === "zip") return "🗜️";
  if (normalizedType.startsWith("text/") || ext === "txt" || ext === "csv") return "📝";
  return "📎";
}
