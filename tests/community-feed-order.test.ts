import assert from "node:assert/strict";
import test from "node:test";

import {
  filterAndOrderCommunityPosts,
  normalizeCommunityTab,
  resolveCommunityDataSource,
  type CommunityFeedPost,
} from "@/lib/community/feed";

const samplePosts: CommunityFeedPost[] = [
  { id: "a", category: "free", is_pinned: false, created_at: "2026-01-01T10:00:00.000Z" },
  { id: "b", category: "usage", is_pinned: true, created_at: "2026-01-01T09:00:00.000Z" },
  { id: "c", category: "usage", is_pinned: false, created_at: "2026-01-01T11:00:00.000Z" },
  { id: "d", category: "updates", is_pinned: true, created_at: "2026-01-01T08:00:00.000Z" },
];

test("community feed orders pinned first and then newest", () => {
  const result = filterAndOrderCommunityPosts(samplePosts, "all");
  assert.deepEqual(
    result.map((post) => post.id),
    ["b", "d", "c", "a"],
  );
});

test("community feed filters by category tab before ordering", () => {
  const result = filterAndOrderCommunityPosts(samplePosts, "usage");
  assert.deepEqual(
    result.map((post) => post.id),
    ["b", "c"],
  );
});

test("community tab normalizer accepts known categories only", () => {
  assert.equal(normalizeCommunityTab("usage"), "usage");
  assert.equal(normalizeCommunityTab("unknown"), "all");
  assert.equal(normalizeCommunityTab(null), "all");
});


test("community tab data source routes usage/updates to CMS", () => {
  assert.deepEqual(resolveCommunityDataSource("usage"), { kind: "cms", key: "community_usage" });
  assert.deepEqual(resolveCommunityDataSource("updates"), { kind: "cms", key: "community_updates" });
});

test("community tab data source keeps free/edu/qna on posts feed", () => {
  assert.deepEqual(resolveCommunityDataSource("free"), { kind: "posts" });
  assert.deepEqual(resolveCommunityDataSource("edu"), { kind: "posts" });
  assert.deepEqual(resolveCommunityDataSource("qna"), { kind: "posts" });
  assert.deepEqual(resolveCommunityDataSource("all"), { kind: "posts" });
});
