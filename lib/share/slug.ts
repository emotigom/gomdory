const SLUG_PART_REGEX = /[^a-z0-9]/g;

function cleanSlugPart(value: string): string {
  return value.toLowerCase().replace(SLUG_PART_REGEX, "");
}

function tailSlugPart(value: string, size = 6): string {
  const cleaned = cleanSlugPart(value);
  if (!cleaned) {
    return "000000";
  }
  return cleaned.slice(-size);
}

export function buildEduBaseSlug({
  shareCode,
  anonId,
  requestId,
  lessonId,
}: {
  shareCode: string;
  anonId: string | null;
  requestId: string;
  lessonId: number | null;
}): string {
  const tail = tailSlugPart(anonId ?? requestId);
  const lessonSuffix = typeof lessonId === "number" && Number.isFinite(lessonId) ? lessonId : 0;
  return `${cleanSlugPart(shareCode)}-${tail}-p${lessonSuffix}`;
}

export function buildEduVersionedSlug(baseSlug: string, version: number): string {
  if (version <= 1) {
    return baseSlug;
  }
  return `${baseSlug}-v${version}`;
}
