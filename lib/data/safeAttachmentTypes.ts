import { SAFE_IMAGE_CONTENT_TYPES } from "@/lib/data/safeImageTypes";

export const SAFE_GENERIC_ATTACHMENT_CONTENT_TYPES = [
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/octet-stream",
] as const;

export const SAFE_GENERIC_ATTACHMENT_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".zip",
  ".txt",
  ".csv",
] as const;

export function isSafeGenericAttachmentContentType(contentType: string): boolean {
  const normalized = contentType.trim().toLowerCase();
  if (!normalized) return false;
  return SAFE_GENERIC_ATTACHMENT_CONTENT_TYPES.some((type) => type === normalized);
}

export function isAllowedCardAttachmentContentType(contentType: string): boolean {
  const normalized = contentType.trim().toLowerCase().split(";")[0]?.trim() ?? "";
  return normalized.length > 0;
}

export function buildImageAcceptValue(): string {
  return SAFE_IMAGE_CONTENT_TYPES.join(",");
}

export function buildGenericFileAcceptValue(): string {
  return SAFE_GENERIC_ATTACHMENT_EXTENSIONS.join(",");
}
