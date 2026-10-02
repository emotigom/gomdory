import { normalizeShareCode as normalizeShareCodeValue } from "@/lib/share/normalizeShareCode";

const SHARE_CODE_CANDIDATE_REGEX = /^[a-z0-9]{4,8}$/;

const RESERVED_SLUGS = new Set([
  "s",
  "c",
  "k",
  "r",
  "join",
  "dashboard",
  "auth",
  "api",
  "pricing",
  "templates",
  "robots.txt",
  "favicon.ico",
  "_next",
  "public",
]);

export function normalizeShareCode(raw: string): string {
  return normalizeShareCodeValue(raw);
}

export function isLikelyShareCode(slug: string): boolean {
  const normalized = normalizeShareCode(slug);

  if (!SHARE_CODE_CANDIDATE_REGEX.test(normalized)) {
    return false;
  }

  return !RESERVED_SLUGS.has(normalized);
}
