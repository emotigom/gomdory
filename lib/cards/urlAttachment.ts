import { normalizeExternalAttachments, type ExternalAttachment } from "@/lib/types/attachments";

const MAX_URL_LENGTH = 2048;

export function normalizeHttpUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null;
  if (!/^https?:\/\//i.test(trimmed)) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function upsertCardUrlAttachment(existing: unknown, url: string | null): ExternalAttachment[] {
  const normalized = normalizeExternalAttachments(existing);
  const withoutLinks = normalized.filter((attachment) => attachment.kind !== "link");

  if (!url) {
    return withoutLinks;
  }

  return [
    ...withoutLinks,
    {
      kind: "link",
      url,
      filename: url,
      downloadPath: url,
      contentType: null,
      byteSize: null,
      caption: null,
      alt: null,
    },
  ];
}

export function removeCardUrlAttachment(existing: unknown, url: string | null): ExternalAttachment[] {
  const normalized = normalizeExternalAttachments(existing);
  const targetUrl = normalizeHttpUrl(url);

  if (!targetUrl) {
    return normalized.filter((attachment) => attachment.kind !== "link");
  }

  return normalized.filter((attachment) => {
    if (attachment.kind !== "link") {
      return true;
    }

    return normalizeHttpUrl(attachment.url) !== targetUrl;
  });
}

export function formatCardUrlLabel(url: string, maxLength = 40): string {
  try {
    const parsed = new URL(url);
    const display = `${parsed.hostname}${parsed.pathname}${parsed.search}`;
    return display.length > maxLength ? `${display.slice(0, maxLength - 1)}…` : display;
  } catch {
    return url.length > maxLength ? `${url.slice(0, maxLength - 1)}…` : url;
  }
}
