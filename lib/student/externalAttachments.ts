import type { SharedCardAttachment } from "@/lib/boards/toSharedViewModel";
import type { ExternalAttachment } from "@/lib/types/attachments";

const isSafeExternalUrl = (url?: string | null) => {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return false;
  return (
    trimmed.startsWith("/") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://")
  );
};

export function buildExternalAttachments(
  attachments?: SharedCardAttachment[] | null,
): ExternalAttachment[] {
  if (!attachments || attachments.length === 0) return [];

  return attachments.flatMap((attachment) => {
    if (attachment.type !== "external") return [];
    if (!isSafeExternalUrl(attachment.url)) return [];
    return [
      {
        kind: "link",
        url: attachment.url,
        filename: attachment.label?.trim() || "링크",
      },
    ];
  });
}
