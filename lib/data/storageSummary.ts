export type StorageRecord = {
  id: string;
  name: string;
  bytes: number;
  mime?: string | null;
  boardId?: string | null;
  boardTitle?: string | null;
  classId?: string | null;
  classTitle?: string | null;
  createdAt?: string | null;
  lastAccessedAt?: string | null;
  originalBytes?: number | null;
  optimizedBytes?: number | null;
  bytesSaved?: number | null;
};

export type StorageSummary = {
  totalBytes: number;
  uploadedThisMonthBytes: number;
  actualSavings: {
    totalBytesSaved: number;
    savedThisMonthBytes: number;
    optimizedBytes: number;
    originalBytes: number;
  };
  byBoard: Array<{ boardId: string | null; title: string; bytes: number; fileCount: number }>;
  byClass: Array<{ classId: string | null; title: string; bytes: number; fileCount: number }>;
  topLargest: Array<{ name: string; bytes: number; boardId?: string | null; classId?: string | null; createdAt?: string | null }>;
  stale: Array<{ name: string; bytes: number; lastAccessedAt?: string | null; createdAt?: string | null }>;
  estSavings: { ifDedup: number; ifDownscaleImages: number };
};

const IMAGE_PREFIX = "image/";

function safeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "bigint") return Number(value);
  const parsed = typeof value === "string" ? Number.parseFloat(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function estimateDownscaleForImage(bytes: number): number {
  if (bytes <= 0) return 0;
  if (bytes < 200 * 1024) return Math.round(bytes * 0.18);
  if (bytes < 2 * 1024 * 1024) return Math.round(bytes * 0.36);
  return Math.round(bytes * 0.55);
}

function estimateDedupSavings(records: StorageRecord[]): number {
  const groups = new Map<string, number[]>();

  for (const record of records) {
    const normalizedName = record.name.toLowerCase().trim() || "(unnamed)";
    const key = `${normalizedName}__${safeNumber(record.bytes)}`;
    const list = groups.get(key) ?? [];
    list.push(safeNumber(record.bytes));
    groups.set(key, list);
  }

  let savings = 0;

  for (const [, sizes] of groups) {
    if (sizes.length <= 1) continue;
    const sorted = [...sizes].sort((a, b) => b - a);
    const keeper = sorted.shift() ?? 0;
    const duplicates = sorted.reduce((sum, value) => sum + value, 0);
    if (duplicates > 0 && keeper > 0) {
      savings += duplicates;
    }
  }

  return savings;
}

function estimateDownscaleSavings(records: StorageRecord[]): number {
  return records
    .filter((record) => (record.mime ?? "").toLowerCase().startsWith(IMAGE_PREFIX))
    .reduce((sum, record) => sum + estimateDownscaleForImage(safeNumber(record.bytes)), 0);
}

export function computeStorageSummary(records: StorageRecord[]): StorageSummary {
  const normalized = records.map((record) => ({
    ...record,
    bytes: safeNumber(record.bytes),
    originalBytes: record.originalBytes != null ? safeNumber(record.originalBytes) : null,
    optimizedBytes: record.optimizedBytes != null ? safeNumber(record.optimizedBytes) : null,
    bytesSaved: record.bytesSaved != null ? safeNumber(record.bytesSaved) : null,
  }));

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;

  const totalBytes = normalized.reduce((sum, record) => sum + record.bytes, 0);
  const totalOriginalBytes = normalized.reduce(
    (sum, record) => sum + (record.originalBytes != null ? safeNumber(record.originalBytes) : record.bytes),
    0,
  );
  const totalOptimizedBytes = normalized.reduce(
    (sum, record) => sum + (record.optimizedBytes != null ? safeNumber(record.optimizedBytes) : record.bytes),
    0,
  );
  const totalBytesSaved = normalized.reduce((sum, record) => {
    const savedExplicit = record.bytesSaved != null ? record.bytesSaved : null;
    const saved =
      savedExplicit ??
      (record.originalBytes != null && record.optimizedBytes != null
        ? Math.max(0, record.originalBytes - record.optimizedBytes)
        : 0);
    return sum + saved;
  }, 0);
  const uploadedThisMonthBytes = normalized.reduce((sum, record) => {
    if (!record.createdAt) return sum;
    const created = new Date(record.createdAt);
    const key = `${created.getFullYear()}-${created.getMonth()}`;
    return key === monthKey ? sum + record.bytes : sum;
  }, 0);
  const savedThisMonthBytes = normalized.reduce((sum, record) => {
    if (!record.createdAt) return sum;
    const created = new Date(record.createdAt);
    const key = `${created.getFullYear()}-${created.getMonth()}`;
    const saved =
      record.bytesSaved ??
      (record.originalBytes != null && record.optimizedBytes != null
        ? Math.max(0, record.originalBytes - record.optimizedBytes)
        : 0);
    return key === monthKey ? sum + saved : sum;
  }, 0);

  const byBoardMap = new Map<string | null, { title: string; bytes: number; fileCount: number }>();
  const byClassMap = new Map<string | null, { title: string; bytes: number; fileCount: number }>();

  for (const record of normalized) {
    const boardKey = record.boardId ?? null;
    const boardTitle = record.boardTitle ?? (boardKey ? "보드" : "기타");
    const boardEntry = byBoardMap.get(boardKey) ?? { title: boardTitle, bytes: 0, fileCount: 0 };
    boardEntry.bytes += record.bytes;
    boardEntry.fileCount += 1;
    if (boardEntry.title !== boardTitle) {
      boardEntry.title = boardTitle;
    }
    byBoardMap.set(boardKey, boardEntry);

    if (record.classId) {
      const classKey = record.classId;
      const classTitle = record.classTitle ?? "클래스";
      const classEntry = byClassMap.get(classKey) ?? { title: classTitle, bytes: 0, fileCount: 0 };
      classEntry.bytes += record.bytes;
      classEntry.fileCount += 1;
      if (classEntry.title !== classTitle) {
        classEntry.title = classTitle;
      }
      byClassMap.set(classKey, classEntry);
    }
  }

  const byBoard = Array.from(byBoardMap.entries())
    .map(([boardId, value]) => ({ boardId, title: value.title, bytes: value.bytes, fileCount: value.fileCount }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 10);

  const byClass = Array.from(byClassMap.entries())
    .map(([classId, value]) => ({ classId, title: value.title, bytes: value.bytes, fileCount: value.fileCount }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 10);

  const topLargest = [...normalized]
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 10)
    .map((record) => ({
      name: record.name,
      bytes: record.bytes,
      boardId: record.boardId ?? null,
      classId: record.classId ?? null,
      createdAt: record.createdAt ?? null,
    }));

  const stale = [...normalized]
    .sort((a, b) => {
      const aStamp = recordStalenessKey(a);
      const bStamp = recordStalenessKey(b);
      return aStamp - bStamp;
    })
    .slice(0, 10)
    .map((record) => ({
      name: record.name,
      bytes: record.bytes,
      lastAccessedAt: record.lastAccessedAt ?? null,
      createdAt: record.createdAt ?? null,
    }));

  const estSavings = {
    ifDedup: estimateDedupSavings(normalized),
    ifDownscaleImages: estimateDownscaleSavings(normalized),
  };

  return {
    totalBytes,
    uploadedThisMonthBytes,
    actualSavings: {
      totalBytesSaved,
      savedThisMonthBytes,
      optimizedBytes: totalOptimizedBytes,
      originalBytes: totalOriginalBytes,
    },
    byBoard,
    byClass,
    topLargest,
    stale,
    estSavings,
  };
}

function recordStalenessKey(record: StorageRecord): number {
  const access = record.lastAccessedAt ? new Date(record.lastAccessedAt).getTime() : Number.POSITIVE_INFINITY;
  const created = record.createdAt ? new Date(record.createdAt).getTime() : Number.POSITIVE_INFINITY;
  return Number.isFinite(access) ? access : created;
}

export function describePotentialSavings(summary: StorageSummary): { label: string; percent: number } {
  const maxSaving = Math.max(summary.estSavings.ifDedup, summary.estSavings.ifDownscaleImages);
  if (summary.totalBytes <= 0 || maxSaving <= 0) {
    return { label: "예상 절감", percent: 0 };
  }
  const percent = Math.min(99, Math.round((maxSaving / summary.totalBytes) * 100));
  return { label: "예상 절감", percent };
}
