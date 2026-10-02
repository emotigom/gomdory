import "server-only";

import {
  SITE_CONTENT_KEYS,
  type SiteContentDto,
  type SiteContentKey,
} from "@/lib/db/siteContent";
import type { SiteContentBlock } from "@/lib/site-content/blocks";
import { getPublishedSnapshotByKey, listSiteContent } from "@/lib/site-content/server";

export type SiteContentFallback = {
  title: string;
  body: string;
  bodyBlocks: SiteContentBlock[];
};

const FALLBACK_CONTENT: Record<SiteContentKey, SiteContentFallback> = {
  usage: {
    title: "사용법",
    body: "수업 보드와 커뮤니티를 시작하는 방법을 확인하세요.",
    bodyBlocks: [],
  },
  updates: {
    title: "업데이트",
    body: "새로 추가되거나 달라진 기능을 확인하세요.",
    bodyBlocks: [],
  },
  roadmap: {
    title: "준비 중인 기능",
    body: "다음에 준비하는 보드·수업·학교 기능을 확인하세요.",
    bodyBlocks: [],
  },
  policy: {
    title: "운영 원칙",
    body: "학생 정보는 꼭 필요한 만큼만 다루고, 권한과 기록을 분명하게 관리합니다.",
    bodyBlocks: [],
  },
  community_usage: {
    title: "사용법",
    body: "글을 고르고, 수업 사례와 활용 팁을 나누는 방법을 확인하세요.",
    bodyBlocks: [],
  },
  community_updates: {
    title: "업데이트",
    body: "커뮤니티에 새로 추가된 기능과 달라진 점을 확인하세요.",
    bodyBlocks: [],
  },
  community_auto_hide_rules: {
    title: "community_auto_hide_rules",
    body: '{"keywords":[]}',
    bodyBlocks: [],
  },
  site_nav_config: {
    title: "site_nav_config",
    body: "",
    bodyBlocks: [],
  },
  board_sidebar_config: {
    title: "board_sidebar_config",
    body: "",
    bodyBlocks: [],
  },
};

export async function getMarketingSiteContentMap(): Promise<Record<SiteContentKey, SiteContentFallback>> {
  const rows = await listSiteContent();
  const byKey = new Map(rows.map((row) => [row.key, row]));

  return Object.fromEntries(
    SITE_CONTENT_KEYS.map((key) => {
      const row = byKey.get(key);
      const published = getPublishedSnapshotByKey(row ?? null);
      if (!published) {
        return [key, FALLBACK_CONTENT[key]];
      }
      return [key, { title: published.title || FALLBACK_CONTENT[key].title, body: published.body || FALLBACK_CONTENT[key].body, bodyBlocks: published.bodyBlocks }];
    }),
  ) as Record<SiteContentKey, SiteContentFallback>;
}

export function getFallbackSiteContent(key: SiteContentKey): SiteContentFallback {
  return FALLBACK_CONTENT[key];
}

export function toPreviewText(content: SiteContentDto | null, key: SiteContentKey): string {
  if (!content) return FALLBACK_CONTENT[key].body;
  return content.body || FALLBACK_CONTENT[key].body;
}
