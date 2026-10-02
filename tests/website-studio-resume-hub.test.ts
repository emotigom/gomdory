import assert from "node:assert/strict";
import test from "node:test";
import { listLocalWebsiteProjects } from "@/lib/website-studio/websiteStudioLocalStore";

test("local drafts list does not crash", () => {
  assert.doesNotThrow(() => listLocalWebsiteProjects());
});

test("corrupt localStorage fallback", () => {
  (globalThis as any).window = { localStorage: { getItem: () => "{", setItem: () => undefined } };
  assert.equal(Array.isArray(listLocalWebsiteProjects()), true);
});
