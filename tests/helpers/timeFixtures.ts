export const FIXED_NOW_MS = Date.UTC(2026, 0, 1, 0, 0, 0);

export function isoFrom(msOffset = 0): string {
  return new Date(FIXED_NOW_MS + msOffset).toISOString();
}
