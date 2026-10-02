import {
  type CommunityCategory,
  type CommunityCategoryTab,
  isCuratedCommunityCategory,
  isValidCommunityCategory,
} from "@/lib/community/categories";

export type CommunityFeedPost = {
  id: string;
  category: CommunityCategory;
  is_pinned: boolean;
  created_at: string;
};

function compareByDateDesc(a: CommunityFeedPost, b: CommunityFeedPost) {
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export function filterAndOrderCommunityPosts(posts: CommunityFeedPost[], tab: CommunityCategoryTab) {
  const selectedPosts = tab === "all" ? posts : posts.filter((post) => post.category === tab);

  return [...selectedPosts].sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) {
      return a.is_pinned ? -1 : 1;
    }

    return compareByDateDesc(a, b);
  });
}

export function normalizeCommunityTab(input: string | null): CommunityCategoryTab {
  if (!input || input === "all") {
    return "all";
  }

  return isValidCommunityCategory(input) ? input : "all";
}

export function isCommunityCmsTab(tab: CommunityCategoryTab): tab is Extract<CommunityCategoryTab, "usage" | "updates"> {
  return tab !== "all" && isCuratedCommunityCategory(tab);
}

export function toCommunityCmsKey(tab: Extract<CommunityCategoryTab, "usage" | "updates">): "community_usage" | "community_updates" {
  return tab === "usage" ? "community_usage" : "community_updates";
}

export type CommunityDataSource =
  | { kind: "posts" }
  | { kind: "cms"; key: "community_usage" | "community_updates" };

export function resolveCommunityDataSource(tab: CommunityCategoryTab): CommunityDataSource {
  if (!isCommunityCmsTab(tab)) {
    return { kind: "posts" };
  }

  return { kind: "cms", key: toCommunityCmsKey(tab) };
}
