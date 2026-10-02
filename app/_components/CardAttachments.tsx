"use client";

import Image from "next/image";
import type { MouseEvent } from "react";
import { useCallback, useState } from "react";

import {
  classifyAttachment,
  formatFileChipLabel,
  resolveFileChipIcon,
} from "@/lib/cards/attachmentPresentation";
import { formatBytes } from "@/lib/format/bytes";
import {
  isSafeDownloadAttributeHref,
  resolveDownloadUrlWithCache,
} from "@/lib/files/downloadCache";
import { formatCardUrlLabel } from "@/lib/cards/urlAttachment";
import {
  buildPracticePreviewHtml,
  type PracticeSnapshotAttachment,
} from "@/lib/labs/practiceSnapshot";

export type CardAttachmentViewModel = {
  id: string;
  type: "file" | "url" | "practice";
  label: string;
  url: string;
  contentType?: string | null;
  sizeBytes?: number | null;
  practice?: PracticeSnapshotAttachment;
};

type CardAttachmentsProps = {
  attachments: CardAttachmentViewModel[];
  onRemoveFile?: (attachmentId: string) => void;
  onRemoveUrl?: (attachmentId: string) => void;
  mode: "teacher" | "student" | "share";
  disabledReason?: string;
  className?: string;
  stopPropagation?: boolean;
  emptyLabel?: string;
};

function stopClick(event: MouseEvent<HTMLElement>, enabled: boolean) {
  if (enabled) {
    event.stopPropagation();
  }
}

