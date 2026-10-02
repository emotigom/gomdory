export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}

export function formatPct(value: number, maximumFractionDigits = 1): string {
  if (!Number.isFinite(value)) return "0%";
  const formatter = new Intl.NumberFormat("en", {
    maximumFractionDigits,
    minimumFractionDigits: value > 0 && value < 1 ? maximumFractionDigits : 0,
  });
  return `${formatter.format(value)}%`;
}
