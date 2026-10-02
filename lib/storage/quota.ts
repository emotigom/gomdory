export const MAX_STORAGE_QUOTA_BYTES = 10 * 1024 ** 4;

export function parseStoredStorageQuotaBytes(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const parsed = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof parsed !== "number" || !Number.isSafeInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

export function isValidStorageQuotaInput(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_STORAGE_QUOTA_BYTES
  );
}

export function isStorageQuotaExceeded(input: {
  usedBytes: number;
  attemptBytes: number;
  quotaBytes: number;
}): boolean {
  const usedBytes = Number.isFinite(input.usedBytes) ? Math.max(0, input.usedBytes) : 0;
  const attemptBytes = Number.isFinite(input.attemptBytes) ? Math.max(0, input.attemptBytes) : 0;
  return usedBytes + attemptBytes > input.quotaBytes;
}
