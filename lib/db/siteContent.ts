import "server-only";

import type { SiteContentBlock } from "@/lib/site-content/blocks";
import { toSnakeKeys } from "@/lib/standards/fields";

export const SITE_CONTENT_KEYS = [
  "usage",
  "updates",
  "roadmap",
  "policy",
  "community_usage",
  "community_updates",
  "community_auto_hide_rules",
  "site_nav_config",
  "board_sidebar_config",
] as const;
export type SiteContentKey = (typeof SITE_CONTENT_KEYS)[number];

export const SITE_CONTENT_STATUSES = ["draft", "published"] as const;
export type SiteContentStatus = (typeof SITE_CONTENT_STATUSES)[number];

export const SITE_CONTENT_REVISION_STATUSES = ["draft", "published", "rollback"] as const;
export type SiteContentRevisionStatus = (typeof SITE_CONTENT_REVISION_STATUSES)[number];

export type SiteContentDto = {
  key: SiteContentKey;
  title: string;
  body: string;
  bodyBlocks: SiteContentBlock[];
  status: SiteContentStatus;
  updatedAt: string;
  publishedAt: string | null;
  publishAt: string | null;
  expiresAt: string | null;
};

type SiteContentRow = {
  key: string;
  title: string;
  body: string;
  body_blocks: SiteContentBlock[] | null;
  status: string;
  updated_at: string;
  published_at: string | null;
  publish_at: string | null;
  expires_at: string | null;
};

export const SITE_CONTENT_SELECT = "key,title,body,body_blocks,status,updated_at,published_at,publish_at,expires_at";

export function isSiteContentKey(value: string): value is SiteContentKey {
  return SITE_CONTENT_KEYS.includes(value as SiteContentKey);
}

export function isSiteContentStatus(value: string): value is SiteContentStatus {
  return SITE_CONTENT_STATUSES.includes(value as SiteContentStatus);
}

export function isSiteContentRevisionStatus(value: string): value is SiteContentRevisionStatus {
  return SITE_CONTENT_REVISION_STATUSES.includes(value as SiteContentRevisionStatus);
}

export function toSiteContentDto(row: SiteContentRow): SiteContentDto {
  return {
    key: row.key as SiteContentKey,
    title: row.title,
    body: row.body,
    bodyBlocks: row.body_blocks ?? [],
    status: row.status as SiteContentStatus,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
    publishAt: row.publish_at,
    expiresAt: row.expires_at,
  };
}

export function buildSiteContentUpdatePayload(input: {
  title: string;
  body: string;
  bodyBlocks: SiteContentBlock[];
  status: SiteContentStatus;
  updatedAt: string;
  publishedAt: string | null;
  publishAt: string | null;
  expiresAt: string | null;
}): Record<string, unknown> {
  return toSnakeKeys(input);
}
