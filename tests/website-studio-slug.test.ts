import assert from "node:assert/strict";
import test from "node:test";

import { createWebsiteStudioSlug, normalizeWebsiteStudioSlugBase } from "@/lib/website-studio/websiteStudioPublish";

test("slug base normalized", () => {
  assert.equal(normalizeWebsiteStudioSlugBase("My AI Website!!!"), "my-ai-website");
});

test("slug includes suffix", () => {
  const slug = createWebsiteStudioSlug("제목", "local-1", "fixed");
  assert.match(slug, /^gomdory-site-[a-f0-9]{6}$/);
});
