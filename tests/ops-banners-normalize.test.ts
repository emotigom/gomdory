import test from "node:test";
import assert from "node:assert/strict";

import { normalizeBannerHref, normalizeOpsBannerInput } from "@/lib/ops/banners";

test("normalizeBannerHref allows relative and https URLs only", () => {
  assert.equal(normalizeBannerHref("/dashboard/ops"), "/dashboard/ops");
  assert.equal(normalizeBannerHref("https://example.com/status"), "https://example.com/status");
  assert.equal(normalizeBannerHref("javascript:alert(1)"), null);
});

test("empty message disables banner", () => {
  const normalized = normalizeOpsBannerInput({
    message: "   ",
    enabled: true,
    href: "https://example.com",
    label: "보기",
    level: "warning",
  });

  assert.equal(normalized.enabled, false);
  assert.equal(normalized.level, "warning");
});
