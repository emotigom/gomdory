import assert from "node:assert/strict";
import test from "node:test";

import {
  COMMUNITY_AUTO_HIDE_MAX_KEYWORDS,
  COMMUNITY_AUTO_HIDE_MAX_KEYWORD_LENGTH,
  findCommunityAutoHideKeywordMatch,
  parseCommunityAutoHideRulesFromSiteContentBody,
  parseCommunityAutoHideRulesJson,
} from "@/lib/community/autoHideRules";

test("parseCommunityAutoHideRulesJson validates schema and limits", () => {
  assert.throws(() => parseCommunityAutoHideRulesJson("{not-json}"), /JSON 형식/);
  assert.throws(() => parseCommunityAutoHideRulesJson(JSON.stringify([])), /객체 형태/);
  assert.throws(() => parseCommunityAutoHideRulesJson(JSON.stringify({ keywords: "x" })), /문자열 배열/);
  assert.throws(
    () => parseCommunityAutoHideRulesJson(JSON.stringify({ keywords: new Array(COMMUNITY_AUTO_HIDE_MAX_KEYWORDS + 1).fill("x") })),
    /최대/,
  );
  assert.throws(
    () => parseCommunityAutoHideRulesJson(JSON.stringify({ keywords: ["x".repeat(COMMUNITY_AUTO_HIDE_MAX_KEYWORD_LENGTH + 1)] })),
    /이하/,
  );
});

test("parseCommunityAutoHideRulesFromSiteContentBody normalizes and dedupes keywords", () => {
  const parsed = parseCommunityAutoHideRulesFromSiteContentBody(JSON.stringify({ keywords: [" Spam ", "spam", " abuse ", ""] }));
  assert.deepEqual(parsed, { keywords: ["spam", "abuse"] });
  assert.deepEqual(parseCommunityAutoHideRulesFromSiteContentBody("   "), { keywords: [] });
});

test("findCommunityAutoHideKeywordMatch finds keyword in title/body", () => {
  const rules = { keywords: ["spam", "unsafe"] };
  assert.equal(findCommunityAutoHideKeywordMatch({ title: "스팸 주의", body: "normal", rules }), null);
  assert.equal(findCommunityAutoHideKeywordMatch({ title: "notice", body: "this has spam phrase", rules }), "spam");
  assert.equal(findCommunityAutoHideKeywordMatch({ title: "unsafe content", body: "", rules }), "unsafe");
  assert.equal(findCommunityAutoHideKeywordMatch({ title: "ok", body: "safe", rules: { keywords: [] } }), null);
});
