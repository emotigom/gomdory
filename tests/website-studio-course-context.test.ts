import assert from "node:assert/strict";
import test from "node:test";
import { createLocalWebsiteProjectFromTemplate } from "@/lib/website-studio/websiteStudioLocalStore";
import fs from "node:fs";

test("course context metadata is local", () => {
  const p = createLocalWebsiteProjectFromTemplate("self-intro-ko", { originSource: "edu-course", originDay: "2", originBoardId: "b1" });
  assert.equal(p.originSource, "edu-course");
  assert.equal(p.originDay, "2");
});

test("mission/completion modules do not import webllm runtime", () => {
  for (const f of ["lib/website-studio/websiteStudioMissions.ts", "lib/website-studio/websiteStudioCompletion.ts", "app/dashboard/websites/new/WebsiteStudioStarterClient.tsx"]) {
    const src = fs.readFileSync(f, "utf8");
    assert.equal(/@mlc-ai\/web-llm|from\s+["']webllm["']/i.test(src), false);
  }
});
