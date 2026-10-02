import assert from "node:assert/strict";
import test from "node:test";

import { parseSiteContentDeepLinkKey } from "@/lib/site-content/opsDeepLink";

test("parseSiteContentDeepLinkKey returns requested key for valid value", () => {
  assert.equal(parseSiteContentDeepLinkKey("community_usage"), "community_usage");
  assert.equal(parseSiteContentDeepLinkKey("board_sidebar_config"), "board_sidebar_config");
});

test("parseSiteContentDeepLinkKey falls back safely for missing/invalid values", () => {
  assert.equal(parseSiteContentDeepLinkKey(undefined), "community_usage");
  assert.equal(parseSiteContentDeepLinkKey(null), "community_usage");
  assert.equal(parseSiteContentDeepLinkKey(""), "community_usage");
  assert.equal(parseSiteContentDeepLinkKey(" "), "community_usage");
  assert.equal(parseSiteContentDeepLinkKey("../../etc/passwd"), "community_usage");
  assert.equal(parseSiteContentDeepLinkKey("nope", "community_updates"), "community_updates");
});
