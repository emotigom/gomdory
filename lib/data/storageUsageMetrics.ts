export type StorageUsageMetricRecord = {
  id: string;
  objectKey?: string | null;
  bytesStored?: number | null;
  sizeBytes?: number | null;
  bytesOriginal?: number | null;
};

export type StorageUsageMetrics = {
  logicalStoredBytes: number;
  physicalStoredBytes: number;
  originalBytesNoDup: number;
  dedupSavingsBytes: number;
  optimizeSavingsBytes: number;
};

function safeNumber(value: number | null | undefined): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return 0;
}

function resolveStoredBytes(record: StorageUsageMetricRecord): number {
  return safeNumber(record.bytesStored ?? record.sizeBytes ?? 0);
}

function resolveOriginalBytes(record: StorageUsageMetricRecord): number {
  const stored = resolveStoredBytes(record);
  return safeNumber(record.bytesOriginal ?? stored);
}

export function computeStorageUsageMetrics(records: StorageUsageMetricRecord[]): StorageUsageMetrics {
  let logicalStoredBytes = 0;
  const grouped = new Map<string, { storedMax: number; originalMax: number }>();

  for (const record of records) {
    const stored = resolveStoredBytes(record);
    const original = resolveOriginalBytes(record);
    logicalStoredBytes += stored;

    const key = record.objectKey ?? `file:${record.id}`;
    const existing = grouped.get(key) ?? { storedMax: 0, originalMax: 0 };
    existing.storedMax = Math.max(existing.storedMax, stored);
    existing.originalMax = Math.max(existing.originalMax, original);
    grouped.set(key, existing);
  }

  let physicalStoredBytes = 0;
  let originalBytesNoDup = 0;

  for (const value of grouped.values()) {
    physicalStoredBytes += value.storedMax;
    originalBytesNoDup += value.originalMax;
  }

  const dedupSavingsBytes = Math.max(0, logicalStoredBytes - physicalStoredBytes);
  const optimizeSavingsBytes = Math.max(0, originalBytesNoDup - physicalStoredBytes);

  return {
    logicalStoredBytes,
    physicalStoredBytes,
    originalBytesNoDup,
    dedupSavingsBytes,
    optimizeSavingsBytes,
  };
}
