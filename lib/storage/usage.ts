export const DEFAULT_USAGE_THRESHOLDS = {
  warn: 70,
  danger: 90,
} as const;

export type UsageTier = "ok" | "warn" | "danger";

export type OptimizationSavingsInput = {
  originalBytes?: number | null;
  optimizedBytes?: number | null;
  optimized?: boolean | null;
};

export function calculateUsagePercent(usedBytes: number, quotaBytes: number): number {
  if (!Number.isFinite(usedBytes) || usedBytes <= 0) return 0;
  if (!Number.isFinite(quotaBytes) || quotaBytes < 0) return 0;
  if (quotaBytes === 0) return 100;
  return Math.min(100, Math.round((usedBytes / quotaBytes) * 1000) / 10);
}

export function getUsageTier(
  usedPct: number,
  thresholds: typeof DEFAULT_USAGE_THRESHOLDS = DEFAULT_USAGE_THRESHOLDS,
): UsageTier {
  if (usedPct >= thresholds.danger) return "danger";
  if (usedPct >= thresholds.warn) return "warn";
  return "ok";
}

export function computeOptimizedBytesSaved(rows: OptimizationSavingsInput[]): number {
  return rows.reduce((total, row) => {
    if (!row || row.optimized !== true) return total;
    const original = typeof row.originalBytes === "number" && Number.isFinite(row.originalBytes) ? row.originalBytes : 0;
    const optimized =
      typeof row.optimizedBytes === "number" && Number.isFinite(row.optimizedBytes) ? row.optimizedBytes : 0;
    return total + Math.max(0, original - optimized);
  }, 0);
}
