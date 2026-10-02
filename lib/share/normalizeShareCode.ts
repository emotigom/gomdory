export function normalizeShareCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}
