export const COMMUNITY_AUTO_HIDE_RULES_KEY = "community_auto_hide_rules" as const;

export const COMMUNITY_AUTO_HIDE_MAX_KEYWORDS = 50;
export const COMMUNITY_AUTO_HIDE_MAX_KEYWORD_LENGTH = 80;

export type CommunityAutoHideRules = {
  keywords: string[];
};

function normalizeKeyword(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > COMMUNITY_AUTO_HIDE_MAX_KEYWORD_LENGTH) {
    throw new Error(`자동 숨김 키워드는 ${COMMUNITY_AUTO_HIDE_MAX_KEYWORD_LENGTH}자 이하만 허용됩니다.`);
  }

  return trimmed;
}

export function parseCommunityAutoHideRulesJson(raw: string): CommunityAutoHideRules {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("자동 숨김 규칙 JSON 형식이 올바르지 않습니다.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("자동 숨김 규칙은 객체 형태여야 합니다.");
  }

  const keywordsRaw = (parsed as { keywords?: unknown }).keywords;
  if (!Array.isArray(keywordsRaw)) {
    throw new Error("자동 숨김 규칙 keywords는 문자열 배열이어야 합니다.");
  }

  if (keywordsRaw.length > COMMUNITY_AUTO_HIDE_MAX_KEYWORDS) {
    throw new Error(`자동 숨김 키워드는 최대 ${COMMUNITY_AUTO_HIDE_MAX_KEYWORDS}개까지 허용됩니다.`);
  }

  const deduped = Array.from(
    new Set(
      keywordsRaw
        .map((entry) => normalizeKeyword(entry))
        .filter((entry): entry is string => Boolean(entry)),
    ),
  );

  return { keywords: deduped };
}

export function parseCommunityAutoHideRulesFromSiteContentBody(raw: string | null | undefined): CommunityAutoHideRules {
  if (!raw || !raw.trim()) {
    return { keywords: [] };
  }

  return parseCommunityAutoHideRulesJson(raw);
}

export function findCommunityAutoHideKeywordMatch(input: { title?: string; body: string; rules: CommunityAutoHideRules }): string | null {
  if (!input.rules.keywords.length) {
    return null;
  }

  const haystack = `${input.title ?? ""}\n${input.body}`.toLowerCase();
  return input.rules.keywords.find((keyword) => haystack.includes(keyword)) ?? null;
}