export default function CardAttachments({
  attachments,
  onRemoveFile,
  onRemoveUrl,
  mode,
  disabledReason,
  className,
  stopPropagation = true,
  emptyLabel,
}: CardAttachmentsProps) {
  const [failedImageIds, setFailedImageIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const fileAttachments = attachments.filter((item) => item.type === "file");
  const urlAttachments = attachments.filter((item) => item.type === "url");
  const practiceAttachments = attachments.filter(
    (item) => item.type === "practice" && item.practice,
  );
  const imageFiles = fileAttachments.filter(
    (item) =>
      !failedImageIds.has(item.id) &&
      classifyAttachment({
        contentType: item.contentType,
        name: item.label,
      }) === "image",
  );
  const genericFiles = fileAttachments.filter(
    (item) =>
      failedImageIds.has(item.id) ||
      classifyAttachment({
        contentType: item.contentType,
        name: item.label,
      }) === "file",
  );
  const imageGridClass =
    imageFiles.length <= 2 ? "grid grid-cols-2 gap-2" : "grid grid-cols-3 gap-2";

  const canRemoveFile = mode === "teacher" && Boolean(onRemoveFile);
  const canRemoveUrl = mode === "teacher" && Boolean(onRemoveUrl);

  const handleFileChipClick = useCallback(
    async (
      event: MouseEvent<HTMLAnchorElement>,
      fileId: string,
      downloadPath: string,
    ) => {
      stopClick(event, stopPropagation);
      if (!isSafeDownloadAttributeHref(downloadPath)) {
        return;
      }
      event.preventDefault();
      try {
        const resolvedUrl = await resolveDownloadUrlWithCache({
          fileId,
          downloadPath,
        });
        const trigger = document.createElement("a");
        trigger.href = resolvedUrl;
        trigger.download = "";
        trigger.rel = "noreferrer noopener";
        trigger.click();
      } catch {
        window.open(downloadPath, "_blank", "noopener,noreferrer");
      }
    },
    [stopPropagation],
  );

  const handleImageError = useCallback((fileId: string) => {
    setFailedImageIds((current) => {
      if (current.has(fileId)) {
        return current;
      }
      const next = new Set(current);
      next.add(fileId);
      return next;
    });
  }, []);

  if (attachments.length === 0) {
    return emptyLabel ? (
      <p className="text-xs text-[var(--theme-text-subtle)]">{emptyLabel}</p>
    ) : null;
  }

  return (
    <div
      data-card-attachments-runtime="CardAttachments-v3"
      className={`space-y-2 ${className ?? ""}`}
    >
      {imageFiles.length > 0 ? (
        <div className={imageGridClass} data-attachment-image-grid="true">
          {imageFiles.map((file) => (
            <a
              key={file.id}
              href={file.url}
              target="_blank"
              rel="noreferrer noopener"
              onClick={(event) => stopClick(event, stopPropagation)}
              data-testid="attachment-image-preview"
              data-attachment-row="image"
              className="group relative block aspect-[4/3] max-h-[120px] overflow-hidden rounded-md border border-[var(--theme-border)] bg-[var(--theme-card-muted)]"
              title={file.label}
            >
              <Image
                src={file.url}
                alt={file.label}
                width={160}
                height={120}
                unoptimized
                onError={() => handleImageError(file.id)}
                className="h-full w-full object-cover transition group-hover:scale-[1.03]"
              />
            </a>
          ))}
        </div>
      ) : null}

      {genericFiles.length > 0 ? (
        <div className="space-y-1.5">
          {genericFiles.map((file) => {
            const label = formatFileChipLabel(file.label);
            return (
              <div
                key={file.id}
                data-testid="public-attachment-row"
                data-public-attachment-row="true"
                data-attachment-row="file"
                className="theme-card-panel flex flex-wrap items-center gap-2 rounded-md border px-2 py-1.5 text-xs shadow-sm"
              >
                <a
                  href={file.url}
                  download={
                    isSafeDownloadAttributeHref(file.url) ? "" : undefined
                  }
                  target={
                    isSafeDownloadAttributeHref(file.url) ? undefined : "_blank"
                  }
                  rel="noreferrer noopener"
                  onClick={(event) =>
                    void handleFileChipClick(event, file.id, file.url)
                  }
                  className="inline-flex min-w-0 flex-1 basis-48 items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2"
                  title={file.label}
                  aria-label={`${file.label} 다운로드`}
                >
                  <span className="shrink-0">
                    {resolveFileChipIcon(file.contentType, file.label)}
                  </span>
                  <span
                    data-testid="attachment-filename"
                    data-attachment-filename="true"
                    className="theme-card-copy min-w-0 flex-1 truncate font-medium [overflow-wrap:anywhere]"
                  >
                    {label.base}
                  </span>
                  <span
                    data-attachment-extension-badge="true"
                    className="attachment-extension-badge shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                  >
                    {label.ext}
                  </span>
                  {typeof file.sizeBytes === "number" && file.sizeBytes > 0 ? (
                    <span className="attachment-meta-badge shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold">
                      {formatBytes(file.sizeBytes)}
                    </span>
                  ) : null}
                  <span
                    data-testid="attachment-download"
                    data-attachment-download="true"
                    className="attachment-download-label shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold"
                  >
                    다운로드
                  </span>
                </a>
                {canRemoveFile ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      stopClick(event, stopPropagation);
                      onRemoveFile?.(file.id);
                    }}
                    className="theme-card-muted-control rounded border border-[var(--theme-border)] px-2 py-0.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2"
                    aria-label={`${file.label} 제거`}
                  >
                    제거
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {urlAttachments.length > 0 ? (
        <div className="space-y-1.5">
          {urlAttachments.map((item) => (
            <div
              key={item.id}
              data-testid="public-attachment-row"
              data-public-attachment-row="true"
              data-attachment-row="url"
              className="theme-card-panel flex flex-wrap items-center gap-2 rounded-lg border px-2 py-1.5 text-xs"
            >
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer noopener"
                onClick={(event) => stopClick(event, stopPropagation)}
                className="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2"
                title={item.url}
              >
                <span
                  data-testid="attachment-filename"
                  data-attachment-filename="true"
                  className="theme-card-copy line-clamp-1 font-medium [overflow-wrap:anywhere]"
                >
                  🔗 {formatCardUrlLabel(item.url)}
                </span>
              </a>
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer noopener"
                onClick={(event) => stopClick(event, stopPropagation)}
                data-testid="attachment-download"
                data-attachment-download="true"
                className="attachment-download-label rounded px-2 py-0.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2"
              >
                입장
              </a>
              {canRemoveUrl ? (
                <button
                  type="button"
                  onClick={(event) => {
                    stopClick(event, stopPropagation);
                    onRemoveUrl?.(item.id);
                  }}
                  className="theme-card-muted-control rounded border border-[var(--theme-border)] px-2 py-0.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2"
                  aria-label={`${formatCardUrlLabel(item.url)} 제거`}
                >
                  제거
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {practiceAttachments.length > 0 ? (
        <div className="space-y-2">
          {practiceAttachments.map((item) => (
            <div
              key={item.id}
              className="theme-card-panel rounded-lg border p-2"
            >
              <div className="mb-2 flex items-center justify-between text-xs">
                <p className="theme-card-muted-copy font-semibold">
                  🧪 {item.practice?.title ?? "실습 제출"}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const source = item.practice;
                    if (!source) return;
                    const html = `<!doctype html><html><head><meta charset=\"utf-8\"><style>${source.css}</style></head><body>${source.html}<script>${source.js}<\/script></body></html>`;
                    const blob = new Blob([html], {
                      type: "text/html;charset=utf-8",
                    });
                    const href = URL.createObjectURL(blob);
                    const anchor = document.createElement("a");
                    anchor.href = href;
                    anchor.download = `${source.title || "practice"}.html`;
                    anchor.click();
                    URL.revokeObjectURL(href);
                  }}
                  className="attachment-download-label rounded px-2 py-0.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2"
                  aria-label={`${item.practice?.title ?? "실습 제출"} 다운로드`}
                >
                  다운로드
                </button>
              </div>
              <iframe
                title={`practice-${item.id}`}
                sandbox="allow-scripts"
                srcDoc={buildPracticePreviewHtml(
                  item.practice as PracticeSnapshotAttachment,
                )}
                className="h-44 w-full rounded border border-[var(--theme-border)]"
              />
            </div>
          ))}
        </div>
      ) : null}

      {(mode === "student" || mode === "share") && disabledReason ? (
        <p className="text-[11px] text-[var(--theme-text-subtle)]">{disabledReason}</p>
      ) : null}
    </div>
  );
}
