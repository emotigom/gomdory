export const COMMUNITY_CATEGORY_VALUES = ["free", "edu", "qna", "usage", "updates"] as const;

export type CommunityCategory = (typeof COMMUNITY_CATEGORY_VALUES)[number];
export type CommunityCategoryTab = "all" | CommunityCategory;

export const COMMUNITY_CATEGORY_LABELS: Record<CommunityCategory, string> = {
  free: "자유게시판",
  edu: "교육자료",
  qna: "질문/피드백",
  usage: "사용법",
  updates: "업데이트",
};

const COMMUNITY_CURATED_CATEGORIES: ReadonlySet<CommunityCategory> = new Set(["usage", "updates"]);

export function isValidCommunityCategory(value: string): value is CommunityCategory {
  return COMMUNITY_CATEGORY_VALUES.includes(value as CommunityCategory);
}

export function isCuratedCommunityCategory(category: CommunityCategory) {
  return COMMUNITY_CURATED_CATEGORIES.has(category);
}
