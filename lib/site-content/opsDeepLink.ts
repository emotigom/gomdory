import { SITE_CONTENT_KEYS, type SiteContentKey } from "@/lib/db/siteContent";

export function parseSiteContentDeepLinkKey(value: string | null | undefined, fallback: SiteContentKey = "community_usage"): SiteContentKey {
  if (!value) return fallback;
  const normalized = value.trim();
  if (!normalized) return fallback;
  return SITE_CONTENT_KEYS.includes(normalized as SiteContentKey) ? (normalized as SiteContentKey) : fallback;
}

