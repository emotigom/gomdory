import { getFileExtension } from "@/lib/uploads/contentType";

export const BLOCKED_CARD_ATTACHMENT_EXTENSIONS = [
  "exe",
  "msi",
  "bat",
  "cmd",
  "scr",
  "dll",
  "com",
  "ps1",
  "app",
  "dmg",
  "pkg",
] as const;

export const BLOCKED_CARD_ATTACHMENT_CONTENT_TYPES = [
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/vnd.microsoft.portable-executable",
  "application/x-dosexec",
  "application/x-ms-installer",
  "application/x-msi",
  "application/x-apple-diskimage",
  "application/vnd.apple.installer+xml",
] as const;

export const DEFAULT_CARD_ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;

export type CardAttachmentPolicyRejection =
  | {
      code: "unsupported_file_type";
      status: 415;
      message: string;
    }
  | {
      code: "file_too_large";
      status: 413;
      message: string;
      maxBytes: number;
    };

function resolveCardAttachmentMaxBytes(): number {
  const parsed = Number.parseInt(process.env.STORAGE_MAX_BYTES ?? "", 10);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return DEFAULT_CARD_ATTACHMENT_MAX_BYTES;
}

export function getCardAttachmentMaxBytes(): number {
  return resolveCardAttachmentMaxBytes();
}

export function isBlockedCardAttachmentFileType(input: {
  filename: string;
  contentType: string;
}): boolean {
  const extension = getFileExtension(input.filename);
  const contentType = input.contentType.trim().toLowerCase().split(";")[0]?.trim() ?? "";

  return (
    BLOCKED_CARD_ATTACHMENT_EXTENSIONS.some((blocked) => blocked === extension) ||
    BLOCKED_CARD_ATTACHMENT_CONTENT_TYPES.some((blocked) => blocked === contentType)
  );
}

export function validateCardAttachmentUploadPolicy(input: {
  filename: string;
  contentType: string;
  sizeBytes: number;
}): CardAttachmentPolicyRejection | null {
  if (isBlockedCardAttachmentFileType(input)) {
    return {
      code: "unsupported_file_type",
      status: 415,
      message: "설치 파일이나 실행 파일은 첨부할 수 없습니다. 공식 다운로드 링크를 카드에 붙여 주세요.",
    };
  }

  const maxBytes = resolveCardAttachmentMaxBytes();
  if (input.sizeBytes > maxBytes) {
    return {
      code: "file_too_large",
      status: 413,
      message: "파일이 너무 큽니다. 큰 파일은 드라이브 링크나 공식 다운로드 링크로 공유해 주세요.",
      maxBytes,
    };
  }

  return null;
}
