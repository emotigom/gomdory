export const SAFE_IMAGE_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type SafeImageContentType = (typeof SAFE_IMAGE_CONTENT_TYPES)[number];

export function isSafeImageContentType(value: string): value is SafeImageContentType {
  const normalized = value.trim().toLowerCase();
  return SAFE_IMAGE_CONTENT_TYPES.some((type) => type === normalized);
}
