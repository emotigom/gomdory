type BuildBaseSlugParams = {
  shareCode: string;
  lessonId: number;
  anonId?: string | null;
  requestId: string;
};

const MAX_SLUG_LENGTH = 48;

function sanitizeSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH);
}

function buildAnonTail6(anonId: string | null | undefined, requestId: string): string {
  const anonSafe = (anonId ?? "").replace(/[^a-zA-Z0-9]/g, "");
  const requestSafe = requestId.replace(/[^a-zA-Z0-9]/g, "");
  const combined = `${anonSafe}${requestSafe}`;
  const tail = combined.slice(-6);
  return tail.length === 6 ? tail : tail.padStart(6, "0");
}

export function buildBaseSlug(params: BuildBaseSlugParams): {
  baseSlug: string;
  studentKey: string;
  anonTail6: string;
} {
  const anonTail6 = buildAnonTail6(params.anonId, params.requestId);
  const base = `${params.shareCode}-${anonTail6}-p${params.lessonId}`;
  const baseSlug = sanitizeSlug(base);

  return { baseSlug, studentKey: baseSlug, anonTail6 };
}
