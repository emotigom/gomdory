export function shouldOptimize(mimeType: string | null | undefined): boolean {
  if (!mimeType) return false;
  const normalized = mimeType.toLowerCase();
  return normalized.startsWith("image/") && normalized !== "image/gif";
}

export function calculateBytesSaved(
  originalBytes: number | null | undefined,
  optimizedBytes: number | null | undefined,
): number {
  const original = typeof originalBytes === "number" && Number.isFinite(originalBytes) ? originalBytes : 0;
  const optimized = typeof optimizedBytes === "number" && Number.isFinite(optimizedBytes) ? optimizedBytes : 0;
  return Math.max(0, original - optimized);
}
