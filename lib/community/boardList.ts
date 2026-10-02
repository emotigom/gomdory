export function makeExcerpt(body: string, maxLength = 180): string {
  const normalized = body.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function normalizeCommunitySearch(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

export function matchesCommunitySearch(post: { title: string; body: string }, query: string): boolean {
  const normalizedQuery = normalizeCommunitySearch(query);
  if (!normalizedQuery) {
    return true;
  }

  const haystack = `${normalizeCommunitySearch(post.title)}\n${normalizeCommunitySearch(post.body)}`;
  return haystack.includes(normalizedQuery);
}

export function clampAttachmentChips<T>(items: T[], maxVisible = 3): { visible: T[]; hiddenCount: number } {
  if (maxVisible <= 0) {
    return { visible: [], hiddenCount: items.length };
  }

  const visible = items.slice(0, maxVisible);
  return { visible, hiddenCount: Math.max(0, items.length - visible.length) };
}
