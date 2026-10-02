import { isAllowedSiteContentHref, validateSiteContentBlocks, type SiteContentBlock } from "@/lib/site-content/blocks";

export const SITE_CONTENT_DRAFT_STORAGE_PREFIX = "ops:site-content:draft";
export const SITE_CONTENT_DRAFT_MAX_BYTES = 128 * 1024;

export type SiteContentDraftPayload = {
  title: string;
  body: string;
  bodyBlocks: SiteContentBlock[];
  savedAt: string;
};

export type DiffLine = {
  kind: "same" | "add" | "remove";
  text: string;
};

export type PublishChecklistItem = {
  key: "links" | "blocks" | "schedule" | "excerpt";
  label: string;
  ok: boolean;
  detail: string;
};

export function normalizeDraftStorageKey(key: string): string {
  const normalized = key
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized || "unknown";
}

export function getDraftStorageKey(contentKey: string): string {
  return `${SITE_CONTENT_DRAFT_STORAGE_PREFIX}:${normalizeDraftStorageKey(contentKey)}`;
}

export function toDraftPayload(input: { title: string; body: string; bodyBlocks: SiteContentBlock[] }, now = new Date()): SiteContentDraftPayload {
  return {
    title: input.title,
    body: input.body,
    bodyBlocks: input.bodyBlocks,
    savedAt: now.toISOString(),
  };
}

export function serializeDraftPayload(payload: SiteContentDraftPayload): string | null {
  const raw = JSON.stringify(payload);
  if (new TextEncoder().encode(raw).byteLength > SITE_CONTENT_DRAFT_MAX_BYTES) {
    return null;
  }
  return raw;
}

export function parseDraftPayload(raw: string | null): SiteContentDraftPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SiteContentDraftPayload>;
    if (typeof parsed.title !== "string") return null;
    if (typeof parsed.body !== "string") return null;
    if (!Array.isArray(parsed.bodyBlocks)) return null;
    if (typeof parsed.savedAt !== "string") return null;
    return {
      title: parsed.title,
      body: parsed.body,
      bodyBlocks: parsed.bodyBlocks as SiteContentBlock[],
      savedAt: parsed.savedAt,
    };
  } catch {
    return null;
  }
}

export function buildLineDiff(baseText: string, targetText: string): DiffLine[] {
  const base = baseText.split("\n");
  const target = targetText.split("\n");
  const dp: number[][] = Array.from({ length: base.length + 1 }, () => Array<number>(target.length + 1).fill(0));

  for (let i = base.length - 1; i >= 0; i -= 1) {
    for (let j = target.length - 1; j >= 0; j -= 1) {
      if (base[i] === target[j]) {
        dp[i]![j] = (dp[i + 1]![j + 1] ?? 0) + 1;
      } else {
        dp[i]![j] = Math.max(dp[i + 1]![j] ?? 0, dp[i]![j + 1] ?? 0);
      }
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < base.length && j < target.length) {
    if (base[i] === target[j]) {
      lines.push({ kind: "same", text: base[i]! });
      i += 1;
      j += 1;
    } else if ((dp[i + 1]![j] ?? 0) >= (dp[i]![j + 1] ?? 0)) {
      lines.push({ kind: "remove", text: base[i]! });
      i += 1;
    } else {
      lines.push({ kind: "add", text: target[j]! });
      j += 1;
    }
  }

  while (i < base.length) {
    lines.push({ kind: "remove", text: base[i]! });
    i += 1;
  }
  while (j < target.length) {
    lines.push({ kind: "add", text: target[j]! });
    j += 1;
  }

  return lines;
}

export async function buildPublishChecklist(input: {
  body: string;
  bodyBlocks: SiteContentBlock[];
  publishAt: string | null;
  expiresAt: string | null;
  excerpt?: string | null;
}): Promise<PublishChecklistItem[]> {
  const links = Array.from(input.body.matchAll(/https?:\/\/[^\s)\]}"']+|\/[^\s)\]}"']+/g)).map((match) => match[0]);
  const invalidLinks = links.filter((href) => !isAllowedSiteContentHref(href));
  const blocksResult = await validateSiteContentBlocks(input.bodyBlocks);

  const publishAtMs = input.publishAt ? Date.parse(input.publishAt) : Number.NaN;
  const expiresAtMs = input.expiresAt ? Date.parse(input.expiresAt) : Number.NaN;
  const scheduleValid = !input.publishAt || !input.expiresAt || (!Number.isNaN(publishAtMs) && !Number.isNaN(expiresAtMs) && publishAtMs <= expiresAtMs);

  const excerpt = (input.excerpt ?? "").trim();
  const excerptValid = excerpt.length === 0 || excerpt.length <= 220;

  return [
    {
      key: "links",
      label: "링크 안전성 (/ 또는 https)",
      ok: invalidLinks.length === 0,
      detail: invalidLinks.length ? `허용되지 않은 링크 ${invalidLinks.length}개` : "통과",
    },
    {
      key: "blocks",
      label: "본문 블록 유효성",
      ok: blocksResult.ok,
      detail: blocksResult.ok ? "통과" : blocksResult.message,
    },
    {
      key: "schedule",
      label: "게시 예약/만료 윈도우",
      ok: scheduleValid,
      detail: scheduleValid ? "통과" : "publishAt은 expiresAt보다 늦을 수 없습니다.",
    },
    {
      key: "excerpt",
      label: "요약(excerpt) 길이",
      ok: excerptValid,
      detail: excerptValid ? "통과" : "요약은 220자 이하로 권장됩니다.",
    },
  ];
}
