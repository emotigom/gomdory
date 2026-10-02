export function buildObjectKey(input: { ownerId: string; hash: string; ext?: string | null }): string {
  const ext = input.ext?.trim() ?? "";
  const suffix = ext ? (ext.startsWith(".") ? ext : `.${ext}`) : "";
  return `u/${input.ownerId}/o/${input.hash}${suffix}`;
}

export function buildRandomObjectKey(input: { ownerId: string; ext?: string | null; now?: Date }): string {
  const ext = input.ext?.trim() ?? "";
  const suffix = ext ? (ext.startsWith(".") ? ext : `.${ext}`) : "";
  const now = input.now ?? new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const random = crypto.randomUUID().replace(/-/g, "");
  return `u/${input.ownerId}/${year}/${month}/${random}${suffix}`;
}

export function isObjectKeyOwnedBy(objectKey: string, ownerId: string): boolean {
  if (!objectKey || !ownerId || objectKey.includes("\0")) return false;
  return objectKey.startsWith(`u/${ownerId}/`);
}
