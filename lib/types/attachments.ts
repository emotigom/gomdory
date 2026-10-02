import { normalizePracticeSnapshotAttachment } from "@/lib/labs/practiceSnapshot";

export type ExternalAttachment = {
  filename: string;
  downloadPath?: string | null;
  byteSize?: number | null;
  contentType?: string | null;
  kind?: "link" | "practice" | "feedback";
  url?: string;
  caption?: string | null;
  alt?: string | null;
  title?: string;
  html?: string;
  css?: string;
  js?: string;
  createdAt?: string;
};

export function normalizeExternalAttachments(value: unknown): ExternalAttachment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is ExternalAttachment => {
      if (!item || typeof item !== "object") {
        return false;
      }
      const record = item as Record<string, unknown>;
      const practice = normalizePracticeSnapshotAttachment(record);
      if (practice) {
        return true;
      }
      const filename = typeof record.filename === "string" ? record.filename.trim() : "";
      const url = typeof record.url === "string" ? record.url.trim() : "";
      const caption = typeof record.caption === "string" ? record.caption.trim() : "";
      const alt = typeof record.alt === "string" ? record.alt.trim() : "";

      if (filename.length > 0) {
        return true;
      }

      return (record.kind === "link" || record.kind === "feedback") && (url.length > 0 || caption.length > 0 || alt.length > 0);
    })
    .map((item) => {
      const record = item as Record<string, unknown>;
      const practice = normalizePracticeSnapshotAttachment(record);
      if (practice) {
        return {
          filename: practice.title,
          downloadPath: null,
          byteSize: null,
          contentType: "application/x-practice-snapshot+json",
          kind: "practice",
          url: undefined,
          title: practice.title,
          html: practice.html,
          css: practice.css,
          js: practice.js,
          createdAt: practice.createdAt,
        };
      }

      const rawDownloadPath = typeof record.downloadPath === "string" ? record.downloadPath.trim() : "";
      const rawUrl = typeof record.url === "string" ? record.url.trim() : "";
      const fallbackName =
        typeof record.filename === "string" && record.filename.trim().length > 0
          ? record.filename.trim()
          : typeof record.caption === "string" && record.caption.trim().length > 0
            ? record.caption.trim()
            : typeof record.alt === "string" && record.alt.trim().length > 0
              ? record.alt.trim()
              : typeof record.url === "string"
                ? record.url
                : "";
      return {
        filename: String(fallbackName),
        downloadPath: rawDownloadPath || rawUrl || null,
        byteSize: typeof record.byteSize === "number" ? record.byteSize : null,
        contentType: typeof record.contentType === "string" ? record.contentType : null,
        kind: record.kind === "link" || record.kind === "feedback" ? record.kind : undefined,
        url: typeof record.url === "string" ? record.url : undefined,
        caption: typeof record.caption === "string" ? record.caption : null,
        alt: typeof record.alt === "string" ? record.alt : null,
      };
    });
}
