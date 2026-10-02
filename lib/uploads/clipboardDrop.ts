import { normalizeHttpUrl } from "@/lib/cards/urlAttachment";

type FileLikeTransfer = {
  files?: ArrayLike<File> | null;
};

export function extractAttachmentsFromDrop(dataTransferLike: FileLikeTransfer | null | undefined): File[] {
  const files = dataTransferLike?.files;
  if (!files) return [];
  return Array.from(files);
}

export function extractUrlFromPaste(text: string): string | null {
  return normalizeHttpUrl(text);
}
