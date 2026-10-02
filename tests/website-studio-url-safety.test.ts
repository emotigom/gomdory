import assert from "node:assert/strict";
import test from "node:test";

import { isSafeWebsiteStudioUrl } from "@/lib/website-studio/websiteStudioUrlSafety";

test("safe urls allowed", () => {
  assert.equal(isSafeWebsiteStudioUrl("https://example.com"), true);
  assert.equal(isSafeWebsiteStudioUrl("http://localhost:3000/a"), true);
  assert.equal(isSafeWebsiteStudioUrl("/relative"), true);
});

test("unsafe urls rejected", () => {
  assert.equal(isSafeWebsiteStudioUrl("javascript:alert(1)"), false);
  assert.equal(isSafeWebsiteStudioUrl("data:text/html,hi"), false);
  assert.equal(isSafeWebsiteStudioUrl("vbscript:msgbox(1)"), false);
  assert.equal(isSafeWebsiteStudioUrl("file:///tmp/a"), false);
});
