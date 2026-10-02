import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const file of ["app/dashboard/websites/[siteId]/edit/page.tsx", "lib/website-studio/websiteStudioRenderer.ts", "lib/website-studio/websiteStudioLocalStore.ts"]) {
  test(`${file} has no webllm import`, () => {
    const src = readFileSync(file, "utf8");
    assert.doesNotMatch(src, /@mlc-ai\/web-llm/);
  });
}
