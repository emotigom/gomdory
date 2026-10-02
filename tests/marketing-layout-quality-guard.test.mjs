import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const layoutSource = readFileSync("app/(marketing)/layout.tsx", "utf8");
const pages = [
  "app/(marketing)/page.tsx",
  "app/(marketing)/pricing/page.tsx",
  "app/(marketing)/school/page.tsx",
  "app/(marketing)/school/adoption-readiness/page.tsx",
  "app/(marketing)/contact/page.tsx",
].map((path) => readFileSync(path, "utf8"));

test("marketing shell clips full-bleed viewport overflow", () => {
  assert.match(layoutSource, /overflow-x-clip/);
});

test("page titles let the marketing layout add the brand once", () => {
  for (const source of pages) {
    const metadataBlock = source.match(/export const metadata:[\s\S]*?\n};/)?.[0] ?? "";
    assert.doesNotMatch(metadataBlock, /title:\s*"[^"]*\|\s*곰도리(?:플랫폼)?"/);
  }
});
