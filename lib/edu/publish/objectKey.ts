export function buildEduPublishPrefix(slug: string): string {
  return `edu/v1/${slug}/`;
}

export function buildEduPublishObjectKey(slug: string, relativePath: string): string {
  return `${buildEduPublishPrefix(slug)}${relativePath}`;
}
