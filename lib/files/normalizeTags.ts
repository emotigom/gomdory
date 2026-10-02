export const FILE_TAG_LIMIT = 8;
export const FILE_TAG_MAX_LENGTH = 24;

function stripForbiddenChars(value: string): string {
  return value.replace(/[\\/,]/g, "");
}

export function normalizeFileTagValue(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;

  const withHyphens = trimmed.replace(/\s+/g, "-");
  const stripped = stripForbiddenChars(withHyphens)
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!stripped) return null;
  if (stripped.length > FILE_TAG_MAX_LENGTH) return null;
  return stripped;
}

export function normalizeFileTags(input: string[]): { tags: string[]; invalid: boolean } {
  const seen = new Set<string>();
  let invalid = false;

  for (const tag of input) {
    const normalized = normalizeFileTagValue(tag);
    if (!normalized) {
      invalid = true;
      continue;
    }
    if (!seen.has(normalized)) {
      seen.add(normalized);
    }
  }

  const tags = Array.from(seen.values());
  if (tags.length > FILE_TAG_LIMIT) {
    invalid = true;
  }

  return { tags: tags.slice(0, FILE_TAG_LIMIT), invalid };
}
