export const COMMUNITY_POST_MAX_FILE_ATTACHMENTS = 3;
export const COMMUNITY_POST_MAX_LINK_ATTACHMENTS = 1;

const ALLOWED_MIME_PREFIXES = ["image/", "application/pdf", "video/", "application/vnd", "text/"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type CommunityExternalLinkAttachment = {
  kind: "link";
  url: string;
};

export function isAllowedCommunityAttachmentMime(mime: string | null | undefined): boolean {
  const normalized = String(mime ?? "").trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return ALLOWED_MIME_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function assertAllowedCommunityAttachmentMime(mime: string | null | undefined): void {
  if (!isAllowedCommunityAttachmentMime(mime)) {
    throw new Error("지원하지 않는 파일 형식입니다.");
  }
}

export function parseCommunityAttachmentFileIds(raw: string | null | undefined): string[] {
  if (!raw) {
    return [];
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("첨부 파일 형식을 확인해 주세요.");
  }

  const ids = Array.from(new Set(parsed.map((item) => String(item ?? "").trim()).filter(Boolean)));
  if (ids.length > COMMUNITY_POST_MAX_FILE_ATTACHMENTS) {
    throw new Error(`첨부 파일은 최대 ${COMMUNITY_POST_MAX_FILE_ATTACHMENTS}개까지 가능합니다.`);
  }

  for (const id of ids) {
    if (!UUID_PATTERN.test(id)) {
      throw new Error("첨부 파일 식별자가 올바르지 않습니다.");
    }
  }

  return ids;
}

function normalizeLink(raw: string | null | undefined): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("링크 URL 형식을 확인해 주세요.");
  }

  if (!(parsed.protocol === "http:" || parsed.protocol === "https:")) {
    throw new Error("링크는 http/https URL만 허용됩니다.");
  }

  if (value.length > 500) {
    throw new Error("링크 URL 길이가 너무 깁니다.");
  }

  return value;
}

export function parseCommunityExternalAttachments(raw: string | null | undefined): CommunityExternalLinkAttachment[] {
  if (!raw) {
    return [];
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("링크 첨부 형식을 확인해 주세요.");
  }

  if (parsed.length > COMMUNITY_POST_MAX_LINK_ATTACHMENTS) {
    throw new Error("링크는 최대 1개까지 첨부할 수 있습니다.");
  }

  return parsed.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("링크 첨부 형식을 확인해 주세요.");
    }

    const url = normalizeLink((item as Record<string, unknown>).url as string | null | undefined);
    if (!url) {
      throw new Error("링크 URL을 입력해 주세요.");
    }

    return {
      kind: "link" as const,
      url,
    };
  });
}

export function toCommunityExternalAttachmentsFromLink(raw: string | null | undefined): CommunityExternalLinkAttachment[] {
  const normalized = normalizeLink(raw);
  if (!normalized) {
    return [];
  }

  return [{ kind: "link", url: normalized }];
}

export function getFilenameExtension(filename: string): string {
  const ext = filename.split(".").pop()?.trim().toLowerCase() ?? "";
  return ext || "file";
}

export function getHostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
